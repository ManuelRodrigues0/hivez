# Hivez landing-page redesign

Work performed locally, 24–25 October 2026. No deployment or production-data changes.

The bee's cursor-following behaviour was subsequently replaced with autonomous viewport flight at the user's request. See [BEE_ROAMING_REPORT.md](BEE_ROAMING_REPORT.md) for the current implementation and verification. The bee sections and test evidence below document the earlier redesign state.

## Executive summary

The public landing page has been rebuilt as an original neighbourhood field guide under the message **“Small acts. Big local change.”** It introduces Hivez through a deliberately illustrated local example, explains the progression from reporting to community action, lets visitors explore shared interests, and gives them a clear path into the existing signup or login flow.

The composition, copy, navigation presentation, typography, illustration, section sequence and interactions are new. The original bee artwork and flight identity remain intact. No authentication, Firebase, Firestore, Cloud Functions, schemas, security rules or backend business logic were changed.

## Product understanding and scope

The implementation was grounded in `AppRouter`, the existing landing page and its Git history, `ThemeContext`, the login/signup pages, report creation and category configuration, the map page, community pages, and volunteering/community-update services.

The implemented product supports reporting with media and location, nearby discovery, Hives around shared topics, community discussions, volunteer activities/groups, and progress/evidence workflows. Public visitors reach the landing page at `/`; authenticated users continue to reach the existing application at the same route. `/signup` and `/login` remain the public conversion destinations. The redesigned page does not bypass those route boundaries.

Unsupported numerical claims and promises of automatic municipal dispatch, sub-metre positioning, guaranteed fixes and universal AI verification were removed. All example map and journey content is labelled as illustrative. No example is represented as a real report, actual volunteer activity, live feed or product screenshot.

The initial working tree already contained changes to `.env.example`, `README.md`, `api/omniroute-status.ts`, `lib/omniroute/client.ts`, `package.json`, `scripts/test-omniroute.mjs`, and `vite.config.ts`, plus untracked local-server/API report files. These were preserved. Existing landing helpers that the new page does not use were left in place.

Installed versions inspected: React 19.2.7, TypeScript 6.0.3, Vite 8.0.16, GSAP 3.15.0 and lucide-react 1.21.0. No application dependencies were added.

## Research process and integrity

Research started at https://www.awwwards.com/ in both web retrieval and an actual isolated Chrome browser. The homepage, recent Sites of the Day, nominees, and Mobile & Apps listings were browsed. A `/websites/non-profit/` request returned mixed keyword results rather than a reliable category; it was not treated as a curated nonprofit category.

Catalogue pages inspected:

- https://www.awwwards.com/
- https://www.awwwards.com/websites/sites_of_the_day/
- https://www.awwwards.com/websites/nominees/
- https://www.awwwards.com/websites/mobile-apps/
- https://www.awwwards.com/websites/non-profit/ (limited usefulness, as noted above)

Ten project-presentation URLs were opened. Nine returned valid presentations; the attempted `/sites/two-good-co` URL returned 404 and supplied no design evidence. Eight associated live sites were attempted. Their actual access and interaction limits are recorded below. Awwwards award/nominee status is taken from the presentation, not inferred from a site's appearance.

| Reference and presentation | Live URL and actual inspection | Useful principle and implementation influence |
| --- | --- | --- |
| [Brandon Yasin, SOTD](https://www.awwwards.com/sites/brandon-yasin) | https://brandonyasin.com/ — desktop opening and scroll-driven horizontal project sequence inspected; pointer moved over the experience. Some images remained unloaded in the captured state. | Editorial pacing and strong typographic hierarchy. Hivez uses chapter markers and clear visual pauses. The reference's horizontal navigation and signature were not reproduced. |
| [ESR Bespoke, SOTD](https://www.awwwards.com/sites/esr-bespoke) | https://www.esrbespoke.au/ — opening animation and scroll attempted; the captured states remained in the extended introduction. No claim of testing its complete experience. | Its presentation demonstrates image hierarchy and a confident scale. Hivez uses one deliberately placed contextual image; its lengthy opening was not adopted. |
| [FORMAT, SOTD](https://www.awwwards.com/sites/format) | https://format.obys.agency/ — actual browser request returned a 403 page. The Awwwards presentation, technologies, and interaction descriptions were read. | Typography can carry identity. Live motion was not verified and is not claimed as a tested influence. |
| [Signal-A Studio, SOTD](https://www.awwwards.com/sites/signal-a-studio) | https://signal-a.studio/ — desktop opening, editorial type grid and scroll into case studies inspected. | Rule-based composition and the contrast of expressive headlines with quiet navigation. Hivez uses ruled section boundaries and serif emphasis; no scramble effect or replacement cursor was copied. |
| [Hope Cancer Resources, nominee](https://www.awwwards.com/sites/hope-cancer-resources) | https://hopecancerresources.org/ — headings, main hierarchy and scroll inspected. An embedded connection-verification restriction overlaid part of the hero; it was not bypassed. | Separate the human purpose from the practical next step. Hivez's community chapter explains participation in plain language. No impact statistics were borrowed. |
| [GoShuin, nominee](https://www.awwwards.com/sites/goshuin-every-stamp-a-memory) | https://aestudio.studio/goshuin/en — Next control clicked, page-turn state observed, then resized to 390 × 844 and inspected. | Tactile framing, chapter progression and genuinely different mobile composition. Hivez uses a field-guide idiom and a user-controlled journey, without copying the book or page-turn mechanic. |
| [PinReply, nominee](https://www.awwwards.com/sites/pinreply) | https://pinreply.com/ — homepage scrolled; optional measurement declined; Try the demo followed to https://pinreply.com/welcome/#practice and the labelled practice interface inspected. No extension installed. | Let a visitor understand a product through an honest example. Hivez's map pins and journey controls change useful explanatory content and are explicitly demonstrations. |
| [Destigmatize, SOTD](https://www.awwwards.com/sites/destigmatize) | https://destigmatize.ca/ — opening/loading state, scroll narrative and Menu interaction inspected. The captured menu was in transition; its final animation was not exhaustively tested. | A human invitation can anchor an expressive narrative. Hivez uses a short manifesto, restrained reveals and an invitation to participate. No campaign identity, footage or quiz was reused. |
| [Culture & Community Power Fund, HM](https://www.awwwards.com/sites/culture-community-power-fund) | https://cultureandcommunitypowerfund.org/ — desktop introduction and scroll through funding/community-power content inspected. | Community work benefits from direct editorial language, vivid accent colour and concrete explanation. Hivez translates this into its own palette and a collective-action story, without borrowing imagery or funding claims. |

Research did not include lab performance or accessibility audits of the reference sites, complete responsive testing of all references, or every link and interaction. Those claims are intentionally not made. Reference websites supplied principles, not code, artwork, brand assets or copied layouts.

## Creative direction and finished experience

The direction combines the clarity of a civic field guide with the warmth of a neighbourhood noticeboard:

- Oversized Bricolage Grotesque headlines, restrained Geist body text, and occasional editorial serif emphasis.
- Warm paper, deep moss, lime and terracotta; corresponding dark and light treatments use the existing theme preference.
- Original illustrated street blocks, park textures, markers and a compass make “local” tangible without claiming to show live data.
- Hexagonal motifs connect the surrounding graphic language to the protected bee identity.
- Deliberate changes of pace: a typographic opening, quiet manifesto, controlled journey, shared topic canvas, contextual image, questions, invitation and oversized footer.

Implemented sections and interactions:

1. Sticky navigation, theme control, motion control, skip link, existing authentication links, and a native modal mobile menu.
2. Hero with three accessible map pins. Each updates the example story and selected state.
3. Community-purpose manifesto.
4. Four-step journey with expanded explanations, matching illustration, progress indicators and a labelled example.
5. Four-topic Hive explorer with changing copy, icon, poster statement and capability tags.
6. Community/volunteering chapter using the repository's street image once.
7. Four native keyboard-operable FAQ disclosures, including an accurate explanation of assisted evidence checks.
8. Closing signup invitation, login handoff and complete footer navigation.

No scroll hijacking or forced horizontal progression was added. Reveal transitions use IntersectionObserver and do not hide content when reduced motion is enabled. Pointer effects update DOM/canvas directly rather than React state on every move. Event listeners, animation frames, GSAP tweens and observers are cleaned up.

## Assets and provenance

| Asset | Source and treatment |
| --- | --- |
| `public/assets/bee-fly.webm` | Original repository animation, unchanged. SHA-256 `501111bc4a6a1b1d1ed6a752aea9d70a61705301001437600948834eac7355fd`; 718,404 bytes. Compared byte-for-byte with `git show HEAD:public/assets/bee-fly.webm`. |
| `src/assets/hero-street.jpg` | Existing repository image, unchanged and used once. Its original licence/provenance is not documented in the repository. It is contextual neighbourhood imagery, not a claimed Hivez customer photograph or testimonial. No new third-party photograph was acquired. |
| `public/fonts/bricolage-grotesque-latin.woff2` | Self-hosted Latin font, 76,888 bytes, retrieved through the Google Fonts CSS API. Exact source: https://fonts.gstatic.com/s/bricolagegrotesque/v9/3y9K6as8bTXq_nANBjzKo3IeZx8z6up5BeSl9D4dj_x9PpZBMlGIInE.woff2 . SIL Open Font License, retained in `BricolageGrotesque-OFL.txt`. Licence source: https://raw.githubusercontent.com/google/fonts/main/ofl/bricolagegrotesque/OFL.txt . |
| Map, honeycomb poster and accents | Original SVG/CSS/React geometry created in this implementation. Standard interface icons use the already-installed lucide-react package. No reference artwork or external image server dependency. |

The page makes no runtime font request to Google. Existing Geist remains available from the installed font package. Font loading uses `font-display: swap`; the contextual image has intrinsic dimensions and lazy loading.

## Bee preservation and verification

The original landing implementation and history at `eda0466`, `9310cea` and `82b1a96` were inspected. Before editing, the existing bee was observed in the browser following mouse movement, including a position of `(250,390)` after a pointer position of `(350,450)` and visible flight toward a second position.

The original border-connected matte renderer was extracted into `BeeChromaVideo`. Its asset path, 5% crop on each edge, 320 × 180 processing dimensions, flood-fill treatment, colour thresholds and artwork proportions are preserved. `BeeMascot.tsx` and all mascot source artwork/animation files were left unchanged.

The original pointer-following math is retained: pointer X minus 100, pointer Y minus 60, horizontal direction flip, tilt limited to ±20 degrees, 0.7-second response and `power2.out` easing. The existing animated hexagonal field and proximity emphasis remain, with theme-appropriate contrast. The surrounding page does not replace the bee with a stationary hero illustration.

Reduced motion freezes the video and follows the pointer immediately without rotational lag. Coarse/touch devices do not mount the cursor renderer or its hidden video, leaving touch scrolling and tapping unobstructed. Desktop video and canvas work pause when the document is hidden. The native pointer stays available.

Browser measurements and event-cleanup results are recorded in `artifacts/landing/browser-results.json`; final results are summarised below after verification.

## Files changed by this redesign

| File | Purpose |
| --- | --- |
| `src/pages/Landing/Landing.tsx` | Complete page composition, product-grounded copy, local metadata lifecycle and scoped reveal observation. |
| `src/styles/landing.css` | Scoped visual system, layouts, theme variants, responsive rules, motion and contrast treatment. |
| `src/components/landing/LandingNavbar.tsx` | Navigation, native dialog menu, existing theme/motion settings and auth links. |
| `src/components/landing/NeighbourhoodMap.tsx` | Original map illustration and three explanatory pin interactions. |
| `src/components/landing/ActionJourney.tsx` | Four-step interactive example and matching presentation. |
| `src/components/landing/HiveExplorer.tsx` | Topic selection and contextual community explanations. |
| `src/components/landing/BeeCursor.tsx` | Preserved flight behaviour and honeycomb field, responsive pointer handling and cleanup. |
| `src/components/landing/BeeChromaVideo.tsx` | Extracted original video rendering with motion/visibility pause handling. |
| `public/fonts/bricolage-grotesque-latin.woff2` | Locally served display font. |
| `public/fonts/BricolageGrotesque-OFL.txt` | Font licence. |
| `scripts/verify-landing.mjs` | Repeatable isolated Chrome interaction, responsive, lifecycle and optional axe audit. Uses external test tooling, no app dependency changes. |
| `artifacts/landing/*` | Actual review screenshots and machine-readable final browser evidence. |
| `LANDING_REDESIGN_REPORT.md` | This report. |

## Iterative review and verification

The existing localhost server was verified by its process command line (`D:\hivez\node_modules\vite\bin\vite.js`, PID 5444) and by opening its actual page at http://localhost:5173/ before editing. The title and original heading confirmed the expected application. That pre-existing server was reused and left running.

The Chrome connector initially reported no available browser. Native Computer Use then stopped because it could not confidently determine the current browser URL. Existing browser windows were left alone. An isolated Playwright-controlled Chrome process, using the installed Chrome executable, provided research and local browser verification. No security warning or access restriction was bypassed.

Review cycles included both desktop themes, each section through the footer, and mobile composition. Subsequent changes increased undersized captions/body copy, loosened tracking after switching to the variable font, corrected poster-art overlap, removed hidden touch-device video work, fixed mobile paragraph spacing, improved large-font heading sizing, and darkened six low-contrast light-theme text instances found by axe. A final manual audit put the image caption on a solid dark background. Mobile reverse-Tab testing exposed a modal focus edge case; explicit first/last focus wrapping was added and verified.

The browser harness also needed two corrections: it initially counted Playwright's own hit-target mouse interceptor as an application listener, and it initially checked auth fields before React had rendered the destination. The harness now excludes its interceptor and waits for the actual form. These were test assumptions, not authentication changes.

A separate diagnostic confirmed that this Chrome/Playwright combination changes `(pointer: fine)` and `(hover: hover)` from false to true when capturing a full-page mobile screenshot. The final mobile tests use viewport captures, which preserve touch emulation, and verify that no cursor renderer is mounted. Desktop full-page captures are unaffected by that limitation.

### Final check results

The final browser run exited successfully with **19 passing checks**, no page/console errors, and no HTTP responses at or above 400 during the recorded flows. Evidence: [browser-results.json](artifacts/landing/browser-results.json).

| Check | Actual result |
| --- | --- |
| Production build | `npm run build` passed on the final source; 3,958 modules transformed, final Vite phase 14.99 seconds. Includes the project's `tsc -b`. |
| Dedicated TypeScript check | `node node_modules/typescript/bin/tsc -b --pretty false` exited 0. |
| Changed TSX lint | Explicit ESLint invocation covering Landing and all six supporting landing components exited 0, with no warnings. |
| Broader landing-folder lint | An earlier wildcard check also covered unchanged helpers. It found the pre-existing `@typescript-eslint/no-explicit-any` error at `src/components/landing/SplitHeading.tsx:83`. That unrelated file was not edited. |
| Settings regression tests | `npm run test:settings -- --pool=threads --maxWorkers=1`: **32 tests passed**, 1 file passed. The default forks run first timed out while starting its worker and ran no tests; the successful retry is reported separately. |
| Local-server tests | `npm run test:local`: **4 tests passed**. |
| Keyboard | Skip link moves focus into main; all four FAQ disclosures open/close with Enter; mobile dialog wraps focus, Escape closes it and returns focus; menu section navigation closes the dialog. |
| Navigation/auth boundary | All internal anchors exist; conversion links point only to the existing `/signup` and `/login`; four actual CTA handoffs rendered the auth email fields. No form was submitted. |
| Lifecycle | The application mouse listener count is 1 on landing, 0 after navigation to auth, and 1 after remount, repeated four times. Playwright's own interceptor is excluded. |
| Bee movement | Pointer `(1000,500)` produced translation `(900,440)`; pointer `(300,300)` produced `(200,240)`. The transform's horizontal sign reversed. Decoded canvas contained 15,997 nontransparent and 41,603 transparent pixels; the original video was playing at time 3.520539 seconds. |
| Reduced motion | Video paused; moving to `(600,350)` immediately placed the bee at `(500,290)`. System reduced motion was also checked in the touch context. |
| Responsive | No document overflow at 320, 390, 620, 768, 1024, 1440 and 1920 pixels. Mobile taps changed topic content. At 390 pixels, the 18-pixel root font setting retained the viewport and heading bounds. |
| Theme and accessibility settings | Light, dark, system reduced motion, large text and high contrast were exercised using the existing context/preferences. |
| Automated accessibility | axe-core 4.14.0, WCAG 2 A/AA and 2.1 AA tags: **zero violations** in desktop light, desktop dark, mobile dark with reduced motion, mobile light, and mobile high contrast with large text. |
| Runtime/network | Empty error and failed-response arrays in the final browser report. No missing font, image or mascot asset response was observed. |
| Diff hygiene | `git diff --check` passed for changed landing sources. |

Automated accessibility is not a complete accessibility certification. Axe left manual contrast items involving pseudo-elements, rotated/overlaid content, decorative SVG labels and a decorative indicator (9 desktop / 10 mobile nodes), plus a desktop autoplay-audio review item. These are not reported as automatic passes. The relevant solid colour pairs were checked separately: highlighted heading **10.61:1**, light supporting copy on its surface **5.00:1**, dark supporting copy **6.68:1**, and photo caption **14.75:1**. The SVG street labels and indicator are aria-hidden decoration. The original video was verified to have `muted: true` and `loop: true`. See [accessibility-manual-review.json](artifacts/landing/accessibility-manual-review.json).

Final visual evidence:

- [Desktop hero, light](artifacts/landing/desktop-hero-light.png), [dark](artifacts/landing/desktop-hero-dark.png).
- [Complete desktop page, light](artifacts/landing/desktop-light.png), [dark](artifacts/landing/desktop-dark.png).
- [Mobile hero, light](artifacts/landing/mobile-light.png), [dark](artifacts/landing/mobile-dark.png).
- Mobile viewport reviews: [manifesto](artifacts/landing/mobile-manifesto.png), [journey](artifacts/landing/mobile-journey.png), [Hives](artifacts/landing/mobile-hives.png), [community](artifacts/landing/mobile-community.png), [FAQ](artifacts/landing/mobile-faq.png), [invitation](artifacts/landing/mobile-invitation.png), [footer](artifacts/landing/mobile-footer.png).
- Bee at two actual pointer destinations: [right](artifacts/landing/bee-1000.png), [left](artifacts/landing/bee-300.png).
- `first-desktop-light.png` and `first-desktop-dark.png` retain the initial implementation review state; these are not the original pre-redesign page.

## Remaining limitations

No known blocking landing-page defect remains in the tested flows. The complete application still emits Vite warnings about large chunks (approximately 1.86 MB and 1.08 MB before gzip) and the existing `vite-tsconfig-paths` configuration. Its eager route architecture and build configuration were left unchanged; no baseline bundle-size comparison is claimed.

The untouched `SplitHeading.tsx` lint error remains. The inherited image's original licence provenance remains undocumented. Actual account creation, Google authentication, authenticated reporting/volunteering transactions, real-device Safari testing and screen-reader certification were outside this signed-out landing-page verification. Reference-site access limits are listed in the research table. No deployment was performed.

## Reproducing the browser checks

Use the existing dev server, or run the project's usual dev command. Confirm that the supplied base URL serves this checkout. The script accepts the base URL and output folder:

```powershell
node scripts/verify-landing.mjs http://localhost:5173 artifacts/landing
```

Playwright must be available externally. If it is not a project dependency, set `HIVEZ_PLAYWRIGHT_MODULE` to its installed `index.mjs` file URL and `HIVEZ_CHROME_PATH` to the Chrome executable. Set `HIVEZ_AXE_SCRIPT` to an installed `axe-core/axe.min.js` file to enable audits. This run used axe-core 4.14.0 from the official npm registry; the downloaded audit tool is not an application asset.

The checks follow links and inspect auth forms, but never submit credentials, create accounts, post reports, join real activities, or write production data. They do not validate authenticated business workflows or a real Google sign-in transaction.

## Concepts deliberately not implemented

A horizontal scroll takeover, replacement cursor, book-style page turning, WebGL city, fake product dashboard, animated statistics, new AI claims and additional photography were considered unnecessary for this product story. No reference-specific layout or signature interaction was copied. The result uses existing React/CSS/GSAP capabilities and original vector geometry.
