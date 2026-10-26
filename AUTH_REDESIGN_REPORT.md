# Hivez — login and signup redesign

> Historical first direction. Superseded after design feedback by the photographic restyle and bee companion documented in [AUTH_RESTYLE_REPORT.md](AUTH_RESTYLE_REPORT.md).

Implemented locally on 25 October 2026. Preview: http://localhost:5175/login and http://localhost:5175/signup. No deployment or Git push was performed for this task.

## The finished direction

The authentication experience is a **neighbourhood welcome desk**. “Come on in.” welcomes returning members; “Good things start with you.” invites new ones. Large Bricolage Grotesque headlines, an italic editorial voice, thin rules, a quiet form, and an original hexagonal welcome seal give the pages their identity. The form sits directly on warm paper rather than inside the previous rounded glass card. Both pages use the landing page’s existing font, off-white paper, forest ink, subtle borders, and restrained warmth. The existing dark theme has a corresponding forest/paper treatment.

The two routes share a frame and account-access navigation, but have different headline scale, copy, and form rhythm. Links switch with React Router without reloading the document. The original bee occupies one deliberate position beside the welcome message; it never roams on these pages. Mobile gets a compact welcome seal beside the introduction, with a small independent bee interaction target.

No new photography, generated images, mascot artwork, fonts, application dependencies, or image-server requests were introduced. The existing local Bricolage font is reused. The seal is original SVG geometry around the unchanged mascot, rather than a replacement bee or borrowed reference artwork.

## Product and existing-flow inspection

Inspected Login, Signup, AuthField, AuthBackdrop, BeeMascot, Auth.css, AppRouter, AuthContext, ThemeContext, the Firebase client, the existing auth/user services, the landing page and its brand/navigation styles, original auth assets, and recent Git history. Both original routes and the landing page were opened in local Chrome before editing. Baseline screenshots are in `artifacts/auth/before-login.png` and `before-signup.png`.

The existing services call Firebase email/password authentication and Google popup sign-in, then create the existing user document where appropriate. AppRouter uses the live auth state and `profileCompleted` to select the public experience, profile completion, or authenticated application. Those services, configuration, providers, router, schema and profile-completion implementation were preserved.

The existing “Forgot password?” link only pointed to `#reset`; there was no reset form or reset call. It now opens a real recovery flow using Firebase’s existing `sendPasswordResetEmail` API and existing auth instance. The former “Remember me” control changed local UI state but never configured Firebase persistence. It has been removed; Firebase’s existing persistence behaviour is unchanged.

## Research actually performed

Research used an isolated Playwright-controlled installed Chrome browser. The Awwwards homepage, Portfolio and Animation listings, five project presentations, four accessible live reference sites, and Awwwards’ own login experience were opened. Pages were scrolled and screenshots/DOM notes captured. No reference code, imagery or distinctive composition was copied into Hivez.

Catalogue pages:

- https://www.awwwards.com/
- https://www.awwwards.com/websites/portfolio/
- https://www.awwwards.com/websites/animation/

| Reference | Actual inspection | Principle used in Hivez |
| --- | --- | --- |
| [Signal-A Studio presentation](https://www.awwwards.com/sites/signal-a-studio), [live site](https://signal-a.studio/) | Desktop introduction and scroll inspected. Followed the visible Contact link to [its actual contact page](https://signal-a.studio/contact); inspected the ruled form and field hierarchy. | Expressive editorial identity can coexist with plain, legible controls. Hivez uses restrained field rules and a clear label/input hierarchy. |
| [Brandon Yasin presentation](https://www.awwwards.com/sites/brandon-yasin), [live site](https://brandonyasin.com/) | Opening and scroll states inspected; opened the live Menu and observed its magazine-like panels. Some imagery remained unloaded in a captured opening state. | Distinct chapters can share a stable visual frame. Hivez’s account-access links and coordinated greetings use continuity without reproducing the reference’s navigation mechanism. |
| [Emotion Agency presentation](https://www.awwwards.com/sites/emotion-agency-1), [live site](https://emotion-agency.com/) | Presentation, opening/loading state and scroll attempted. Captured the extended loading state; did not exhaustively test its WebGL experience. | Motion needs a purpose and should not delay access. Hivez uses a short form reveal and discrete character reactions; no loading gate or WebGL was added. |
| [FORMAT presentation](https://www.awwwards.com/sites/format), [attempted live site](https://format.obys.agency/) | Presentation inspected; actual live request returned HTTP 403. No live interaction is claimed. | Typography and proportion can carry a complete identity. No interaction from the inaccessible site was adopted. |
| [GoShuin presentation](https://www.awwwards.com/sites/goshuin-every-stamp-a-memory), [live site](https://aestudio.studio/goshuin/en) | Opening, Next/page transition and 390px mobile state inspected in the browser. | Tactile visual language can support useful interaction. Hivez’s welcome seal and small editorial annotations are original to this product; no stamp-book artwork or page-turn was copied. |
| [Awwwards login](https://www.awwwards.com/login/) | Actual fields, social options and hierarchy inspected; focused the visible first input. No account submission. | Keep the practical task easy to identify even when the surrounding page is expressive. Hivez provides a clear primary action and a separate Google entry point. |

Research evidence is in `artifacts/auth/research/`: `baseline-inspection.json`, `presentations.json`, `inspection.json`, `interactions-second.json`, and screenshots. Initial interaction attempts targeted hidden or differently named elements; the second inspection corrected those selectors and recorded successful contact/menu/field interactions. FORMAT’s 403 remains an access limitation. Reference-site performance, full accessibility compliance, every route and every responsive state were not audited.

## Form behaviour

- Email/password login and account creation continue to call the existing `login` and `signup` services.
- Google entry continues to call the existing `googleLogin` service; it opens the real Firebase provider popup.
- Name and email requirements, the six-character signup password minimum, and confirmation-password matching remain. Login does not impose the signup minimum on existing passwords.
- Labels remain visible. Blur/submit feedback is associated with each input using `aria-describedby` and `aria-invalid`; invalid submission focuses the first relevant field. Server errors are announced as alerts.
- Both password fields have independent Show/Hide controls, proper autocomplete hints, and accessible names.
- The signup length guide describes actual password length, without claiming a password is secure based solely on its length or adding new server validation rules.
- Pending actions disable inputs and submit/provider controls. A ref prevents duplicate requests before React commits the loading state. Errors preserve entered values and allow retry.
- Recovery reuses the entered email, sends the existing Firebase reset request, presents neutral account-existence wording, and returns focus when switching views.
- The existing `from` redirect is retained across account-access links. Only local application paths are accepted. Success still navigates with replacement; AppRouter retains its existing profile-completion guard.
- Decorative confetti and the old timed error-state resets were removed. The form remains usable independently of animation playback.

## Protected bee and reactions

The asset files are byte-identical to the originals:

| Original source | SHA-256 |
| --- | --- |
| `src/assets/auth/newbee2.png` | `c7bcb068e22434f6f74d854702150b9ca29f771e07e77a8097f245e2f7b47e68` |
| `src/assets/auth/bee-fly.webm` | `501111bc4a6a1b1d1ed6a752aea9d70a61705301001437600948834eac7355fd` |
| `src/assets/auth/bee-wave.webm` | `c905afa9419b828d61c8dddb24e15566841283ecaf4078ec49654256fc494c89` |
| `src/assets/auth/bee-shy.webm` | `fd174ab9bbe3eec023eb20c9d35d434b57a9334df6c7347999feb124d7ffa0a6` |

The existing still, fly, wave and shy imports are retained. Rendering preserves object-fit, aspect ratio and transparency. The old repeating spin, scale, jump and mood decorations were removed; no expressions are invented by distorting the image.

| Trigger | Implemented reaction |
| --- | --- |
| Page entrance | Original fly clip once at the assigned position; then original still image. |
| Email/name focus | Original wave once; returns to still after the clip. |
| Password/confirmation focus or visibility toggle | Original shy clip. Password focus takes priority over an earlier wave and cancels that greeting. The shy clip holds its last frame while focused, then returns to normal on blur. |
| Matching confirmation on blur | Original wave as a brief acknowledgement. |
| Resolved authentication | Existing success path requests a wave/happy reaction and immediately continues through navigation. No artificial delay or unsupported celebratory animation is inserted. Its visible duration depends on the existing auth guard. |
| Click/tap/keyboard activate the bee | Original wave; repeated taps do not stack simultaneous clips. |
| Errors | Calm form feedback and the normal bee, without sad/confused blame reactions. |

No gaze/eye-tracking animation was fabricated; no such source clip exists among the selected original animations. The original wave runs for 7.5 seconds and is not looped. Every clip is non-looping. There is one bee component; no autonomous landing roamer is mounted. Movement of the pointer does not move it. The reduced-motion preference is observed live, as is the application motion setting. Both show the original still image. Visibility changes pause playback, and all listeners are cleaned up.

The clickable target covers the visible centre of the bee, with at least a 44px target. Its transparent image margin cannot cover form/navigation targets. Browser geometry checks confirmed no intersection with fields, primary/provider buttons or mode links at all tested sizes.

## Browser review, refinement and evidence

The initial redesign and subsequent refinements were rendered in the actual local app. Visual inspection covered both complete pages, form errors, recovery, bee wave/shy states, dark/light themes and responsive states. Review found and fixed:

1. An initial focus effect that moved focus during React Strict Mode’s second mount pass, interfering with the skip link.
2. A mobile layout that put the bee below the entire form; it now accompanies the introduction.
3. A transparent bee interaction area extending into a mobile mode link; the target now fits its visible centre.
4. The animation library’s hook failing to update this component on a live reduced-motion change; a subscribed media query now controls playback.
5. An unnamed icon-only mobile home link; it now has an explicit accessible name.
6. A prior wave delaying the password reaction; the shy clip now immediately takes priority.

The development server at port 5173 became unavailable during a concurrent build, interrupting a test. Final testing uses the freshly built application from this repository’s Vite preview at **http://localhost:5175/**. The report under `artifacts/auth/final/` records intermediate development runs, including the interrupted run. The authoritative completed interaction run is [production/browser-results.json](artifacts/auth/production/browser-results.json).

### Verification results

| Check | Actual evidence |
| --- | --- |
| Production build/type check | `npm run build` (`tsc -b && vite build`) passed. Existing Vite tsconfig-plugin and bundle-size warnings remain. |
| Dedicated TypeScript command | `node node_modules/typescript/bin/tsc -b --pretty false` passed during implementation. |
| Focused ESLint | AuthExperience, AuthWelcome, AuthBackdrop, AuthField, BeeMascot and Login passed. |
| Signup file lint | One existing `no-explicit-any` error remains in the untouched CompleteProfile catch block. It was present before this task. |
| Production browser suite | 14 checks passed, covering validation, request boundaries, pending state, recovery, provider initiation, SPA switching, bee reactions, responsive layouts, preferences, artwork integrity and browser runtime. |
| Real Firebase boundary | A nonexistent reserved-domain login returned HTTP 400 from the real Firebase sign-in endpoint; the UI displayed useful credential feedback and allowed retry. |
| Registration boundary | Entered email/password reached the existing signup service. The browser intercepted the outgoing request and returned `EMAIL_EXISTS`; pending/error feedback passed. No production account was created. |
| Google initiation | The real Firebase popup opened with `providerId=google.com`. Its provider page was intercepted in the isolated test browser; popup-close feedback and retry passed. No Google account was authenticated. |
| Recovery boundary | Real SDK reset request shape (`PASSWORD_RESET`, entered email) verified using an intercepted success response. Confirmation and return flow passed. No email was sent. |
| Responsive/theming | Both routes at 320, 390, 768, 1024 and 1440px; no horizontal overflow or bee/control intersection. Desktop and mobile light/dark screenshots captured. |
| Large text | 20px root font at 390px, with high contrast enabled; no horizontal overflow. Screenshot visually reviewed. |
| Motion | Live system and app preferences suppress clips; password privacy, one-shot wave completion, click reaction and stable position observed. |
| Automated accessibility | axe-core 4.10.3: zero WCAG 2 A/AA and 2.1 A/AA violations in eight route/theme/width combinations, scoped to the auth page. [Results](artifacts/auth/final/accessibility-results.json). |
| Console | No unhandled page exceptions or unexpected console errors in the completed production suite. Expected Firebase test 400 responses were accounted for. |
| Scope preservation | No diffs to landing components/styles, router, auth context, auth/user services or Firebase configuration from this task. CompleteProfile body compared with HEAD and found identical after normalising line endings. Original asset hashes verified. |

Key screenshots: [login desktop](artifacts/auth/production/login-1440-light.png), [signup desktop](artifacts/auth/production/signup-1440-light.png), [login mobile](artifacts/auth/production/login-390-light.png), [signup mobile](artifacts/auth/production/signup-390-light.png), [dark signup](artifacts/auth/production/signup-1440-dark.png), [recovery](artifacts/auth/production/password-recovery.png), [large text](artifacts/auth/production/large-text-high-contrast.png).

## Files changed for this task

| File | Purpose |
| --- | --- |
| `src/components/hivez/AuthExperience.tsx` | Coordinated form state, existing-service calls, validation, recovery, feedback and account-access content. |
| `src/components/hivez/AuthWelcome.tsx` | Original welcome-seal composition and the single original mascot. |
| `src/components/hivez/AuthBackdrop.tsx` | Shared frame, landing-consistent identity, home navigation, theme/motion controls and footer. |
| `src/components/hivez/AuthField.tsx` | Visible labels, associated hints/errors, focus styling and accessible password visibility. |
| `src/components/hivez/BeeMascot.tsx` | Original asset renderer with deliberate single-play reactions, priority, small target, preference and visibility handling. Only auth consumes this component. |
| `src/pages/Login/Login.tsx` | Login route delegates to the shared auth experience. |
| `src/pages/Signup/Signup.tsx` | Signup route delegates to the shared auth experience; CompleteProfile is retained verbatim. |
| `src/pages/Auth/Auth.css` | Replaces obsolete auth styles with isolated `ha-` styles, responsive compositions, themes, contrast and reduced-motion rules. |
| `scripts/inspect-auth-references.mjs` | Browser catalogue/presentation/live-reference inspection utility. |
| `scripts/inspect-auth-interactions.mjs` | Targeted reference contact/menu/page-turn/form inspection. |
| `scripts/verify-auth.mjs` | Repeatable real-browser interaction and rendering verification with explicit safe request interception. |
| `scripts/verify-auth-accessibility.mjs` | Browser axe checks across routes, themes and widths. |
| `artifacts/auth/*` | Before/iteration/production screenshots, reference notes and verification evidence. |
| `AUTH_REDESIGN_REPORT.md` | This report. |

Pre-existing OmniRoute/local-development modifications, environment files and earlier recording extracts were preserved. No package or lockfile changes were needed by this redesign. Prettier was used as temporary formatting tooling only.

## Verification limits and existing issues

Successful login with a real member’s credentials, a new real account, completed Google OAuth, receipt/use of an actual reset email, and the authenticated post-login redirect were **not exercised**. No credentials were supplied and no production accounts or data were created. Request-boundary tests are explicitly distinguished above from real successful authentication. The application contains no mock success path; interception exists only in the browser test harness.

The pre-existing signup service accepts email and password only. The existing full-name field remains required as before, but this redesign does not add name persistence or alter the auth/user service. This existing data-flow limitation requires a separately scoped auth/profile change.

Native screen-reader sessions and real-device Safari were not tested. The axe result is an automated audit, not a certification of complete accessibility compliance. Existing whole-application bundle warnings and the existing CompleteProfile lint issue remain.

To reproduce the browser runs, provide an external Playwright module through `HIVEZ_PLAYWRIGHT_MODULE` (or an installed `playwright`), optionally `HIVEZ_CHROME_PATH`, and a local axe script path in `HIVEZ_AXE_PATH` for the accessibility script. No browser tooling was added to application dependencies.
