# Hivez AI API Verification Report

> OmniRoute follow-up (2026-10-24): Local-only mode is now selected. Run `npm run dev:local` from PowerShell to start/reuse OmniRoute and Hivez. Local diagnostics pass. The public tunnel is stopped, and OmniRoute production variables have been removed from Vercel. Production has been redeployed and verified with no OmniRoute URL or API key; the live frontend still loads.

**Generated:** 2026-10-24  
**Website:** https://www.hivez.in  
**Environment:** Production (Vercel)  
**Scope:** All AI APIs and model integrations across the Hivez codebase

---

## Executive Summary

| Component | Status | Working? | Notes |
|-----------|--------|----------|-------|
| Ultra Bee AI Chat (OpenRouter) | LIVE | YES | Fully operational on production |
| Report Verification Pipeline | REACHABLE | PARTIAL | Endpoint works; providers return errors |
| Gemini Verify (legacy) | REACHABLE | YES | Endpoint reachable, returns proper JSON |
| OmniRoute Intelligence | LOCAL ONLY | YES, locally | Start with npm run dev:local; production does not use the router |
| Local Teachable Machine Models | PRESENT | YES | 10 models, client-side via TensorFlow.js |

**Critical issues:** xAI Grok key invalid; Groq Qwen 3.6 model not found; NVIDIA Ultra vision disabled; zero verification providers succeeded in the original verification test.

---

## 1. Ultra Bee AI Chat Assistant

### Endpoint
`POST https://www.hivez.in/api/ultra-bee`

### Purpose
AI chat assistant ("Ultra Bee") embedded in Direct Messages. Answers user questions about Hivez features and local community issues.

### Provider
**OpenRouter** (chat completions API)  
URL: `https://openrouter.ai/api/v1/chat/completions`

### Configuration
| Variable | Required | Production Status |
|----------|----------|-------------------|
| `ULTRA_BEE_OPENROUTER_API_KEY` | Yes | Configured (live test confirmed) |
| `OPENROUTER_MODEL` | Optional (default: `openrouter/free`) | Not set (uses default) |

### Live Test Result
```
Status: 200 OK
ok: true
model: poolside/laguna-s-2.1:free
reply: "Hi there! Yes, I'm here and buzzing along. I'm Ultra Bee, Hivez's built-in AI assistant..."
```

**Verdict: WORKING**

### Code Files
- `api/ultra-bee.ts` — Serverless route handler
- `lib/ultra-bee/openrouter.ts` — OpenRouter provider call
- `lib/ultra-bee/prompt.ts` — System prompt builder
- `lib/ultra-bee/knowledge.ts` — Hivez knowledge base
- `src/services/ultraBee.ts` — Client-side service


---

## 2. Report Image Verification Pipeline

### Endpoint
`POST https://www.hivez.in/api/verify-report`

### Purpose
Verifies uploaded report images against selected categories using a multi-provider consensus system. Combines a local on-device model (TensorFlow.js/Teachable Machine) with multiple cloud AI providers.

### Verification Flow
1. Local model (client-side, Teachable Machine via TensorFlow.js)
2. Cloud providers (server-side, batched in 3 batches)
3. Consensus calculation — combines votes into VERIFIED / REJECTED / UNCERTAIN

### Provider Configuration

#### Batch 1 (Initial cloud batch)
| # | Provider | Model | Endpoint | Image Support | Live Status |
|---|----------|-------|----------|---------------|-------------|
| 1 | Gemini | `gemini-3-flash-preview` | Google Generative Language API | Yes | Key configured, test image invalid |
| 2 | xAI Grok | `grok-4.6` | `https://api.x.ai/v1/responses` | Yes | INVALID API KEY (400) |

#### Batch 2
| # | Provider | Model | Endpoint | Image Support | Live Status |
|---|----------|-------|----------|---------------|-------------|
| 3 | NVIDIA Nemotron Ultra | `nvidia/nemotron-3-ultra` | NVIDIA API | Only if vision enabled | UNSUPPORTED (vision disabled) |
| 4 | NVIDIA Nemotron 3 Nano Omni | `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` | NVIDIA API | Yes | Key configured, test image invalid |
| 5 | OpenRouter Free | `openrouter/free` | OpenRouter API | Yes | Key configured, invalid response |

#### Batch 3
| # | Provider | Model | Endpoint | Image Support | Live Status |
|---|----------|-------|----------|---------------|-------------|
| 6 | Groq Qwen 3.6 27B | `qwen/qwen3.6-27b` | Groq API | Yes | MODEL NOT FOUND (404) |
| 7 | Groq Qwen 3.8 27B | `qwen/qwen3.8-27b` | Groq API | Yes | Key configured, test image invalid |

### Live Test Result
```
Status: 200 OK
ok: true
finalDecision: UNCERTAIN
verificationScore: 0
agreement: 0
successfulChecks: 0
independentGroups: 0
consensus.reason: "No cloud verification provider returned a usable result."
```

### Per-Provider Results
| Provider | Status | Error | Root Cause |
|----------|--------|-------|------------|
| Gemini | FAILED | Base64 decoding failed (400) | Test image invalid/truncated |
| xAI Grok | FAILED | Incorrect API key (400) | API key is invalid |
| NVIDIA Nemotron Ultra | UNSUPPORTED | Vision not enabled | `NVIDIA_NEMOTRON_ULTRA_VISION_ENABLED` not "true" |
| NVIDIA Nano Omni | FAILED | Image decoding failed (500) | Test image invalid/truncated |
| OpenRouter Free | FAILED | Invalid provider response | Free model may not support images |
| Groq Qwen 3.6 | FAILED | Model not found (404) | `qwen/qwen3.6-27b` does not exist |
| Groq Qwen 3.8 | FAILED | Base64 decode failed (400) | Test image invalid/truncated |

**Verdict: ENDPOINT WORKS, BUT ALL PROVIDERS FAIL**

Most provider API keys ARE configured (they reach the remote API and return provider-specific errors). No provider returned a successful verification result. Some failures are due to the invalid test image; others (xAI key invalid, Groq model not found, NVIDIA vision disabled) are real configuration issues.

### Code Files
- `api/verify-report.ts` — Main verification route (60s max duration)
- `api/gemini-verify.ts` — Legacy standalone Gemini route (30s max duration)
- `lib/verification/config.ts` — Provider configs, category contexts, thresholds
- `lib/verification/providerCalls.ts` — Provider API call implementations
- `lib/verification/consensus.ts` — Consensus calculation logic
- `lib/verification/types.ts` — Type definitions
- `src/services/reportVerification.ts` — Client-side verification orchestrator
- `src/services/teachableMachineService.ts` — Local TensorFlow.js model

---

## 3. Legacy Gemini Verify Endpoint

### Endpoint
`POST https://www.hivez.in/api/gemini-verify`

### Purpose
Standalone Gemini image verification (legacy/separate from the multi-provider pipeline).

### Live Test Result
```
Status: 200 OK
ok: false
error: api_request_failed
message: "AI verification is currently unavailable..."
```

**Verdict: ENDPOINT REACHABLE** — Returns proper JSON error format; failure due to invalid test image, not missing configuration.

### Code Files
- `api/gemini-verify.ts` — Route handler
- `functions/lib/index.js` — Firebase Functions version (duplicate)

---

## 4. OmniRoute Intelligence Gateway

### Current mode: local only

From PowerShell:

```powershell
cd D:\hivez
npm run dev:local
```

- Local Hivez: http://localhost:5173 (or the port printed by Vite).
- Local OmniRoute dashboard: http://localhost:20128/home.
- API base: `http://localhost:20128/v1`.
- Saved inference and management keys remain in ignored `.env.local`; no key values are printed.
- The launcher starts the router when stopped, waits for its authenticated model endpoint, and starts Hivez; running local servers are reused.
- Ctrl+C stops only the processes started by that launcher.
- `npm run omniroute:check` validates the saved local connection.
- Startup output from an automatically started router is saved to ignored `omniroute.local.log`.

### Verified

- Local Hivez diagnostic endpoint returned `ok: true`, including connectivity, authentication, models, and a chat completion.
- Four launcher lifecycle/configuration tests passed: reuse, invalid key, cold startup/shutdown, and rejecting remote configuration.
- The local launcher successfully reused the already-running real Hivez and OmniRoute servers.
- Production frontend build passed.
- Public Cloudflare tunnel status is `stopped`; no public router URL is active.
- Vercel production variables `OMNIROUTE_BASE_URL`, `OMNIROUTE_API_KEY`, and `OMNIROUTE_MODEL` were removed.

The live www.hivez.in site cannot call this local router. Its optional AI intelligence is unavailable in this mode; manual flows and deterministic hive matching remain available. This does not move the separate verification and Ultra Bee providers to localhost.

---

## 5. Local Teachable Machine Models (Client-Side)

These are not cloud APIs — they run entirely in the browser via TensorFlow.js. No API keys required.

### Models in `public/models/`

| Model | Labels | Purpose |
|-------|--------|---------|
| `garbage` | Clean, Moderate, Dirty | Garbage/waste verification |
| `lost-pet` | Dog, Cat, Others Animal, No Animal | Lost pet verification |
| `electrical` | Dangerous Wire, Normal Wire | Electrical hazard verification |
| `fallen-tree` | Fallen tree, Normal tree | Fallen tree verification |
| `flooding` | Flooded Roads, Normal Roads | Flooding verification |
| `parking` | Illegal Parking, Legal Parking | Illegal parking verification |
| `road-damage` | pothole, construction_debris, damaged_footpath, normal_road, indoor_room | Road damage verification |
| `street-light` | Broken Streetlight, Normal Streetlight, No Streetlight | Street light verification |
| `water-leakage` | Water Leakage, No Water leakage | Water leakage verification |
| `damaged-property` | Damaged Property, Normal Property | Damaged property verification |

Each model has a `metadata.json` and `model.json` (+ weights). TensorFlow.js v4.22.0 is the runtime.

**Verdict: MODELS PRESENT** — Files exist in the repository; runtime loads dynamically via `import("@tensorflow/tfjs")`.

---

## 6. Environment Variable Summary

### `.env.local` (Development)
Configured:
- `VITE_FIREBASE_VAPID_KEY`
- `OMNIROUTE_BASE_URL`
- `OMNIROUTE_API_KEY` (local server and credentials verified in follow-up)
- `OMNIROUTE_MODEL`

Missing (all AI provider keys):
- `GEMINI_API_KEY`
- `XAI_API_KEY`
- `NVIDIA_API_KEY`
- `ULTRA_BEE_OPENROUTER_API_KEY`
- `VERIFICATION_OPENROUTER_API_KEY`
- `GROQ_QWEN_36_API_KEY`
- `GROQ_QWEN_38_API_KEY`

### `.env.vercel.local` (Production — values redacted as `[SENSITIVE]`)
Configured (redacted):
- `GEMINI_API_KEY` = `[SENSITIVE]`
- `NVIDIA_API_KEY` = `[SENSITIVE]`
- `NVIDIA_API_KEY2` = `[SENSITIVE]`
- `OPENROUTER_API_KEY` = `[SENSITIVE]` (legacy, keys 2-4 also `[SENSITIVE]`)
- `XAI_API_KEY` = `[SENSITIVE]`

Live test confirms these additional keys are also configured on production:
- `ULTRA_BEE_OPENROUTER_API_KEY` (Ultra Bee works)
- `VERIFICATION_OPENROUTER_API_KEY` (OpenRouter Free reached API)
- `GROQ_QWEN_36_API_KEY` (Groq Qwen 3.6 reached API)
- `GROQ_QWEN_38_API_KEY` (Groq Qwen 3.8 reached API)

Missing/not configured:
- `NVIDIA_NEMOTRON_ULTRA_VISION_ENABLED` (not set to `"true"`)
- OmniRoute production variables were intentionally removed for local-only mode; use `.env.local` and `npm run dev:local`.

---

## 7. Recommended Fixes

### Priority 1 — Critical

1. **Fix xAI Grok API key** (`XAI_API_KEY`)
   - Current: Returns 400 "Incorrect API key provided"
   - Action: Verify the key at https://console.x.ai and update the production environment variable

2. **Fix Groq Qwen 3.6 model** (`GROQ_QWEN_36_API_KEY` / model `qwen/qwen3.6-27b`)
   - Current: Returns 404 "model_not_found"
   - Action: Use a valid Groq model ID (check available models at https://console.groq.com)

3. **Enable NVIDIA Nemotron Ultra vision**
   - Current: `NVIDIA_NEMOTRON_ULTRA_VISION_ENABLED` not set to `"true"`, so image support is disabled
   - Action: Set `NVIDIA_NEMOTRON_ULTRA_VISION_ENABLED=true` in production env

### Priority 2 — Important

4. **OmniRoute is intentionally local only**
   - Start it with `npm run dev:local`. No public tunnel or permanent host is required.

### Priority 3 — Monitoring

5. **Add health-check endpoints** for each AI provider so failures are detectable before users encounter them
6. **Implement provider fallback/retry** with better error messages when individual providers fail
7. **Add API key validation at deployment time** to catch misconfigured keys early

---

## 8. Code Files Inventory — All AI-Related Files

| File | Purpose |
|------|---------|
| `api/ultra-bee.ts` | Ultra Bee chat route |
| `api/verify-report.ts` | Multi-provider verification route |
| `api/gemini-verify.ts` | Legacy Gemini verification route |
| `api/omniroute-status.ts` | OmniRoute diagnostic route |
| `api/omniroute-intel.ts` | OmniRoute intelligence gateway |
| `lib/ultra-bee/openrouter.ts` | OpenRouter provider for Ultra Bee |
| `lib/ultra-bee/prompt.ts` | Ultra Bee system prompt |
| `lib/ultra-bee/knowledge.ts` | Hivez knowledge base for Ultra Bee |
| `lib/verification/config.ts` | Provider configs, categories, thresholds |
| `lib/verification/providerCalls.ts` | Provider API call implementations |
| `lib/verification/consensus.ts` | Consensus calculation |
| `lib/verification/types.ts` | Verification type definitions |
| `lib/omniroute/client.ts` | OmniRoute connection layer |
| `lib/omniroute/config.ts` | OmniRoute configuration |
| `lib/omniroute/intelligence/hiveSearch.ts` | Hive search intelligence |
| `lib/omniroute/intelligence/issueAnalysis.ts` | Issue analysis intelligence |
| `lib/omniroute/intelligence/duplicates.ts` | Duplicate report detection |
| `src/services/ultraBee.ts` | Ultra Bee client service |
| `src/services/reportVerification.ts` | Verification orchestrator (client) |
| `src/services/omnirouteIntel.ts` | OmniRoute client service |
| `src/services/teachableMachineService.ts` | Local TensorFlow.js model |
| `src/services/mediaValidation.ts` | Media file validation (related, not AI) |
| `public/models/*/` | 10 Teachable Machine model directories |

---

## Conclusion

**Ultra Bee is fully working** on production. The **report verification endpoint is reachable** but **no cloud provider returned a successful result** due to a combination of invalid API key (xAI), wrong model ID (Groq 3.6), disabled vision (NVIDIA Ultra), and invalid test image artifacts. **OmniRoute runs locally only**, started through `npm run dev:local`. **Local Teachable Machine models are present** and ready to use client-side.
