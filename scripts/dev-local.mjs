import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { createServer, loadEnv } from "vite";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function localConfig(root = ROOT) {
  const env = loadEnv("development", root, "OMNIROUTE_");
  const baseUrl = env.OMNIROUTE_BASE_URL?.trim().replace(/\/+$/, "");
  const apiKey = env.OMNIROUTE_API_KEY?.trim();
  if (!baseUrl || !apiKey || apiKey === "[SENSITIVE]") {
    throw new Error("Set OMNIROUTE_BASE_URL and OMNIROUTE_API_KEY in .env.local first.");
  }
  const url = new URL(baseUrl);
  if (url.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    || url.username || url.password || url.search || url.hash || url.pathname !== "/v1") {
    throw new Error("Local mode requires http://localhost:20128/v1 (or another loopback port) in .env.local.");
  }
  return { baseUrl, apiKey, port: Number(url.port || 80), host: url.hostname === "[::1]" ? "::1" : "127.0.0.1" };
}

async function modelsReady({ baseUrl, apiKey }) {
  let response;
  try {
    response = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(1500),
    });
  } catch {
    return false;
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error("OmniRoute rejected the key in .env.local. Copy a valid inference key from its dashboard.");
  }
  if (!response.ok) return false;
  const payload = await response.json();
  if (!Array.isArray(payload.data)) throw new Error("The configured local port is not serving an OmniRoute model list.");
  return true;
}

function findCli() {
  const local = path.join(ROOT, "node_modules/omniroute/bin/omniroute.mjs");
  if (existsSync(local)) return local;
  const npmCli = process.env.npm_execpath || path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");
  const result = spawnSync(process.execPath, [npmCli, "root", "-g"], { encoding: "utf8", windowsHide: true });
  const global = path.join(result.stdout?.trim() || "", "omniroute/bin/omniroute.mjs");
  if (result.status === 0 && existsSync(global)) return global;
  throw new Error("OmniRoute is not installed. Run: npm install -g omniroute");
}

export async function ensureOmniRoute(config, { cliPath, logPath = path.join(ROOT, "omniroute.local.log") } = {}) {
  if (await modelsReady(config)) return { started: false, stop() {} };

  const env = { ...process.env, HOSTNAME: config.host, API_HOST: config.host, PORT: String(config.port) };
  // Hivez client settings must not replace the router's own persisted server secrets.
  for (const key of ["OMNIROUTE_BASE_URL", "OMNIROUTE_API_KEY", "OMNIROUTE_MANAGEMENT_API_KEY"]) delete env[key];
  const cli = cliPath || findCli();
  const log = createWriteStream(logPath, { flags: "a" });
  const child = spawn(process.execPath, [cli, "serve", "--port", String(config.port), "--no-open", "--no-tray", "--log"], {
    cwd: ROOT,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    detached: process.platform !== "win32",
  });
  child.stdout.pipe(log, { end: false });
  child.stderr.pipe(log, { end: false });
  let spawnError;
  child.on("error", (error) => { spawnError = error; });
  const stop = () => {
    if (child.pid && child.exitCode === null) {
      if (process.platform === "win32") {
        spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
      } else {
        try { process.kill(-child.pid, "SIGTERM"); } catch { /* Already stopped. */ }
      }
    }
    log.end();
  };
  const interrupt = () => { stop(); process.exit(0); };
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", interrupt);
  try {
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      if (spawnError || child.exitCode !== null) throw new Error(`OmniRoute could not start. Check ${logPath}.`);
      if (await modelsReady(config)) return { started: true, stop, child };
      await delay(500);
    }
    throw new Error(`OmniRoute did not become ready. Check ${logPath}.`);
  } catch (error) {
    stop();
    throw error;
  } finally {
    process.removeListener("SIGINT", interrupt);
    process.removeListener("SIGTERM", interrupt);
  }
}

async function existingHivez(config) {
  try {
    const response = await fetch("http://localhost:5173/api/omniroute-status", { signal: AbortSignal.timeout(30_000) });
    const status = await response.json();
    return response.ok && status.baseUrl === config.baseUrl && status.apiKeyConfigured;
  } catch {
    return false;
  }
}

async function main() {
  const config = localConfig();
  if (process.argv.includes("--check")) {
    if (!await modelsReady(config)) throw new Error("OmniRoute is stopped. Run npm run dev:local to start it.");
    console.log(`Local OmniRoute is ready at ${config.baseUrl}; the saved API key is accepted.`);
    return;
  }
  console.log("Starting local Hivez + OmniRoute...");
  const omni = await ensureOmniRoute(config);
  console.log(`OmniRoute ${omni.started ? "started" : "already running"}: ${config.baseUrl.replace(/\/v1$/, "/home")}`);
  let vite;
  let stopping = false;
  const shutdown = async (code = 0) => {
    if (stopping) return;
    stopping = true;
    await vite?.close();
    omni.stop();
    process.exit(code);
  };
  process.once("SIGINT", () => { void shutdown(); });
  process.once("SIGTERM", () => { void shutdown(); });
  omni.child?.once("exit", () => { if (!stopping) void shutdown(1); });
  try {
    if (await existingHivez(config)) {
      console.log("Hivez already running: http://localhost:5173");
      if (!omni.started) return;
    } else {
      vite = await createServer({ root: ROOT, server: { host: "localhost" } });
      await vite.listen();
      vite.printUrls();
    }
    console.log("Keep this PowerShell window open. Ctrl+C stops processes started by this command.");
  } catch (error) {
    console.error(error.message);
    await shutdown(1);
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
