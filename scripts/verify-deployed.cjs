/* Live AI system verification script - tests the deployed Vercel endpoints */
const BASE = "https://www.hivez.in";

// Tiny 1x1 white JPEG (valid image for Gemini/provider checks)
const TINY_JPEG =
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q==";

async function getJSON(url) {
  const res = await fetch(url);
  const ct = res.headers.get("content-type") || "";
  let body;
  try { body = await res.text(); } catch { body = ""; }
  return { status: res.status, ct, body };
}

async function postJSON(url, payload, timeoutMs = 90000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await res.text();
    return { status: res.status, text };
  } catch (err) {
    return { status: 0, text: "ERROR: " + err.message };
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  console.log("=== 1. MODEL FILES BEING SERVED ===\n");
  for (const p of ["/models/garbage/model.json", "/models/lost-pet/model.json", "/models/electrical/model.json"]) {
    const r = await getJSON(BASE + p);
    const isServed = r.ct.includes("json") || r.body.startsWith("{");
    console.log(`${isServed ? "OK " : "BAD"} ${p} -> ${r.status} ${r.ct} len=${r.body.length} ${isServed ? "" : "(SPA fallback!)"}`);
  }
  for (const p of ["/models/garbage/weights.bin", "/models/lost-pet/weights.bin"]) {
    const r = await getJSON(BASE + p);
    console.log(`${!r.ct.includes("html") ? "OK " : "BAD"} ${p} -> ${r.status} ct=${r.ct} len=${r.body.length} ${!r.ct.includes("html") ? "" : "(SPA fallback!)"}`);
  }

  console.log("\n=== 2. /api/verify-report LIVE? ===\n");
  const probe = await postJSON(BASE + "/api/verify-report", {});
  console.log(`empty body -> HTTP ${probe.status}`);
  console.log(probe.text.slice(0, 300));

  console.log("\n=== 3. /api/verify-report WITH VALID IMAGE (checks all providers) ===\n");
  const a = await postJSON(BASE + "/api/verify-report", {
    categoryId: "road-damage",
    categoryTitle: "Broken Road",
    categoryDescription: "Potholes, cracks, or unsafe road damage",
    mimeType: "image/jpeg",
    imageBase64: TINY_JPEG,
    localModelResult: null,
  });
  console.log(`valid image -> HTTP ${a.status}\n`);
  try {
    const data = JSON.parse(a.text);
    if (data.ok) {
      console.log("finalDecision:", data.finalDecision);
      console.log("verificationScore:", data.verificationScore, "| agreement:", data.agreement);
      console.log("consensus.reason:", data.consensus?.reason);
      console.log("");
      for (const p of data.providers || []) {
        console.log(
          `${p.status === "completed" && p.success ? "COMPLETE" : p.status.toUpperCase().padEnd(9)}  ${p.provider.padEnd(26)} model=${p.model}  conf=${p.confidence ?? "-"}  ${p.success ? `relevant=${p.relevant} issue=${p.issueDetected} quality=${p.imageQuality}` : `reason=${p.reason}`}`
        );
      }
    } else {
      console.log("ok:false ->", JSON.stringify(data));
    }
  } catch {
    console.log("RAW RESPONSE:", a.text.slice(0, 600));
  }

  console.log("\n=== 4. /api/gemini-verify (legacy route) ===\n");
  const b = await postJSON(BASE + "/api/gemini-verify", {
    categoryId: "garbage",
    categoryTitle: "Garbage / Waste",
    mimeType: "image/jpeg",
    imageBase64: TINY_JPEG,
  });
  console.log(`valid image -> HTTP ${b.status}`);
  console.log(b.text.slice(0, 600));
}

main().catch((err) => { console.error("FATAL", err); process.exit(1); });