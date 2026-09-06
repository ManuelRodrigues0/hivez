/* OmniRoute connection test harness.
 *
 * Compiles the real server-side code (lib/omniroute/client.ts +
 * api/omniroute-status.ts) into .tmp-esmtest/ with tsc (same pattern as the
 * verify-report local tests) and runs a PASS/FAIL matrix:
 *   A. configuration reading (defaults, overrides, [SENSITIVE] guard)
 *   B. error/branch handling against a local mock OpenAI-compatible server
 *      (401/429/500/invalid JSON/unreachable/timeout/missing key/auth header)
 *   C. live checks against the configured OmniRoute instance
 *   D. api/omniroute-status handler smoke test incl. secret-leak assertions
 *
 * Usage: node scripts/test-omniroute.mjs
 * Exit code 0 = no unexpected failures (live auth checks may be BLOCKED when
 * no real OMNIROUTE_API_KEY is configured yet).
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, ".tmp-esmtest");

const results = [];
let failures = 0;
let blocked = 0;

/** Sentinel for checks that cannot run yet (e.g. no real API key configured). */
class BlockedError extends Error {}

function record(name, status, note) {
  results.push({ name, status, note });
  if (status === "FAIL") failures++;
  if (status === "BLOCKED") blocked++;
  const tag = status === "PASS" ? "PASS  " : status === "BLOCKED" ? "BLOCK " : "FAIL  ";
  console.log(`${tag}${name}${note ? ` — ${note}` : ""}`);
}

async function step(name, fn) {
  try {
    const note = await fn();
    record(name, "PASS", typeof note === "string" ? note : undefined);
  } catch (error) {
    if (error instanceof BlockedError) {
      record(name, "BLOCKED", error.message);
      return;
    }
    record(name, "FAIL", error instanceof Error ? error.message : String(error));
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function loadEnvFile(file) {
  const full = path.join(ROOT, file);
  if (!existsSync(full)) return;
  for (const line of readFileSync(full, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    process.env[key] = value;
  }
}

// Load server env: Vercel-managed vars first, user-editable local vars win.
loadEnvFile(".env.vercel.local");
loadEnvFile(".env.local");


function startMock(handler) {
  return new Promise((resolve) => {
    const server = createServer(handler);
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

function mockJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function makeResShim() {
  const res = { code: 0, payload: undefined };
  res.status = (code) => {
    res.code = code;
    return { json: (payload) => (res.payload = payload) };
  };
  res.json = (payload) => {
    if (!res.code) res.code = 200;
    res.payload = payload;
  };
  return res;
}

console.log("=== OmniRoute connection test harness ===\n");
console.log("Step 1: compiling server code with tsc (type-check gate)");
writeFileSync(
  path.join(OUT_DIR, "tsconfig.omniroute.json"),
  JSON.stringify(
    {
      compilerOptions: {
        module: "nodenext",
        moduleResolution: "nodenext",
        target: "es2022",
        lib: ["es2023", "dom"],
        skipLibCheck: true,
        rootDir: "..",
        outDir: ".",
      },
      files: ["../lib/omniroute/client.ts", "../api/omniroute-status.ts"],
    },
    null,
    2,
  ),
);
execSync("npx tsc -p .tmp-esmtest/tsconfig.omniroute.json", { cwd: ROOT, stdio: "pipe" });
console.log("Compile OK (no TypeScript errors)\n");

const client = await import(pathToFileURL(path.join(OUT_DIR, "lib/omniroute/client.js")).href);

// Snapshot env files loaded BEFORE any test mutation (used to restore live env later).
const savedEnv = {
  OMNIROUTE_BASE_URL: process.env.OMNIROUTE_BASE_URL,
  OMNIROUTE_API_KEY: process.env.OMNIROUTE_API_KEY,
  OMNIROUTE_MODEL: process.env.OMNIROUTE_MODEL,
};

console.log("=== A. Configuration reading ===\n");

await step("A1 defaults when env vars unset", () => {
  delete process.env.OMNIROUTE_BASE_URL;
  delete process.env.OMNIROUTE_API_KEY;
  delete process.env.OMNIROUTE_MODEL;
  const config = client.getOmniRouteConfig();
  assert(config.baseUrl === "http://localhost:20128/v1", `unexpected baseUrl: ${config.baseUrl}`);
  assert(config.model === "auto", `unexpected model: ${config.model}`);
  assert(config.isConfigured === false, "isConfigured should be false without a key");
  return "baseUrl, model and isConfigured fall back to documented defaults";
});

await step("A2 env overrides applied + base URL normalized", () => {
  process.env.OMNIROUTE_BASE_URL = "http://example-host:9999/v1/";
  process.env.OMNIROUTE_API_KEY = "k-test";
  process.env.OMNIROUTE_MODEL = "custom-model";
  const config = client.getOmniRouteConfig();
  assert(config.baseUrl === "http://example-host:9999/v1", `trailing slash not stripped: ${config.baseUrl}`);
  assert(config.model === "custom-model", `unexpected model: ${config.model}`);
  assert(config.isConfigured === true, "isConfigured should be true with a key");
  return "remote-host style base URL works without code changes";
});

await step("A3 [SENSITIVE] redaction guard", () => {
  process.env.OMNIROUTE_API_KEY = "[SENSITIVE]";
  const config = client.getOmniRouteConfig();
  assert(config.isConfigured === false, "redacted placeholder must not count as configured");
  assert(config.apiKey === "", "redacted placeholder must not be used as a key");
  return "Vercel CLI [SENSITIVE] placeholder treated as missing";
});

console.log("");
console.log("=== B. Client error/branch handling (local mock OpenAI-compatible server) ===\n");

await step("B1 chat path, Authorization header and model plumbing", async () => {
  let seen = {};
  const { server, port } = await startMock(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    seen = {
      url: req.url,
      method: req.method,
      auth: req.headers.authorization,
      body: JSON.parse(Buffer.concat(chunks).toString("utf8")),
    };
    mockJson(res, 200, { model: "mock-model", choices: [{ message: { content: " pong " } }] });
  });
  try {
    process.env.OMNIROUTE_BASE_URL = `http://127.0.0.1:${port}/v1`;
    process.env.OMNIROUTE_API_KEY = "test-key";
    process.env.OMNIROUTE_MODEL = "auto";
    const result = await client.callOmniRouteChat({ messages: [{ role: "user", content: "ping" }] });
    assert(result.ok === true, `expected success, got ${JSON.stringify(result)}`);
    assert(result.text === "pong", `text not normalized: ${result.text}`);
    assert(result.model === "mock-model", `model not echoed: ${result.model}`);
    assert(seen.url === "/v1/chat/completions", `wrong path: ${seen.url}`);
    assert(seen.method === "POST", `wrong method: ${seen.method}`);
    assert(seen.auth === "Bearer test-key", `wrong Authorization header: ${seen.auth}`);
    assert(seen.body.model === "auto", `env model not used in body: ${seen.body.model}`);
    return "POST {baseUrl}/chat/completions with Bearer auth, response text normalized";
  } finally {
    server.close();
  }
});

await step("B2 HTTP 401 -> invalid_api_key", async () => {
  const { server, port } = await startMock((req, res) => mockJson(res, 401, { error: "nope" }));
  try {
    process.env.OMNIROUTE_BASE_URL = `http://127.0.0.1:${port}/v1`;
    process.env.OMNIROUTE_API_KEY = "wrong-key";
    const result = await client.callOmniRouteChat({ messages: [{ role: "user", content: "x" }] });
    assert(result.ok === false && result.error === "invalid_api_key", `got: ${JSON.stringify(result)}`);
    return "controlled invalid_api_key failure";
  } finally {
    server.close();
  }
});

await step("B3 HTTP 429 -> rate_limited", async () => {
  const { server, port } = await startMock((req, res) => mockJson(res, 429, {}));
  try {
    process.env.OMNIROUTE_BASE_URL = `http://127.0.0.1:${port}/v1`;
    process.env.OMNIROUTE_API_KEY = "k";
    const result = await client.callOmniRouteChat({ messages: [{ role: "user", content: "x" }] });
    assert(result.ok === false && result.error === "rate_limited", `got: ${JSON.stringify(result)}`);
    return "controlled rate_limited failure";
  } finally {
    server.close();
  }
});

await step("B4 HTTP 500 -> provider_unavailable", async () => {
  const { server, port } = await startMock((req, res) => mockJson(res, 500, {}));
  try {
    process.env.OMNIROUTE_BASE_URL = `http://127.0.0.1:${port}/v1`;
    process.env.OMNIROUTE_API_KEY = "k";
    const result = await client.callOmniRouteChat({ messages: [{ role: "user", content: "x" }] });
    assert(result.ok === false && result.error === "provider_unavailable", `got: ${JSON.stringify(result)}`);
    return "controlled provider_unavailable failure";
  } finally {
    server.close();
  }
});

await step("B5 non-JSON 200 body -> invalid_response", async () => {
  const { server, port } = await startMock((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end("<html>not json</html>");
  });
  try {
    process.env.OMNIROUTE_BASE_URL = `http://127.0.0.1:${port}/v1`;
    process.env.OMNIROUTE_API_KEY = "k";
    const result = await client.callOmniRouteChat({ messages: [{ role: "user", content: "x" }] });
    assert(result.ok === false && result.error === "invalid_response", `got: ${JSON.stringify(result)}`);
    return "controlled invalid_response failure";
  } finally {
    server.close();
  }
});

console.log("");
await step("B6 200 body with empty choices -> invalid_response", async () => {
  const { server, port } = await startMock((req, res) => mockJson(res, 200, { choices: [] }));
  try {
    process.env.OMNIROUTE_BASE_URL = `http://127.0.0.1:${port}/v1`;
    process.env.OMNIROUTE_API_KEY = "k";
    const result = await client.callOmniRouteChat({ messages: [{ role: "user", content: "x" }] });
    assert(result.ok === false && result.error === "invalid_response", `got: ${JSON.stringify(result)}`);
    return "no fabricated success from malformed payloads";
  } finally {
    server.close();
  }
});

await step("B7 connection refused -> unreachable (graceful)", async () => {
  // Grab a free port then release it so nothing is listening there.
  const { server, port } = await startMock((req, res) => mockJson(res, 200, {}));
  await new Promise((resolve) => server.close(resolve));
  process.env.OMNIROUTE_BASE_URL = `http://127.0.0.1:${port}/v1`;
  process.env.OMNIROUTE_API_KEY = "k";
  const result = await client.callOmniRouteChat({ messages: [{ role: "user", content: "x" }] });
  assert(result.ok === false && result.error === "unreachable", `got: ${JSON.stringify(result)}`);
  assert(typeof result.message === "string" && result.message.length > 0, "failure must carry a message");
  return "no crash on dead server; controlled unreachable error";
});

await step("B8 timeout handled via AbortController", async () => {
  const { server, port } = await startMock(() => {
    /* never respond */
  });
  try {
    process.env.OMNIROUTE_BASE_URL = `http://127.0.0.1:${port}/v1`;
    process.env.OMNIROUTE_API_KEY = "k";
    const result = await client.callOmniRouteChat({
      messages: [{ role: "user", content: "x" }],
      timeoutMs: 300,
    });
    assert(result.ok === false && result.error === "timeout", `got: ${JSON.stringify(result)}`);
    return "slow server surfaces as controlled timeout";
  } finally {
    server.closeAllConnections?.();
    server.close();
  }
});

await step("B9 missing API key -> missing_api_key without network call", async () => {
  let hit = false;
  const { server, port } = await startMock((req, res) => {
    hit = true;
    mockJson(res, 200, {});
  });
  try {
    process.env.OMNIROUTE_BASE_URL = `http://127.0.0.1:${port}/v1`;
    delete process.env.OMNIROUTE_API_KEY;
    const result = await client.callOmniRouteChat({ messages: [{ role: "user", content: "x" }] });
    assert(result.ok === false && result.error === "missing_api_key", `got: ${JSON.stringify(result)}`);
    assert(hit === false, "no request should be made without a key");
    return "fails fast and safely when unconfigured";
  } finally {
    server.close();
  }
});

await step("B10 models list endpoint parsed", async () => {
  let seenUrl = "";
  const { server, port } = await startMock((req, res) => {
    seenUrl = req.url;
    mockJson(res, 200, { data: [{ id: "model-a" }, { id: "model-b" }, { id: 42 }] });
  });
  try {
    process.env.OMNIROUTE_BASE_URL = `http://127.0.0.1:${port}/v1`;
    process.env.OMNIROUTE_API_KEY = "k";
    const result = await client.listOmniRouteModels();
    assert(result.ok === true, `got: ${JSON.stringify(result)}`);
    assert(seenUrl === "/v1/models", `wrong models path: ${seenUrl}`);
    assert(JSON.stringify(result.models) === JSON.stringify(["model-a", "model-b"]), `models: ${JSON.stringify(result.models)}`);
    return "GET {baseUrl}/models returns normalized id list (non-string ids dropped)";
  } finally {
    server.close();
  }
});

console.log("");
console.log("=== C. Live OmniRoute connection ===\n");

// Restore the env loaded from the env files before any test mutation.
if (savedEnv.OMNIROUTE_BASE_URL !== undefined) process.env.OMNIROUTE_BASE_URL = savedEnv.OMNIROUTE_BASE_URL;
if (savedEnv.OMNIROUTE_API_KEY !== undefined) process.env.OMNIROUTE_API_KEY = savedEnv.OMNIROUTE_API_KEY;
if (savedEnv.OMNIROUTE_MODEL !== undefined) process.env.OMNIROUTE_MODEL = savedEnv.OMNIROUTE_MODEL;

let liveReport = null;

await step("C1 live testOmniRouteConnection() runs and reports", async () => {
  liveReport = await client.testOmniRouteConnection();
  console.log(JSON.stringify(liveReport, null, 2));
  assert(liveReport && typeof liveReport === "object" && liveReport.checks, "report must contain checks");
  assert(liveReport.baseUrl, "report must include baseUrl");
  return `baseUrl=${liveReport.baseUrl} model=${liveReport.model} apiKeyConfigured=${liveReport.apiKeyConfigured}`;
});

await step("C2 report never leaks the API key or auth headers", async () => {
  assert(liveReport, "C1 must run first");
  const key = process.env.OMNIROUTE_API_KEY || "";
  const serialized = JSON.stringify(liveReport);
  assert(!key || !serialized.includes(key), "report contains the API key!");
  assert(!/authorization/i.test(serialized), "report references Authorization headers");
  return "secret-free report verified";
});

await step("C3 server reachable", async () => {
  assert(liveReport, "C1 must run first");
  const check = liveReport.checks.reachable;
  assert(check.ok === true, check.detail);
  return check.detail;
});

await step("C4 authentication accepted", async () => {
  assert(liveReport, "C1 must run first");
  const check = liveReport.checks.authentication;
  if (check.ok) return check.detail;
  if (liveReport.apiKeyConfigured) {
    throw new Error(check.detail);
  }
  throw new BlockedError(`${check.detail} Add the real OMNIROUTE_API_KEY to .env.local and re-run.`);
});

await step("C5 /v1/models endpoint responds", async () => {
  assert(liveReport, "C1 must run first");
  const check = liveReport.checks.modelsEndpoint;
  if (check.ok) return check.detail;
  if (!liveReport.apiKeyConfigured) {
    throw new BlockedError(`${check.detail} Pending real OMNIROUTE_API_KEY.`);
  }
  throw new Error(check.detail);
});

await step("C6 basic completion round-trip", async () => {
  assert(liveReport, "C1 must run first");
  const check = liveReport.checks.completion;
  if (check.ok) return check.detail;
  if (!liveReport.apiKeyConfigured || /rejected/i.test(liveReport.checks.authentication.detail)) {
    throw new BlockedError(`${check.detail} Pending real OMNIROUTE_API_KEY.`);
  }
  throw new Error(check.detail);
});

console.log("");
console.log("=== D. api/omniroute-status handler smoke test ===\n");

const handlerModule = await import(pathToFileURL(path.join(OUT_DIR, "api/omniroute-status.js")).href);

await step("D1 GET returns 200 secret-free structured report", async () => {
  process.env.OMNIROUTE_API_KEY = "CANARY-SECRET-abc123";
  const res = makeResShim();
  await handlerModule.default({ method: "GET" }, res);
  assert(res.code === 200, `expected HTTP 200, got ${res.code}`);
  const payload = res.payload;
  assert(payload && payload.checks, "handler must return a checks report");
  assert(typeof payload.apiKeyConfigured === "boolean" && payload.apiKeyConfigured === true, "apiKeyConfigured flag wrong");
  const serialized = JSON.stringify(payload);
  assert(!serialized.includes("CANARY-SECRET-abc123"), "handler response leaks the API key!");
  assert(!/authorization/i.test(serialized), "handler response references Authorization headers");
  return "handler returns report without any secret material";
});

await step("D2 non-GET method rejected with 405", async () => {
  const res = makeResShim();
  await handlerModule.default({ method: "POST" }, res);
  assert(res.code === 405, `expected HTTP 405, got ${res.code}`);
  return "POST rejected with method_not_allowed";
});

console.log("\n=== Summary ===");
for (const result of results) {
  console.log(`${result.status.padEnd(7)} ${result.name}${result.note ? ` — ${result.note}` : ""}`);
}
const passed = results.filter((r) => r.status === "PASS").length;
console.log(`\n${passed} passed, ${blocked} blocked (pending real API key), ${failures} failed`);
if (blocked > 0) {
  console.log("\nNOTE: blocked checks need the real OMNIROUTE_API_KEY in .env.local,");
  console.log("then re-run: node scripts/test-omniroute.mjs");
}
process.exit(failures === 0 ? 0 : 1);
