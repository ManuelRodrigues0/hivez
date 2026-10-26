# Hivez — photographic auth experience and bee companion

25 October 2026. This replaces the first auth direction after feedback about its small decorations and drawings. Work is local; no deployment or push was performed.

## What changed

Login and signup now use a full-height community photograph beside a clear, generous form. The hexagonal seal, doodles, handwritten annotations, oversized editorial greeting, chapter numbers and miniature decorative copy have been removed. Existing Bricolage typography, forest ink, warm off-white surfaces, theme controls and original Hivez identity remain.

The photographic panel explains three useful parts of Hivez through **Notice**, **Connect** and **Act** controls. Selecting one changes the real photograph, headline and explanatory copy. It never claims to show current Hivez activity or members. The image remains a compact contextual header on phones, so the form stays the main task.

The bee has a much more prominent place above the form and a discoverable invitation to say hello. It is the original bee, rendered from the original source assets. A click plays its wave and shows “Hey, neighbour!”; focusing a password plays the original shy clip and holds its actual closed-eye pose. This makes the interaction useful and visible rather than another decorative drawing.

## Signup as a short guided interaction

Signup is now two steps:

1. **Your details:** required full name and valid email, with the existing Google option.
2. **Your password:** password, the existing six-character minimum, confirmation, visibility controls and the length guide.

Continue validates the first step. The second step shows the chosen email and an Edit details control. Returning to the first step preserves entered values. Each step change focuses the new heading. Only the final Create account action calls the existing signup service; no account is created by Continue. Login, Google sign-in, recovery, errors, pending states and the original local redirect continue through their existing services and routing.

The existing signup service still accepts only email and password. As before, the full name is validated in the UI but is not persisted by that service; this pre-existing limitation was not changed through backend or schema edits.

## How the bee works

- Original still, fly, wave and shy files are retained byte-for-byte. The image’s colour, facial features, proportions and transparency are untouched.
- Entrance uses its existing fly clip once, within a fixed place in the composition.
- Email/name focus and clicking the bee use its original wave. Clips do not loop or stack.
- Password focus takes priority over a previous greeting. Inspection of the original 4.07-second shy clip showed a genuine covered-eye pose around 1.5–2.5 seconds. Playback pauses at **1.7 seconds** while password focus is active. This is an original video frame, not a fabricated facial expression.
- Blurring the field restores the normal state; confirming matching passwords can trigger the existing wave.
- The “No peeking.” caption accompanies the real covered-eye pose. The form’s password controls still independently mask/reveal text.
- The character makes a restrained translation into its privacy pose. It does not follow the pointer or roam autonomously.
- Reduced motion shows the original still. The preference is observed live, and application motion settings are honoured.
- Hidden-document playback pauses. A held privacy frame stays held through visibility changes. Media-query and visibility listeners are cleaned up.
- The transparent artwork frame has `pointer-events: none`; only the small central button receives interaction. Tested geometry keeps that button away from account-access navigation and form controls.

The original assets remain:

| File | SHA-256 |
| --- | --- |
| newbee2.png | `c7bcb068e22434f6f74d854702150b9ca29f771e07e77a8097f245e2f7b47e68` |
| bee-fly.webm | `501111bc4a6a1b1d1ed6a752aea9d70a61705301001437600948834eac7355fd` |
| bee-wave.webm | `c905afa9419b828d61c8dddb24e15566841283ecaf4078ec49654256fc494c89` |
| bee-shy.webm | `fd174ab9bbe3eec023eb20c9d35d434b57a9334df6c7347999feb124d7ffa0a6` |

## Photography and references

All three photos were downloaded, visually inspected, and served locally at 1800×1200. Total image payload is approximately 1.05 MB. The [Pexels license](https://www.pexels.com/license/) was inspected: it permits free website use and modification and prohibits implying endorsement. The people are not described as Hivez participants. Photographer/source credits accompany the selected desktop image; complete provenance is in [public/auth/SOURCES.md](public/auth/SOURCES.md).

| Asset | Photographer and actual source |
| --- | --- |
| `public/auth/people-together.jpg` | Anna Shvets — [volunteers collecting litter in a field](https://www.pexels.com/photo/volunteers-collecting-trash-on-green-grass-field-5029859/) |
| `public/auth/shared-street.jpg` | Gustavo Denuncio — [people gathered on a city street](https://www.pexels.com/photo/urban-gathering-with-people-in-city-street-31998709/) |
| `public/auth/local-action.jpg` | Ron Lach — [volunteers cleaning a forest](https://www.pexels.com/photo/a-cleanup-community-picking-up-recyclables-in-the-forest-9543414/) |

Earlier Awwwards browser research remains recorded in the historical [auth research report](AUTH_REDESIGN_REPORT.md). The useful principles retained here are Signal-A’s form clarity, Brandon Yasin’s confident use of photography and editorial hierarchy, and GoShuin’s meaningful user-controlled transitions. The live Signal-A contact page, Brandon’s menu, GoShuin’s page controls/mobile state, and Awwwards’ login fields were actually inspected. FORMAT’s live site returned 403; no live behaviour from that site is claimed. This revision uses original composition and existing Hivez identity rather than reference-site artwork or copied interactions.

## Files changed in this revision

| File | Purpose |
| --- | --- |
| `src/components/hivez/AuthExperience.tsx` | New composition and two-step signup state, validation, focus and retained values. Existing auth calls retained. |
| `src/components/hivez/AuthWelcome.tsx` | Replaces the illustrated seal with the photographic community story. |
| `src/components/hivez/AuthCompanion.tsx` | New prominent bee host and contextual captions. |
| `src/components/hivez/BeeMascot.tsx` | Greeting callback and original shy-pose hold; original asset imports preserved. |
| `src/components/hivez/AuthBackdrop.tsx` | Simplified header/home navigation and footer. |
| `src/pages/Auth/Auth.css` | Complete replacement of the first auth direction with photographic layouts, larger form controls, responsive behaviour and companion placement. |
| `public/auth/*` | Three verified stock photographs and source/license notes. |
| `scripts/verify-auth.mjs` | Updated interaction suite for both signup steps, retained details, photography controls and actual closed-eye hold. |
| `scripts/verify-auth-accessibility.mjs` | Audits login and both signup steps in two themes and widths. |
| `AUTH_REDESIGN_REPORT.md` | Marks the previous direction as historical. |
| `AUTH_RESTYLE_REPORT.md` | This current report. |
| `artifacts/auth/revision*` | Actual review screenshots, asset-frame inspection and updated browser/audit evidence. |

The first task’s AuthField improvements, thin Login/Signup route wrappers and real password recovery remain. The landing page, original mascot files, authentication/user services, Firebase configuration, router, profile completion and unrelated local OmniRoute edits were preserved. No dependencies were added.

## Review and verification

The prior result was opened in local Chrome before this restyle. The first new implementation was reviewed at desktop and phone sizes. It was then refined to separate the bee from its captions/navigation, fix mobile headline line breaks, preserve high contrast over photography, and prevent its transparent frame from intercepting clicks. The original shy video was inspected at multiple time points to locate its genuine eye-covering pose before implementing the hold.

The interaction suite checks one bee and no roamer; keyboard entry; login validation; both visibility states; a real Firebase rejected-login response; intercepted reset request/confirmation; real Google popup initiation with the provider page intercepted; both signup steps and Edit details; intercepted registration/pending/error handling; one-shot wave and genuine privacy hold; all three photographic controls; responsive themes; reduced motion; large text; source hashes; and runtime errors.

Registration/reset responses are intercepted only in the isolated test browser. The application contains no mock authentication or fake success path. No real account was created or reset email sent. Completed successful authentication, Google OAuth and receipt/use of a real recovery email require real account credentials and were not tested.

Final verification used the freshly compiled application at **http://localhost:5175/login** and **http://localhost:5175/signup**. Its HTTP 200 document referenced the current `index-Dw3PkFf9.js` bundle before the final run.

| Final check | Actual result |
| --- | --- |
| `npm run build` | Passed, including `tsc -b`; 3,558 modules transformed and Vite completed in 2.46 seconds. Existing plugin/chunk warnings remain. |
| Focused ESLint | AuthExperience, AuthCompanion, AuthWelcome, AuthBackdrop, AuthField, BeeMascot and Login passed. |
| Production browser suite | **15 checks passed** on the compiled bundle. [Machine-readable evidence](artifacts/auth/revision-production/browser-results.json). |
| Password privacy | The real media element paused with its original eyes-covered pose at 1.7 seconds; actual rendered screenshot reviewed. |
| Responsive behaviour | Both routes at 320, 390, 768, 1024 and 1440px; password step additionally reviewed at 390 and 1440px. No horizontal overflow or bee target/control intersection in the checked states. |
| Accessibility | **12 states, zero violations** for the selected WCAG 2 A/AA and 2.1 A/AA tags: login, signup details and signup passwords × light/dark × 390/1440px. [Audit evidence](artifacts/auth/revision-production/accessibility-results.json). |
| Runtime | No unhandled exceptions or unexpected console errors in the completed suite. Expected Firebase test 400 responses were accounted for. |
| Artwork/scope | Original asset hashes match. No changes to landing code/styles, Firebase configuration, auth/user services or routing. |
| Diff formatting | `git diff --check` passed. |

Reviewed final screenshots: [login](artifacts/auth/revision-production/login-1440-light.png), [signup](artifacts/auth/revision-production/signup-1440-dark.png), [phone signup](artifacts/auth/revision-production/signup-390-light.png), [password step](artifacts/auth/revision-production/signup-passwords-390-light.png), and [original eye-covering reaction](artifacts/auth/revision-production/bee-shy.png).

The original CompleteProfile `no-explicit-any` lint finding and existing Vite plugin/bundle-size warnings remain outside this revision. Axe checks selected WCAG tags in the auth surface; they are not a complete accessibility certification. Real-device Safari and native screen-reader sessions were not tested.
