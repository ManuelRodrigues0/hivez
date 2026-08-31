export type VerificationDecision = "VERIFIED" | "UNCERTAIN" | "REJECTED";
export type ProviderStatus =
  | "completed"
  | "failed"
  | "skipped"
  | "disabled"
  | "missing_config"
  | "unsupported";

export interface LocalPrediction {
  label: string;
  confidence: number;
  confidencePercent: number;
}

export interface NormalizedLocalModelResult {
  source: "teachable-machine";
  provider: "teachable-machine";
  providerGroup: "local";
  category: string;
  available: boolean;
  status: ProviderStatus;
  predictions: LocalPrediction[];
  topLabel?: string;
  topConfidence?: number;
  topConfidencePercent?: number;
  relevant: boolean;
  issueDetected: boolean;
  imageQuality: "good" | "acceptable" | "poor";
  confidence: number;
  reason?: string;
  modelName?: string;
  modelVersion?: string;
}

export interface NormalizedProviderResult {
  provider: string;
  providerGroup: string;
  model: string;
  status: ProviderStatus;
  success: boolean;
  relevant?: boolean;
  issueDetected?: boolean;
  confidence?: number;
  imageQuality?: "good" | "acceptable" | "poor";
  visibleEvidence?: string;
  reason: string;
  rawResponse?: unknown;
}

export interface VerificationRequest {
  categoryId: string;
  categoryTitle: string;
  categoryDescription?: string;
  mimeType: string;
  imageBase64: string;
  localModelResult?: NormalizedLocalModelResult | null;
}

export interface ConsensusSummary {
  finalDecision: VerificationDecision;
  verificationScore: number;
  agreement: number;
  successfulChecks: number;
  independentGroups: number;
  relevantCount: number;
  notRelevantCount: number;
  issueDetectedCount: number;
  strongContradiction: boolean;
  earlyConsensusReached: boolean;
  reason: string;
}

export interface VerificationResponse {
  ok: true;
  category: string;
  localModel: NormalizedLocalModelResult | null;
  providers: NormalizedProviderResult[];
  finalDecision: VerificationDecision;
  verificationScore: number;
  agreement: number;
  consensus: ConsensusSummary;
  verifiedAt: string;
}

export interface VerificationFailureResponse {
  ok: false;
  error: string;
  message: string;
}
