/**
 * Vercel serverless route: GET /api/omniroute-status
 *
 * Development/diagnostic endpoint that verifies the Hivez server can talk to
 * the configured OmniRoute instance (local or remote). It checks that OmniRoute
 * is reachable, that authentication works, that the OpenAI-compatible
 * /models endpoint responds, and that a basic chat completion round-trip
 * succeeds. No user-facing feature is built on this route.
 *
 * The response is a secret-free connection report: it never contains the
 * OmniRoute API key, Authorization headers, or any other credential material.
 *
 * Required server-side environment variables (never VITE_ prefixed):
 *   OMNIROUTE_BASE_URL - OpenAI-compatible base URL,
 *                        e.g. http://localhost:20128/v1 (default when unset)
 *   OMNIROUTE_API_KEY  - server-side OmniRoute secret
 *   OMNIROUTE_MODEL    - optional default model, "auto" when unset
 */

import { getOmniRouteConfig, testOmniRouteConnection, OMNIROUTE_LOG_PREFIX } from "../lib/omniroute/client.js";

type ApiRequest = { method?: string };
type ApiResponse = {
  status: (code: number) => { json: (payload: unknown) => void };
};

export const config = { maxDuration: 60 };

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "method_not_allowed", message: "Use GET." });
    return;
  }

  const omni = getOmniRouteConfig();
  console.log(
    `${OMNIROUTE_LOG_PREFIX} Connection test started (base URL ${omni.baseUrl}, API key ${omni.isConfigured ? "present" : "MISSING"}, model ${omni.model})`,
  );

  const report = await testOmniRouteConnection();
  console.log(`${OMNIROUTE_LOG_PREFIX} Connection test finished: ${report.ok ? "OK" : "FAILED"}`);

  res.status(200).json(report);
}

/**
 * Defensive guard used by tests: verifies a serialized report contains no
 * credential material. Not part of the runtime response path.
 */
export function reportContainsSecret(report: unknown, apiKey: string): boolean {
  if (!apiKey) return false;
  const serialized = JSON.stringify(report);
  return serialized.includes(apiKey) || /authorization\s*:/i.test(serialized);
}
