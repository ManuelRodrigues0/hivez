export type VerificationDecision = "VERIFIED" | "UNCERTAIN" | "REJECTED";
export type ProviderStatus =
  | "completed"
  | "failed"
  | "skipped"
  | "disabled"
  | "missing_config"
  | "unsupported";

export type ProviderErrorType =
  | "disabled"
  | "image_unsupported"
  | "missing_api_key"
  | "authentication_failed"
  | "rate_limited"
  | "timeout"
  | "model_unsupported"
  | "invalid_response_format"
  | "json_parse_failure"
  | "network_failure"
  | "api_request_failed";

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
  /** Human-readable provider name used in verification logs (e.g. "Groq Qwen 3.6 27B"). */
  label?: string;
  status: ProviderStatus;
  success: boolean;
  relevant?: boolean;
  issueDetected?: boolean;
  confidence?: number;
  imageQuality?: "good" | "acceptable" | "poor";
  visibleEvidence?: string;
  reason: string;
  rawResponse?: unknown;
  /** Optional timing/error diagnostics used by verification logging. */
  startedAt?: number;
  endedAt?: number;
  durationMs?: number;
  errorType?: ProviderErrorType;
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
