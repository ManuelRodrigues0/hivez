# Hivez — pocket notebook and feed cleanup

25 October 2026. Follow-up to the red/blue annotations on the signed-in feed.

## Completed changes

- Removed the **YOUR NEIGHBOURHOOD** navigation label.
- Removed the entire visible **Your feed / All hives** toolbar and **What's happening around you?** composer strip. Posts now begin directly beneath the navigation bar. A screen-reader-only page heading remains. Creating posts is still available through the existing navigation, and hive filtering remains available through the existing hive routes.
- Enlarged the original header bee from 108px to **124px** wide on large desktops, and from 88px to **104px** at smaller desktop widths. Reduced its left margin to bring its visible artwork closer to the Hivez wordmark. The original video, animation, transparency, and `object-fit: contain` are preserved.
- Replaced the right-hand promotional sections and hive list with a working **Pocket Notebook**: a ruled writing surface with Notice / Ask / Offer prompts, a character counter, device-save feedback, and a **Continue as a post** action.
- Notebook text is saved locally under a key scoped to the signed-in account. Saving is debounced; pending edits are flushed on navigation. An untouched notebook does not rewrite a stale value when unmounted. Prompt changes preserve the user's writing.
- Continue as a post opens the existing text composer with the full draft, including its last keystroke. It does not publish automatically. Drafts remain in this browser rather than syncing to a backend.
- If device storage is unavailable, the editor reports that honestly and still passes the current text into the composer.
- Added restrained, working links to the existing neighbourhood map and volunteering pages. The sidebar keeps the application's existing responsive visibility rules and scrolls internally when needed.

The old feed-strip and promotional-sidebar CSS was removed. No new runtime dependency, product image, backend service, authentication change, environment change, or production write was introduced.

## Research actually used

The following actual websites were opened in an isolated browser, scrolled, and captured. Each returned HTTP 200. Evidence is in `artifacts/notebook-refinement/research/`.

| Reference | Principle applied |
| --- | --- |
| [Are.na](https://www.are.na/) | Give people a useful place to capture an idea before asking them to share it. The public presentation was inspected; its authenticated application was not accessed. |
| [Every One Every Day — Practical Participation Systems](https://www.weareeveryone.org/about-participation-systems) | Participation can start with a resident's own observation or contribution. This informed the Notice / Ask / Offer prompts and emphasis on small, concrete ideas. |
| [GoodGym Missions](https://www.goodgym.org/missions) | Make the next practical action clear. This informed direct map and volunteering destinations rather than additional abstract promotional copy. |

The visual treatment uses Hivez's own typography, forest/ink/paper colours, and black/yellow dark appearance. No reference artwork or brand treatment was copied, and no community activity or statistics were fabricated.

## Actual verification

Testing used isolated Chrome on the user's `http://localhost:5174` development server, with synthetic accounts and the application's real Firebase clients redirected to the local demo emulators. No personal browser session or hosted data was used for mutations.

| Check | Result |
| --- | --- |
| New notebook browser flows | **6 groups passed**: annotated sections absent and posts at the top; prompt/focus/save/reload; immediate composer handoff and return; account separation; map/volunteering navigation; storage-failure fallback. |
| Existing social browser flows | **11 groups passed**, including actual local persistence for likes, saves, ReHives, replies, follows, messages, notifications, and volunteering membership; creation/navigation remained connected. Hive-filter checks now use the retained hive routes because the Home select was intentionally removed. |
| Responsive review | **144 route/theme/viewport states passed**, plus two scrolling/panel checks: **146 total checks**. Covered 12 routes, both app themes, and widths 320, 390, 768, 1024, 1440, and 1920px. No document overflow or outer-container gaps. |
| Accessibility | **16 axe WCAG A/AA audits passed** across feed, profile, saved posts, and search at desktop/mobile sizes in both themes. Keyboard focus and native editing were also exercised. This is automated coverage, not certification. |
| Runtime | No runtime exceptions or browser console errors in the completed notebook, social, or layout checks. |
| Production regression | Current compiled landing, login, and signup returned 200 and cycled through all three public themes without console errors or failed local requests. |
| Build / TypeScript | `npm run build` passed, including `tsc -b`. Existing large-bundle and `vite-tsconfig-paths` warnings remain. |
| Changed-component lint | Home, HiveNav, and NeighbourhoodContext: **zero errors and warnings**. |
| Scope / mascot integrity | **23 protected public/auth/onboarding source hashes unchanged; 31 tracked bee assets unchanged.** |

Visual review corrected inherited input styles that initially obscured the notebook ruling and added an inappropriate rounded focus frame. The final editor has visible ruling and a clear focus outline on its paper surface. The layout test now waits for existing fullscreen loading states to finish before measuring page gutters.

The new notebook follows existing sidebar breakpoints: the sidebar is hidden where the feed or open Updates panel needs that space. Header/mobile creation controls remain available at those widths. Live uploads, external AI responses, real push delivery, and physical camera capture were not re-tested for this change.

## Files changed in this follow-up

| File | Purpose |
| --- | --- |
| `src/pages/Home/Home.tsx` | Remove the marked toolbar/composer and keep the feed and reply flow. |
| `src/components/layout/HiveNav.tsx` | Remove the marked navigation label. |
| `src/components/layout/NeighbourhoodContext.tsx` | Replace promotional content with the functional, account-scoped pocket notebook. |
| `src/styles/workspace.css` | Bee size/spacing, notebook styling, focus treatment, sidebar scrolling, and removal of obsolete styles. |
| `tests/browser/pocket-notebook.mjs` | New real-browser notebook, composer-handoff, account-isolation, and storage-failure checks. |
| `tests/browser/workspace-flows.mjs` | Exercise hive filtering through retained routes after the Home filter's removal. |
| `tests/browser/feed-media-check.mjs` | Use a retained hive route rather than the removed Home filter. |
| `tests/browser/feed-refinement.mjs` | Wait for route/loading completion before measuring layouts. |
| `artifacts/notebook-refinement/` | Research, screenshots, browser results, build/lint logs, integrity checks, and production smoke evidence. |
| `POCKET_NOTEBOOK_REPORT.md` | This record. |
| Earlier redesign reports | Links to this latest follow-up so superseded toolbar/sidebar descriptions are clear. |

Evidence entry points: `notebook/results.json`, `flows/results.json`, `review/results.json`, `production/results.json`, `lint-final.json`, `build.log`, and `integrity.json` under `artifacts/notebook-refinement/`. Final light/dark desktop/mobile screenshots are under `review/`; the real composer handoff is under `notebook/`.

No deployment, commit, or Git push was performed.
