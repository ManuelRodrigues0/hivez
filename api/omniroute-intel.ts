/**
 * Central OmniRoute Intelligence Gateway (server-side only).
 *
 * This is the SINGLE server-side entry point for all OmniRoute intelligence
 * operations. React components call this route; they never call OmniRoute
 * directly and never see provider/model/API-key internals.
 *
 * Operations (request.body.op):
 *   "searchHives"                 — sidebar + Create Report Hive discovery
 *   "analyzeIssue"                — new-issue analysis + Hive proposal
 *   "assistDescription"           — optional report-description assistance
 *   "compareReportsForDuplicates" — semantic duplicate/related analysis
 *
 * Every intelligence function already does deterministic-first processing and
 * only calls OmniRoute when needed. This gateway adds: input validation,
 * operation routing, safe error handling, and a uniform secret-free response.
 *
 * The OmniRoute API key stays server-side. Responses never contain it.
 */

import { INTELLIGENCE_OPS, IntelligenceOp, isIntelligenceOp, logIntel, REQUEST_SETTINGS } from "../lib/omniroute/config.js";
import type { IntelligenceResponse } from "../lib/omniroute/types.js";
import { searchHives } from "../lib/omniroute/intelligence/hiveSearch.js";
import { analyzeIssue, assistDescription } from "../lib/omniroute/intelligence/issueAnalysis.js";
import { compareReportsForDuplicates } from "../lib/omniroute/intelligence/duplicates.js";

type ApiRequest = {
  method?: string;
  body?: unknown;
};
type ApiResponse = {
  status: (code: number) => { json: (payload: unknown) => void };
};

interface IntelRequestBody {
  op?: unknown;
  payload?: unknown;
}

function failure(status: number, error: string, message: string) {
  return { status, body: { ok: false, error, message } };
}

/**
 * Validates the incoming request and returns the operation + payload, or an
 * HTTP error descriptor the caller can send directly.
 */
function parseRequest(req: ApiRequest): { op: IntelligenceOp; payload: unknown } | { status: number; body: unknown } {
  if (req.method !== "POST") {
    return failure(405, "method_not_allowed", "Use POST.");
  }
  const body = (req.body ?? {}) as IntelRequestBody;
  const op = body.op;
  if (!isIntelligenceOp(op)) {
    return failure(
      400,
      "invalid_operation",
      `Unknown op "${String(op)}". Supported: ${INTELLIGENCE_OPS.join(", ")}.`,
    );
  }
  return { op, payload: body.payload };
}

async function runOperation(op: IntelligenceOp, payload: unknown): Promise<IntelligenceResponse> {
  switch (op) {
    case "searchHives": {
      const { query, registry } = (payload ?? {}) as { query?: unknown; registry?: unknown };
      logIntel("HiveSearch", "request", { query: typeof query === "string" ? query.slice(0, 80) : null });
      const result = await searchHives(String(query ?? ""), Array.isArray(registry) ? registry : []);
      logIntel("HiveSearch", result.ok ? "completed" : "failed", { matchCount: result.ok ? result.matches.length : 0 });
      return result;
    }
    case "analyzeIssue": {
      logIntel("NewIssue", "request");
      const result = await analyzeIssue((payload ?? {}) as Parameters<typeof analyzeIssue>[0]);
      logIntel("NewIssue", result.ok ? "completed" : "failed", { proposed: result.ok ? Boolean(result.proposal) : false });
      return result;
    }
    case "assistDescription": {
      logIntel("DescriptionAssist", "request");
      const result = await assistDescription((payload ?? {}) as Parameters<typeof assistDescription>[0]);
      logIntel("DescriptionAssist", result.ok ? "completed" : "failed");
      return result;
    }
    case "compareReportsForDuplicates": {
      logIntel("DuplicateAnalysis", "request");
      const result = await compareReportsForDuplicates((payload ?? {}) as Parameters<typeof compareReportsForDuplicates>[0]);
      logIntel("DuplicateAnalysis", result.ok ? "completed" : "failed");
      return result;
    }
    default: {
      _exhaustive(op);
      return { ok: false, error: "invalid_operation", message: `Unsupported op "${op}".` };
    }
  }
}

function _exhaustive(value: never): never {
  return value;
}

export const config = { maxDuration: REQUEST_SETTINGS.gatewayMaxDuration };

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const parsed = parseRequest(req);
  if ("status" in parsed) {
    res.status(parsed.status).json(parsed.body);
    return;
  }

  try {
    const result = await runOperation(parsed.op, parsed.payload);
    res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logIntel("Gateway", "error", { message });
    res.status(500).json({ ok: false, error: "gateway_error", message: "OmniRoute intelligence request failed." });
  }
}
