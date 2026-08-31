declare const process: { env: Record<string, string | undefined> };

import { providerConfigs, skippedProvider, verificationThresholds } from "./config.js";
import type { ConsensusSummary, NormalizedLocalModelResult, NormalizedProviderResult, ProviderStatus, VerificationDecision } from "./types.js";

interface ConsensusInput {
  localModel: NormalizedLocalModelResult | null;
  providers: NormalizedProviderResult[];
  allProvidersAttempted: boolean;
}

export function calculateConsensus(input: ConsensusInput): ConsensusSummary {
  const completed = input.providers.filter((provider) => provider.status === "completed" && provider.success);
  const votes = [
    ...(input.localModel?.available && input.localModel.status === "completed" ? [input.localModel] : []),
    ...completed,
  ];

  const relevantVotes = votes.filter((vote) => vote.relevant && vote.issueDetected && vote.imageQuality !== "poor");
  const negativeVotes = votes.filter((vote) => vote.relevant === false || vote.issueDetected === false);
  const successfulCloudGroups = new Set(completed.map((provider) => provider.providerGroup));
  const independentGroups = new Set([
    ...(input.localModel?.available ? ["local"] : []),
    ...successfulCloudGroups,
  ]).size;
  const strongestPositive = Math.max(...relevantVotes.map((vote) => vote.confidence || 0), 0);
  const strongestNegative = Math.max(...negativeVotes.map((vote) => vote.confidence || 0), 0);
  const strongContradiction = strongestPositive >= 0.8 && strongestNegative >= 0.8;
  const poorQuality = votes.some((vote) => vote.imageQuality === "poor");
  const totalDirectionalVotes = relevantVotes.length + negativeVotes.length;
  const agreement = totalDirectionalVotes ? Math.max(relevantVotes.length, negativeVotes.length) / totalDirectionalVotes : 0;
  const localRelevant = Boolean(input.localModel?.available && input.localModel.relevant && input.localModel.confidence >= verificationThresholds.localStrongConfidence);
  const localNegative = Boolean(input.localModel?.available && !input.localModel.relevant && input.localModel.confidence >= verificationThresholds.localStrongConfidence);
  const cloudPositive = completed.filter((provider) => provider.relevant && provider.issueDetected && (provider.confidence || 0) >= verificationThresholds.cloudStrongConfidence);
  const cloudNegative = completed.filter((provider) => (provider.relevant === false || provider.issueDetected === false) && (provider.confidence || 0) >= verificationThresholds.cloudStrongConfidence);

  const earlyPositive =
    localRelevant &&
    cloudPositive.length >= verificationThresholds.minCloudChecksForEarlyConsensus &&
    independentGroups >= verificationThresholds.minIndependentGroupsForEarlyConsensus &&
    !strongContradiction &&
    (!verificationThresholds.poorQualityBlocksEarlyStop || !poorQuality);
  const earlyNegative =
    localNegative &&
    cloudNegative.length >= verificationThresholds.minCloudChecksForEarlyConsensus &&
    independentGroups >= verificationThresholds.minIndependentGroupsForEarlyConsensus &&
    !strongContradiction &&
    (!verificationThresholds.poorQualityBlocksEarlyStop || !poorQuality);

  const finalDecision = decide({
    input,
    completedCount: completed.length,
    relevantCount: relevantVotes.length,
    notRelevantCount: negativeVotes.length,
    agreement,
    strongContradiction,
    earlyPositive,
    earlyNegative,
    poorQuality,
  });
  const verificationScore = calculateScore(relevantVotes, negativeVotes, agreement, strongContradiction, poorQuality);

  return {
    finalDecision,
    verificationScore,
    agreement,
    successfulChecks: completed.length,
    independentGroups,
    relevantCount: relevantVotes.length,
    notRelevantCount: negativeVotes.length,
    issueDetectedCount: votes.filter((vote) => vote.issueDetected).length,
    strongContradiction,
    earlyConsensusReached: earlyPositive || earlyNegative,
    reason: reasonForDecision(finalDecision, earlyPositive || earlyNegative, completed.length, agreement, strongContradiction),
  };
}

export function applyEarlySkipped(providers: NormalizedProviderResult[], reason: string) {
  const known = new Set(providers.map((provider) => provider.provider));
  return [
    ...providers,
    ...providerConfigs
      .filter((config) => !known.has(config.provider))
      .map((config) => skippedProvider(config, "skipped", reason)),
  ];
}

export function hasRemainingUsefulProviders(providers: NormalizedProviderResult[]) {
  const known = new Set(providers.map((provider) => provider.provider));
  return providerConfigs.some((config) => !known.has(config.provider) && config.enabled && config.supportsImage && hasProviderConfig(config));
}

export function statusForUnavailableProvider(configProvider: string): ProviderStatus {
  const config = providerConfigs.find((item) => item.provider === configProvider);
  if (!config) return "skipped";
  if (!config.enabled) return "disabled";
  if (!config.supportsImage) return "unsupported";
  if (!hasProviderConfig(config)) return "missing_config";
  return "skipped";
}

function hasProviderConfig(config: (typeof providerConfigs)[number]) {
  const keys = config.envKeys || (config.envKey ? [config.envKey] : []);
  return !keys.length || keys.some((key) => {
    const value = process.env[key];
    return Boolean(value && value !== "[SENSITIVE]");
  });
}

function decide(input: {
  input: ConsensusInput;
  completedCount: number;
  relevantCount: number;
  notRelevantCount: number;
  agreement: number;
  strongContradiction: boolean;
  earlyPositive: boolean;
  earlyNegative: boolean;
  poorQuality: boolean;
}): VerificationDecision {
  if (input.earlyPositive) return "VERIFIED";
  if (input.earlyNegative) return "REJECTED";
  if (input.strongContradiction || input.poorQuality) return "UNCERTAIN";
  if (input.completedCount < verificationThresholds.minimumSuccessfulCloudChecks && input.input.localModel?.available !== true) return "UNCERTAIN";
  if (input.relevantCount > input.notRelevantCount && input.agreement >= verificationThresholds.finalVerifiedAgreement) return "VERIFIED";
  if (input.notRelevantCount > input.relevantCount && input.agreement >= verificationThresholds.finalRejectedAgreement) return "REJECTED";
  return input.input.allProvidersAttempted ? "UNCERTAIN" : "UNCERTAIN";
}

function calculateScore(
  relevantVotes: Array<{ confidence?: number }>,
  negativeVotes: Array<{ confidence?: number }>,
  agreement: number,
  strongContradiction: boolean,
  poorQuality: boolean,
) {
  const positive = relevantVotes.reduce((total, vote) => total + (vote.confidence || 0), 0);
  const negative = negativeVotes.reduce((total, vote) => total + (vote.confidence || 0), 0);
  const total = positive + negative;
  const base = total ? positive / total : 0;
  const penalty = (strongContradiction ? 0.2 : 0) + (poorQuality ? 0.2 : 0);
  return Math.max(0, Math.min(1, base * agreement - penalty));
}

function reasonForDecision(decision: VerificationDecision, early: boolean, checks: number, agreement: number, contradiction: boolean) {
  if (decision === "VERIFIED") return early ? "Sufficient visual verification consensus reached early." : "Multiple checks agree the image is visually relevant.";
  if (decision === "REJECTED") return early ? "Sufficient negative visual consensus reached early." : "Most checks indicate the image does not match the selected category.";
  if (contradiction) return "Verification systems produced strong contradictory results.";
  if (!checks) return "No cloud verification provider returned a usable result.";
  return `Consensus was not reliable enough to verify automatically (${Math.round(agreement * 100)}% agreement).`;
}
