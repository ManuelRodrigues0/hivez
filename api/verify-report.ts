declare const process: { env: Record<string, string | undefined> };

import { getCategoryContext, getCategoryVerificationMode, MAX_BASE64_LENGTH, providerConfigs, skippedProvider, verificationThresholds } from "../lib/verification/config.js";
import type { CategoryVerificationMode } from "../lib/verification/config.js";
import { applyEarlySkipped, calculateConsensus } from "../lib/verification/consensus.js";
import { callProvider } from "../lib/verification/providerCalls.js";
import type { NormalizedProviderResult, VerificationFailureResponse, VerificationRequest, VerificationResponse } from "../lib/verification/types.js";

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

  const verificationId = `vf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const verificationMode = getCategoryVerificationMode(request.categoryId);
  logVerificationStart(verificationId, request);
  if (request.localModelResult) {
    console.log(`[Verification] Local model (device): top prediction ${request.localModelResult.topLabel || "Unavailable"} | confidence ${percentLabel(request.localModelResult.topConfidence ?? request.localModelResult.confidence)}`);
  }

  const providers: NormalizedProviderResult[] = [];
  const grouped = new Map<number, typeof providerConfigs>();
  for (const provider of providerConfigs) {
    grouped.set(provider.batch, [...(grouped.get(provider.batch) || []), provider]);
  }

  for (const batch of Array.from(grouped.keys()).sort((a, b) => a - b)) {
    const batchProviders = grouped.get(batch) || [];
    const callable = batchProviders.filter((provider) => provider.enabled && provider.supportsImage && providerHasConfig(provider));
    const skipped = batchProviders.filter((provider) => !callable.includes(provider));
    providers.push(
      ...skipped.map((provider) => skippedProvider(provider, unavailableStatus(provider), unavailableReason(provider))),
    );

    if (callable.length) {
      console.log(batch === 1 ? "[Verification] Initial cloud verification batch started" : "[Verification] Starting additional verification batch");
      const batchResults = await Promise.all(callable.map((provider) => callProvider(provider, request)));
      providers.push(...batchResults);
      console.log(
        `[Verification] Batch ${batch} finished: ${batchResults.filter((result) => result.status === "completed" && result.success).length} completed, ${batchResults.filter((result) => result.status === "failed").length} failed, ${batchResults.filter((result) => result.status !== "completed" && result.status !== "failed").length} unavailable`,
      );
    }

    console.log("[Verification] Consensus calculation started");
    const consensus = calculateConsensus({
      localModel: request.localModelResult || null,
      providers,
      allProvidersAttempted: attemptedAll(providers),
      verificationMode,
    });

    if (consensus.earlyConsensusReached) {
      console.log("[Verification] Sufficient consensus reached");
      const completedProviders = applyEarlySkipped(providers, "Sufficient verification consensus already reached");
      const finalConsensus = calculateConsensus({
        localModel: request.localModelResult || null,
        providers: completedProviders,
        allProvidersAttempted: true,
        verificationMode,
      });
      logVerificationSummary(verificationId, request, completedProviders, finalConsensus);
      res.status(200).json(success(request, completedProviders, finalConsensus));
      return;
    }

    console.log("[Verification] Early consensus not yet sufficient");
  }

  const consensus = calculateConsensus({
    localModel: request.localModelResult || null,
    providers,
    allProvidersAttempted: true,
    verificationMode,
  });
  logVerificationSummary(verificationId, request, providers, consensus);
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
  if (!providerHasConfig(provider)) return "missing_config";
  return "skipped";
}

function unavailableReason(provider: (typeof providerConfigs)[number]) {
  if (!provider.enabled) return "Provider disabled by configuration.";
  if (!provider.supportsImage) return "Model is not configured as supporting image verification.";
  if (!providerHasConfig(provider)) return `Missing ${provider.envKey}.`;
  return "Provider skipped.";
}

function providerHasConfig(provider: (typeof providerConfigs)[number]) {
  const keys = provider.envKeys || (provider.envKey ? [provider.envKey] : []);
  return !keys.length || keys.some((key) => {
    const value = process.env[key];
    return Boolean(value && value !== "[SENSITIVE]");
  });
}

function logVerificationStart(verificationId: string, request: VerificationRequest) {
  console.log("========================================");
  console.log("VERIFICATION START");
  console.log("========================================");
  console.log(`[Verification] Run/verification ID: ${verificationId}`);
  console.log("[Verification] Report/post ID: not provided (verification runs before the report is created)");
  console.log(`[Verification] Category: ${request.categoryTitle} (${request.categoryId})`);
  console.log(`[Verification] Category verification mode: ${getCategoryVerificationMode(request.categoryId)} (defines what issueDetected means)`);
  console.log(`[Verification] Content being verified: image ${request.mimeType}, ~${Math.round((request.imageBase64.length * 3) / 4 / 1024)} KB`);
  console.log(`[Verification] Local model result provided by device: ${request.localModelResult ? "yes" : "no"}`);
  console.log(`[Verification] Configured providers: ${providerConfigs.length}`);
  providerConfigs.forEach((provider, index) => {
    console.log(`[Verification]   ${index + 1}. ${provider.label || provider.provider} (${provider.provider}) | model: ${provider.model} | batch: ${provider.batch}`);
  });
}

function logVerificationSummary(
  verificationId: string,
  request: VerificationRequest,
  providers: NormalizedProviderResult[],
  consensus: VerificationResponse["consensus"],
) {
  const completed = providers.filter((provider) => provider.status === "completed" && provider.success);
  const failed = providers.filter((provider) => provider.status === "failed");
  const unavailable = providers.filter((provider) => provider.status !== "completed" && provider.status !== "failed");
  const mode = getCategoryVerificationMode(request.categoryId);
  const issueVotes = completed.filter((provider) => directionalVote(provider, mode) === "issue");
  const noIssueVotes = completed.filter((provider) => directionalVote(provider, mode) === "no_issue");
  const neutralVotes = completed.filter((provider) => directionalVote(provider, mode) === "neutral");

  console.log("========================================");
  console.log("VERIFICATION PROVIDER SUMMARY");
  console.log("========================================");
  console.log(`[Verification] Run/verification ID: ${verificationId}`);
  console.log(`[Verification] Category: ${request.categoryTitle} (${request.categoryId})`);

  for (const provider of providers) {
    const name = provider.label || provider.provider;
    if (provider.status === "completed" && provider.success) {
      console.log(
        `[Verification] ${name} [${provider.provider}] — COMPLETED | model: ${provider.model} | ${voteText(directionalVote(provider, mode))} | CONFIDENCE: ${percentLabel(provider.confidence)} | DURATION: ${provider.durationMs ?? "n/a"}ms`,
      );
      console.log(`[Verification]    reasoning: ${provider.reason}`);
    } else if (provider.status === "failed") {
      console.error(
        `[Verification] ${name} [${provider.provider}] — FAILED | model: ${provider.model} | error: ${provider.errorType || "unknown"}${httpStatusSuffix(provider.reason)} | DURATION: ${provider.durationMs ?? "n/a"}ms | reason: ${provider.reason}`,
      );
    } else {
      console.log(`[Verification] ${name} [${provider.provider}] — ${provider.status.toUpperCase()} | reason: ${provider.reason}`);
    }
  }

  console.log("----------------------------------------");
  console.log(`[Verification] Successful providers: ${completed.length}`);
  console.log(`[Verification] Failed providers: ${failed.length}`);
  console.log(`[Verification] Unavailable providers (skipped/disabled/missing config/unsupported): ${unavailable.length}`);
  console.log(`[Verification] Provider votes detecting issue: ${issueVotes.length} (${providerNames(issueVotes)})`);
  console.log(`[Verification] Provider votes not detecting issue: ${noIssueVotes.length} (${providerNames(noIssueVotes)})`);
  console.log(`[Verification] Provider neutral votes (subject visible): ${neutralVotes.length} (${providerNames(neutralVotes)})`);
  console.log(`[Verification] Local model vote: ${localModelVoteText(request)}`);
  console.log(`[Verification] Agreement percentage: ${percentLabel(consensus.agreement)} (consensus counts include the local model vote)`);
  console.log(`[Verification] Strong contradiction: ${consensus.strongContradiction}`);
  console.log("----------------------------------------");
  console.log(`[Verification] FINAL DECISION: ${consensus.finalDecision}`);
  console.log(`[Verification] Final reason: ${consensus.reason}`);
  logAgreementLists(consensus.finalDecision, issueVotes, noIssueVotes);
  console.log(
    `[Verification] How consensus was calculated (existing logic): successfulChecks=${consensus.successfulChecks} | independentGroups=${consensus.independentGroups} | relevant=${consensus.relevantCount} | notRelevant=${consensus.notRelevantCount} | issueDetected=${consensus.issueDetectedCount} | agreement=${percentLabel(consensus.agreement)} (verify>=${percentLabel(verificationThresholds.finalVerifiedAgreement)}, reject>=${percentLabel(verificationThresholds.finalRejectedAgreement)}) | strongContradiction=${consensus.strongContradiction} | earlyConsensusReached=${consensus.earlyConsensusReached} | verificationScore=${percentLabel(consensus.verificationScore)}`,
  );
  console.log("========================================");
}

function directionalVote(provider: NormalizedProviderResult, mode: CategoryVerificationMode): "issue" | "no_issue" | "neutral" | null {
  if (provider.status !== "completed" || !provider.success) return null;
  if (provider.relevant === false) return "no_issue";
  if (provider.relevant && provider.issueDetected) return "issue";
  // Subject-visible: "relevant=true, issueDetected=false" is semantic ambiguity, not a negative vote.
  if (mode === "subject_visible" && provider.relevant && provider.issueDetected === false) return "neutral";
  return provider.issueDetected === false ? "no_issue" : null;
}

function voteText(vote: "issue" | "no_issue" | "neutral" | null): string {
  if (vote === "issue") return "ISSUE DETECTED";
  if (vote === "no_issue") return "NO ISSUE";
  if (vote === "neutral") return "NEUTRAL (subject visible, semantic ambiguity)";
  return "NO DIRECTIONAL VOTE";
}

function providerNames(providers: NormalizedProviderResult[]): string {
  return providers.map((provider) => provider.label || provider.provider).join(", ") || "none";
}

function localModelVoteText(request: VerificationRequest): string {
  const local = request.localModelResult;
  if (!local?.available || local.status !== "completed") return "not included (device model unavailable)";
  return `included -> ${local.relevant && local.issueDetected ? "ISSUE DETECTED" : "NO ISSUE"} | confidence ${percentLabel(local.confidence)} | model: ${local.modelName || "teachable-machine"}`;
}

function logAgreementLists(
  decision: VerificationResponse["finalDecision"],
  issueVotes: NormalizedProviderResult[],
  noIssueVotes: NormalizedProviderResult[],
) {
  if (decision === "VERIFIED" || decision === "REJECTED") {
    const agreed = decision === "VERIFIED" ? issueVotes : noIssueVotes;
    const disagreed = decision === "VERIFIED" ? noIssueVotes : issueVotes;
    console.log(`[Verification] Providers agreeing with decision (${decision}):`);
    if (!agreed.length) console.log("[Verification]   (none)");
    agreed.forEach((provider) =>
      console.log(`[Verification]   ${provider.label || provider.provider} -> ${decision === "VERIFIED" ? "ISSUE DETECTED" : "NO ISSUE"}`),
    );
    console.log("[Verification] Providers disagreeing with decision:");
    if (!disagreed.length) console.log("[Verification]   (none)");
    disagreed.forEach((provider) =>
      console.log(`[Verification]   ${provider.label || provider.provider} -> ${decision === "VERIFIED" ? "NO ISSUE" : "ISSUE DETECTED"}`),
    );
    return;
  }
  console.log("[Verification] Decision is UNCERTAIN — provider vote split:");
  issueVotes.forEach((provider) => console.log(`[Verification]   ${provider.label || provider.provider} -> ISSUE DETECTED`));
  noIssueVotes.forEach((provider) => console.log(`[Verification]   ${provider.label || provider.provider} -> NO ISSUE`));
}

function percentLabel(value?: number): string {
  return typeof value === "number" ? `${Math.round(value * 100)}%` : "n/a";
}

function httpStatusSuffix(reason: string): string {
  const match = reason.match(/\((\d{3})\)/);
  return match ? ` | HTTP status: ${match[1]}` : "";
}
