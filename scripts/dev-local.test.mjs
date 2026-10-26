import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { once } from "node:events";
import os from "node:os";
import path from "node:path";
import { ensureOmniRoute, localConfig } from "./dev-local.mjs";

async function mock(status = 200) {
  const server = createServer((_req, res) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ data: [{ id: "test-model" }] }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return { server, port: server.address().port };
}

test("a running router is reused and never stopped by this launcher", async () => {
  const { server, port } = await mock();
  try {
    const config = { baseUrl: `http://127.0.0.1:${port}/v1`, apiKey: "test-key" };
    const result = await ensureOmniRoute(config, { cliPath: "does-not-exist" });
    assert.equal(result.started, false);
    result.stop();
    assert.equal((await fetch(`${config.baseUrl}/models`)).status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("a rejected key fails clearly without starting a second router", async () => {
  const { server, port } = await mock(401);
  try {
    await assert.rejects(ensureOmniRoute({ baseUrl: `http://127.0.0.1:${port}/v1`, apiKey: "test-key" }, {
      cliPath: "does-not-exist",
    }), /rejected the key/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("a stopped router is launched, awaited, and stopped with its process tree", async () => {
  const { server, port } = await mock();
  await new Promise((resolve) => server.close(resolve));
  const dir = mkdtempSync(path.join(os.tmpdir(), "hivez-local-"));
  let router;
  try {
    const cliPath = path.join(dir, "mock-cli.mjs");
    writeFileSync(cliPath, `
      import {createServer} from 'node:http';
      const port = Number(process.argv[process.argv.indexOf('--port') + 1]);
      createServer((req,res) => {
        res.writeHead(req.headers.authorization === 'Bearer test-key' ? 200 : 401, {'Content-Type':'application/json'});
        res.end(JSON.stringify({data:[{id:'test-model'}]}));
      }).listen(port, process.env.HOSTNAME);
    `);
    const config = { baseUrl: `http://127.0.0.1:${port}/v1`, apiKey: "test-key", port, host: "127.0.0.1" };
    router = await ensureOmniRoute(config, { cliPath, logPath: path.join(dir, "router.log") });
    assert.equal(router.started, true);
    assert.equal((await fetch(`${config.baseUrl}/models`)).status, 401);
    const exited = once(router.child, "exit");
    router.stop();
    await exited;
    await assert.rejects(fetch(`${config.baseUrl}/models`));
  } finally {
    router?.stop();
    // Only remove the test directory created under the OS temporary directory.
    assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep + "hivez-local-"));
    rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});

test("local configuration refuses remote hosts before any credentials are sent", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "hivez-local-"));
  const saved = {};
  for (const key of ["OMNIROUTE_BASE_URL", "OMNIROUTE_API_KEY"]) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  try {
    writeFileSync(path.join(dir, ".env.local"), "OMNIROUTE_BASE_URL=https://example.com/v1\nOMNIROUTE_API_KEY=test-key\n");
    assert.throws(() => localConfig(dir), /Local mode requires/);
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep + "hivez-local-"));
    rmSync(dir, { recursive: true, force: true });
  }
});
