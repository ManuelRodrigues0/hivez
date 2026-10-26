# Hivez — feed and layout refinements

Latest follow-up: [Pocket notebook and feed cleanup](POCKET_NOTEBOOK_REPORT.md) records the subsequent removal of the compact toolbar/composer, larger and closer header bee, and replacement of the right sidebar.

25 October 2026. Follow-up to the marked screenshots of the feed and profile.

## Implemented

- Removed the entire “Good things happen around here” introduction and its separate Share an update CTA. The feed now begins with a compact heading/filter toolbar, the working composer prompt, and posts.
- Removed the capped, centred outer page widths from profiles, discovery, hives, saved posts, notifications, volunteering, profile editing, settings content, and standalone content wrappers. Page containers fill their available space beside navigation and the optional Updates panel. Modest internal padding and readable text lengths remain.
- Hid scrollbar tracks throughout the signed-in experience, including the navigation rail. Scrolling remains enabled; this does not use `overflow: hidden` to suppress scrolling.
- Enlarged the original masthead bee's video box from 76px to 108px wide on large desktops, with an 88px version at smaller desktop widths. It uses the exact same WebM and `object-fit: contain`. The logo, search, and controls remain separate and usable.
- Replaced standalone rounded post cards with a continuous, transparent stream separated by thin rules. Removed the legacy dark hover card treatment as well. Author details lead into quieter hive context, readable post text, contained media, and the existing social actions.
- Single images retain their natural aspect ratio and intrinsic sizing, within a 440px desktop / 380px mobile height limit. Portraits no longer sit inside an oversized wide letterbox. Full-resolution viewing remains available.
- Kept horizontal multi-image galleries and their existing full-screen viewer, controls, and keyboard navigation. The new media variant is opt-in for feed posts; other MediaGrid consumers retain their default behaviour.

The public landing/authentication/onboarding pages were not redesigned. Colours, original mascot artwork, authentication, services, routes, and production data were preserved.

## Research and design choice

Actual browser research captured desktop, scrolled, and mobile states for four sites. Results and screenshots are in `artifacts/feed-refinement/research/`.

| URL | Actual access and useful finding |
| --- | --- |
| [Mastodon Explore](https://mastodon.social/explore) | Returned 200 and rendered real posts. Studied the author-led hierarchy, continuous separators, content indentation, supporting media, and action rows. This was the strongest practical reference for Hivez's social feed. Its branding, colour palette, and content were not copied. |
| [Bluesky's public profile](https://bsky.app/profile/bsky.app) | Returned 200. Inspected public profile chrome, tabs, and responsive structure; initial feed/media content was partially loading in the capture. It supported the choice of a compact toolbar and stable reading hierarchy, without claiming a fully loaded feed test. |
| [Are.na](https://www.are.na/) | Returned 200. Inspected the public presentation and responsive spacing. Useful restraint and content-first emphasis; its authenticated application was not accessed. |
| [Awwwards App Style](https://www.awwwards.com/websites/app-style/) | Returned 200. Reviewed the category presentation alongside the earlier award-project research. This pass did not claim additional award-winning project visits. |

Supporting primary documentation: [Mastodon's network and timeline interactions](https://docs.joinmastodon.org/user/network/). The research informed a Hivez-specific stream rather than a copy of another site's layout.

## Browser verification

The screenshot's `localhost:5174` server was confirmed to serve the modified repository. Both 5173 and 5174 returned the current Home module with the new feed heading and without the removed introduction. Tests used a separate, isolated Chrome session on **5174** and the same local demo Auth/Firestore emulators as the preceding redesign. No personal browser session was attached, no real accounts were messaged, and no hosted records were changed.

| Check | Result |
| --- | --- |
| Layout/theme sweep | **144 route/theme/viewport states passed**, covering 12 routes × six widths × two themes. Widths: 320, 390, 768, 1024, 1440, 1920px. No document overflow or outer-container side gaps. |
| Extra interactions | Sidebar wheel scrolling with hidden tracks, page keyboard scrolling, and the full-width profile with Updates open passed. Including these grouped checks, the review records **146 states/checks**. |
| Accessibility | **16 axe WCAG A/AA audits passed** on feed, profile, saved posts, and search at desktop/mobile sizes in both themes. Automated coverage is not a full accessibility certification. |
| Social functionality | **11 existing browser-flow groups passed**: navigation/search, filtering, persisted likes, saves/ReHives, replies, follow/profile tabs, DMs, notification read state, volunteering membership, creation entry, and mobile navigation/Updates. Writes used actual Firebase clients against local emulators. |
| Media | Portrait image/button bounds matched the original 3:5 aspect ratio without letterboxing; the existing viewer opened and closed with Escape; a mobile gallery scrolled horizontally and preserved arrow-key viewer navigation. All three grouped checks passed. |
| Runtime | No runtime exceptions or browser console errors in the completed layout, social, or media checks. Cancelled Firestore listening requests during navigation remain recorded separately as expected request cancellations. |
| Public production regression | Current compiled landing, login, and signup returned 200 and cycled through all three public themes; no console errors or failed local requests. |
| Build / TypeScript | `npm run build` passed, including `tsc -b`. Existing bundle-size and `vite-tsconfig-paths` warnings remain. |
| Lint | Home, FeedCard, and MediaGrid passed with **zero errors and warnings**. |
| Asset / scope integrity | **31 tracked bee assets unchanged**; **23 protected public/auth/onboarding source hashes unchanged**. |

The initial review caught legacy global hover styles restoring the card background; a more specific scoped stream selector fixed this. The existing browser flow also used fixed delays that raced Firestore listener/transaction completion on this run. Its assertions now wait for real persisted state and the corresponding button state before reloading or continuing. No social service implementation was changed to make the checks pass.

Media testing temporarily used a clearly labelled SVG dimension fixture and a two-image gallery in the **local emulator**. Original emulator media fields were restored in `finally`. The fixture is not a product asset or production post.

## Changed files

| File | Purpose |
| --- | --- |
| `src/pages/Home/Home.tsx` | Remove the marked introduction; move a compact semantic feed heading/filter above the composer. |
| `src/components/feed/FeedCard.tsx` | Stream styling hooks, aligned content wrapper, opt-in media variant; existing actions preserved. Also formatted for readability. |
| `src/components/feed/MediaGrid.tsx` | Optional stream variant and media styling hooks, preserving the default variant. |
| `src/styles/workspace.css` | Full-width containers, hidden tracks, enlarged bee, flat posts, media sizing, responsive refinements. |
| `tests/browser/app-session.mjs` | Optional evidence-output directory so this verification does not overwrite the preceding report's records. |
| `tests/browser/workspace-flows.mjs` | Replace fixed-delay assumptions with persisted-state waits for existing like/save/ReHive checks. |
| `tests/browser/feed-refinement.mjs` | New responsive, gutter, scrollbar, bee, theme, and accessibility verification. |
| `tests/browser/feed-media-check.mjs` | New local-only portrait/gallery/viewer verification and fixture restoration. |
| `scripts/inspect-feed-references.mjs` | Actual browser research capture. |
| `artifacts/feed-refinement/` | Research, screenshots, layout/flow/media results, lint/build logs, production smoke results, and integrity evidence. |
| `WORKSPACE_REDESIGN_REPORT.md` | Link to this follow-up so the superseded feed introduction/width descriptions are clear. |
| `FEED_LAYOUT_REFINEMENT_REPORT.md` | This record. |

Evidence entry points:

- `artifacts/feed-refinement/review/results.json`
- `artifacts/feed-refinement/review/feed-dark-1440.png`
- `artifacts/feed-refinement/review/feed-dark-390.png`
- `artifacts/feed-refinement/review/profile-dark-1920.png`
- `artifacts/feed-refinement/flows/results.json`
- `artifacts/feed-refinement/media/results.json`
- `artifacts/feed-refinement/production/results.json`
- `artifacts/feed-refinement/build-final.log`
- `artifacts/feed-refinement/lint.json`
- `artifacts/feed-refinement/integrity.json`

Live uploads, external AI services, real push delivery, and physical video capture were not re-tested for these presentation changes. No deployment, commit, or Git push was performed.
