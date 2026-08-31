import { getCategoryContext, MAX_BASE64_LENGTH, providerConfigs, skippedProvider } from "./verification/config";
import { applyEarlySkipped, calculateConsensus } from "./verification/consensus";
import { callProvider } from "./verification/providerCalls";
import type { NormalizedProviderResult, VerificationFailureResponse, VerificationRequest, VerificationResponse } from "./verification/types";

type ApiRequest = { method?: string; body?: unknown };
type ApiResponse = {
  status: (code: number) => { json: (payload: unknown) => void };
};

export const config = { maxDuration: 60 };

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json(failure("method_not_allowed"));
    return;
  }

  const request = normalizeRequest(req.body);
  if (!request) {
    res.status(200).json(failure("invalid_request"));
    return;
  }

  console.log(`[Verification] Category selected: ${request.categoryTitle}`);
  if (request.localModelResult) {
    console.log("[Verification] Local model completed");
    console.log(`[Verification] Top prediction: ${request.localModelResult.topLabel || "Unavailable"}`);
  }

  const providers: NormalizedProviderResult[] = [];
  const grouped = new Map<number, typeof providerConfigs>();
  for (const provider of providerConfigs) {
    grouped.set(provider.batch, [...(grouped.get(provider.batch) || []), provider]);
  }

  for (const batch of Array.from(grouped.keys()).sort((a, b) => a - b)) {
    const batchProviders = grouped.get(batch) || [];
    const callable = batchProviders.filter((provider) => provider.enabled && provider.supportsImage && (!provider.envKey || process.env[provider.envKey]));
    const skipped = batchProviders.filter((provider) => !callable.includes(provider));
    providers.push(
      ...skipped.map((provider) => skippedProvider(provider, unavailableStatus(provider), unavailableReason(provider))),
    );

    if (callable.length) {
      console.log(batch === 1 ? "[Verification] Initial cloud verification batch started" : "[Verification] Starting additional verification batch");
      providers.push(...await Promise.all(callable.map((provider) => callProvider(provider, request))));
    }

    console.log("[Verification] Consensus calculation started");
    const consensus = calculateConsensus({
      localModel: request.localModelResult || null,
      providers,
      allProvidersAttempted: attemptedAll(providers),
    });

    if (consensus.earlyConsensusReached) {
      console.log("[Verification] Sufficient consensus reached");
      const completedProviders = applyEarlySkipped(providers, "Sufficient verification consensus already reached");
      const finalConsensus = calculateConsensus({
        localModel: request.localModelResult || null,
        providers: completedProviders,
        allProvidersAttempted: true,
      });
      res.status(200).json(success(request, completedProviders, finalConsensus));
      return;
    }

    console.log("[Verification] Early consensus not yet sufficient");
  }

  const consensus = calculateConsensus({
    localModel: request.localModelResult || null,
    providers,
    allProvidersAttempted: true,
  });
  console.log(`[Verification] Final result: ${consensus.finalDecision}`);
  res.status(200).json(success(request, providers, consensus));
}

function normalizeRequest(body: unknown): VerificationRequest | null {
  if (!body || typeof body !== "object") return null;
  const data = body as Partial<VerificationRequest>;
  if (
    typeof data.categoryId !== "string" ||
    typeof data.categoryTitle !== "string" ||
    typeof data.mimeType !== "string" ||
    typeof data.imageBase64 !== "string" ||
    !data.categoryId.trim() ||
    !data.categoryTitle.trim() ||
    !data.mimeType.startsWith("image/") ||
    !data.imageBase64.trim() ||
    data.imageBase64.length > MAX_BASE64_LENGTH
  ) {
    return null;
  }
  const context = getCategoryContext(data.categoryId, data.categoryTitle, data.categoryDescription);
  return {
    categoryId: data.categoryId,
    categoryTitle: data.categoryTitle || context.title,
    categoryDescription: data.categoryDescription || context.description,
    mimeType: data.mimeType,
    imageBase64: data.imageBase64,
    localModelResult: data.localModelResult || null,
  };
}

function success(request: VerificationRequest, providers: NormalizedProviderResult[], consensus: VerificationResponse["consensus"]): VerificationResponse {
  return {
    ok: true,
    category: request.categoryId,
    localModel: request.localModelResult || null,
    providers,
    finalDecision: consensus.finalDecision,
    verificationScore: consensus.verificationScore,
    agreement: consensus.agreement,
    consensus,
    verifiedAt: new Date().toISOString(),
  };
}

function failure(error: string): VerificationFailureResponse {
  return {
    ok: false,
    error,
    message: "AI verification is currently unavailable. Please try again.",
  };
}

function attemptedAll(providers: NormalizedProviderResult[]) {
  const known = new Set(providers.map((provider) => provider.provider));
  return providerConfigs.every((provider) => known.has(provider.provider));
}

function unavailableStatus(provider: (typeof providerConfigs)[number]): NormalizedProviderResult["status"] {
  if (!provider.enabled) return "disabled";
  if (!provider.supportsImage) return "unsupported";
  if (provider.envKey && !process.env[provider.envKey]) return "missing_config";
  return "skipped";
}

function unavailableReason(provider: (typeof providerConfigs)[number]) {
  if (!provider.enabled) return "Provider disabled by configuration.";
  if (!provider.supportsImage) return "Model is not configured as supporting image verification.";
  if (provider.envKey && !process.env[provider.envKey]) return `Missing ${provider.envKey}.`;
  return "Provider skipped.";
}
