# Hivez — signed-in website redesign

Latest follow-up: [Pocket notebook and feed cleanup](POCKET_NOTEBOOK_REPORT.md) records the current feed/sidebar presentation and its verification.

Follow-up: [Feed and layout refinements](FEED_LAYOUT_REFINEMENT_REPORT.md) records the subsequent removal of the feed introduction, full-width containers, hidden scrollbar tracks, larger masthead bee, and continuous post stream. It supersedes the corresponding presentation descriptions below.

Completed 25 October 2026. Scope: the application after onboarding. The landing page, login, signup, and Complete Profile experiences were protected throughout this task.

## Result and creative direction

The signed-in application now uses a **neighbourhood journal** direction: warm paper, forest ink, expressive but readable headings, quiet borders, purposeful spacing, and familiar social interactions. The existing navigation rail, central content, optional Updates panel, feed, conversations, and profile tabs remain recognisable. The composition is deliberately calmer than a marketing site so people can read, report, organise, and communicate comfortably.

The light appearance connects to the public pages through their local Bricolage/Geist typography, off-white surfaces, and forest accents. The app's existing dark appearance retains black and yellow. Existing Light / Dark / System settings remain functional; the separate public Light / Forest / Midnight theme cycle was preserved.

This is an implementation in the existing React application, not a prototype. No new runtime dependencies, fabricated activity, production records, backend changes, or deployments were introduced.

## Research actually performed

Research used real browser pages, screenshots, scrolling, and the interactions listed below. Evidence is in `artifacts/app-redesign/research/`. Award listings and live-site access are distinguished deliberately.

| Reference | What was inspected | Principle applied to Hivez |
| --- | --- | --- |
| [Awwwards](https://www.awwwards.com/) | Homepage and current featured/recent winners | Compare hierarchy, pacing, navigation, and expressive type across several projects before selecting a direction. |
| [Social Responsibility](https://www.awwwards.com/websites/social-responsibility/) and [App Style](https://www.awwwards.com/websites/app-style/) | Category listings and actual project links | Prioritise community purpose and useful application structure over decorative spectacle. |
| [Cosmos award presentation](https://www.awwwards.com/sites/cosmos), [Cosmos](https://www.cosmos.so/), [Explore](https://www.cosmos.so/explore) | Award presentation, live entry, and Explore navigation. The Explore grid remained in a loading state in the capture. | Stable navigation, clear discovery categories, and allowing user content to dominate. Hivez retains its own feed and real data. |
| [Noho award presentation](https://www.awwwards.com/sites/noho), [live concept](https://noho.ink/) | Desktop/mobile composition, scrolling, and Blog navigation to `#blog-section` | Warm material character, strong editorial hierarchy, and space around useful content. This reference is explicitly a noncommercial Noho redesign concept. Its signature 3D treatment was not copied. |
| [Colonia Zacamil award presentation](https://www.awwwards.com/sites/colonia-zacamil), [live site](https://coloniazacamil.com/) | Award page and live entrance; activated Discover to enter the experience | A strong sense of place and orientation. In Hivez, the map receives clear local context and stays correctly aligned within its actual content pane. |
| [AltaMed Foundation nomination](https://www.awwwards.com/sites/altamed-foundation), [live site](https://altamedfoundation.org/), [Impact Stories](https://altamedfoundation.org/impact-stories) | Nominee presentation, live scrolling, and All Stories navigation | People-first editorial content, meaningful categories, and a clear path from reading to participation. AltaMed was inspected as a nominee, not claimed as a Site of the Day. |
| [FORMAT award presentation](https://www.awwwards.com/sites/format) | Accessible Awwwards project presentation. [Live site](https://format.obys.agency/) returned 403. | Typographic scale and disciplined composition informed section introductions. No live interaction claims are made. |
| [Cash App guidelines award presentation](https://www.awwwards.com/sites/cash-app-brand-guidelines) | Award presentation. [Graphic UI](https://design.cash.app/graphic-ui) redirected to Standards authentication. | Consistent design rules and restrained accent use. The protected Graphic UI content was not inspected. The accessible colour reference from the preceding auth work was supporting context. |
| [Linear](https://linear.app/) | Live marketing/product-interface presentations | Persistent application navigation, readable density, and restrained surfaces. The attempted Awwwards `/sites/linear` lookup returned 404; Linear is not claimed as an inspected Awwwards winner. |

An additional guessed Awwwards `/sites/greenpeace` URL returned 404 and was not used as a design reference. No reference artwork, distinctive interaction, or layout was reproduced wholesale.

## Implemented experience

- **Shared application navigation:** new Hivez masthead, original bee video, clear navigation labels, active states, unread counts, real search/create controls, collapsible rail, mobile navigation dialog, and mobile bottom navigation. Original live notification/chat subscriptions and route destinations remain connected.
- **Feed:** editorial introduction, personal composer prompt, actual hive filtering, quieter post surfaces, clearer author/category hierarchy, accessible action labels, and purposeful empty states. The secondary column connects to real hives, volunteering, and the map without inventing activity.
- **Profiles:** a complete identity-led presentation with actual cover/photo data, public/private identity, real counts, follow/edit/message controls, and Posts / ReHives / Media tabs. Text posts receive readable typographic tiles. An unconditional “verified” badge was removed; verification is shown only when present in real profile data.
- **Discovery and community:** coordinated section introductions, search styling, hive navigation, and content hierarchy. Existing search and hive resolution are preserved. Sidebar search can suppress duplicate idle suggestions without changing other search instances.
- **Messages and notifications:** conversations now fit the shared workspace, with a restrained message hierarchy and named controls. The existing DM, Ultra Bee, privacy, notification, and read-state services remain in use. An inert message-header menu button was removed.
- **Volunteering:** consistent headers, filters, statistics, opportunity/group/community surfaces, and responsive spacing across the volunteering hub and its nested pages. Existing joining, group coordination, evidence, review, and verification handlers remain intact.
- **Map:** coordinated controls, contextual heading, and OpenStreetMap attribution. Tiles and markers now measure the actual map element through `ResizeObserver`, including panel changes and resizing. Missing latitude/longitude parameters no longer become an accidental `(0, 0)` initial location.
- **Creation and camera:** an intentional entry for direct `/create` navigation, working original photo-report/text choices, coordinated composer/report steps, named controls, and a focused dark viewfinder. The existing upload and AI interfaces remain connected. Media preview URLs are reused and revoked; camera streams are stopped when leaving, including the asynchronous permission race.
- **Replies and creation dialogs:** native dialogs provide browser focus containment, Escape, focus restoration, and body scroll locking. Replies use one responsive composer instead of duplicated mobile/desktop textareas. Real sending and mention logic are retained.
- **Settings:** all existing categories/actions receive the shared surrounding workspace. A container-aware layout switches to the existing category selector when the Updates panel leaves a narrow content column. Reading size, high contrast, reduced motion, and system theme remain connected.
- **Admin and utility screens:** shared theme/type/surface treatment for the original administrative pages, standalone post views, and not-found pages. Admin permission checks remain unchanged. Mobile admin navigation now traps focus, supports Escape, and makes its closed off-screen navigation inert.

### Functional corrections found during review

Browser testing exposed the pre-existing direct `/create` crash caused by reading `.type` from absent media. This is now guarded, with a useful entry screen. It also exposed optional location properties being sent to Firestore as `undefined`, which blocked a real text-post submission. The composer now removes those undefined optional properties using its existing serializer before passing location data to the original write services. No schema, rules, Firebase configuration, or backend service logic was modified.

## Mascot, assets, and motion

The original `/assets/hivez-ultra-bee.webm` remains in the application masthead. Its artwork was not edited or substituted. The video pauses when the app's reduced-motion preference is enabled and when the document is hidden, with listeners cleaned up on unmount. Browser verification confirmed actual playback and preference-driven pausing.

All **31 tracked bee/mascot assets match their Git versions**. All **23 protected landing/auth/onboarding source files match their pre-task SHA-256 hashes**. The landing roamer and authentication mascot interactions were not altered by this task. See `artifacts/app-redesign/integrity-results.json`.

There are no new product photographs or image dependencies. The design uses existing local fonts, existing assets, existing Lucide icons, actual user media, and small code-native brand graphics. An existing community photograph appears only in the clearly labelled synthetic emulator fixture used for screenshots; it is not injected into production feeds. Map tiles continue using OpenStreetMap.

## Browser testing and refinement

Testing used isolated Chrome sessions controlled through Playwright, not the user's personal browser profile. The repository and server were confirmed at `D:\hivez`, `http://localhost:5173`. The production build was served separately on `http://localhost:5175`, with its hashed compiled entry checked in the browser.

### Real local clients, isolated data

The signed-in tests use the application's real Firebase Auth and Firestore clients against local Auth/Firestore emulators for the demo project `demo-hivez-design`. A browser response interception redirects only the development Firebase module to those emulators; the repository's Firebase module and environment files were not changed. Synthetic people, posts, conversations, groups, and notifications are explicitly local test content. The local admin fixture enables viewing the real admin routes; production permissions were not changed.

External browser traffic was restricted to the local application, emulators, and read-only OpenStreetMap tiles. No real users were messaged, no media was uploaded, and no production data was written.

### Results

| Check | Actual result / evidence |
| --- | --- |
| Broad route/layout review | **131 route/theme/viewport states passed**; no document overflow, panel overlap, route HTTP failure, runtime exception, or console error in the final matrix. `artifacts/app-redesign/audit/results.json`; actionable issues file is `[]`. |
| Responsive coverage | Main routes at 1440 and 390px in both themes; additional core routes at 320, 768, and 1024px; Settings with Updates open at 1024px. Desktop/mobile screenshots were inspected. |
| Accessibility matrix | **56 axe WCAG A/AA audits passed** across 14 primary routes, two themes, and two sizes. This is automated coverage, not a claim of full accessibility certification. |
| Social flows | **11 groups passed**: navigation/skip link/search, actual hive filtering, persistent likes, saves/ReHives, actual replies, follow/unfollow/profile tabs, actual DM send, notification read persistence, volunteer membership/community routes, create choices, and mobile navigation/Updates focus. `artifacts/app-redesign/flows/results.json`. |
| Deeper flows | **6 groups passed**: real text-post submission and resulting stored document/feed; profile edit persistence; map centering/zoom/pan/post navigation; admin mobile focus/Escape; report category/evidence step and axe audit; actual theme/system/text-size/high-contrast/reduced-motion controls. `artifacts/app-redesign/details/results.json`. |
| Camera | Actual Camera component received Chrome's synthetic camera/microphone stream. Keyboard shutter captured a photo, Use captured media opened the real composer, and all inspected tracks ended on leaving. No physical camera was accessed. `artifacts/app-redesign/flows/camera-results.json`. |
| Final targeted review | **16 additional route/viewport WCAG audits passed**, plus actual original bee playback/reduced-motion behaviour. These cover map, settings, create, and post detail in desktop/mobile light/dark appearances. Evidence: `artifacts/app-redesign/details/final-review.json`. |
| Excluded public pages | Current compiled `/`, `/login`, `/signup` each returned 200 and cycled through Light / Forest / Midnight; no console errors or failed local requests. The local onboarding preview fixture was absent from production. `artifacts/app-redesign/production/results.json`. |
| TypeScript / production build | `npm run build` passed, including `tsc -b`. `artifacts/app-redesign/build-final.log`. |
| Focused unit tests | **32 settings tests and 8 onboarding tests passed**. `artifacts/app-redesign/settings-tests.log`, `onboarding-tests.log`. |
| Changed-source lint | **28 source files checked; no newly introduced lint findings**. The check still reports 11 errors and 2 warnings in five legacy files, with matching rule counts verified against their Git HEAD versions. See `lint-final.json` and `lint-baseline-comparison.json`. |

The first broad review found low-contrast secondary labels, unnamed icon controls, a mobile post action-row overflow, and a squeezed Settings column with Updates open. These were fixed in code and the broad matrix rerun. Subsequent focused reviews corrected map projection sizing, a caption/control overlap, composer identity/serialization, preview cleanup, and admin focus cleanup. Later targeted checks supplement the broad matrix rather than claiming the original matrix exercised every later interaction.

Representative final evidence:

- `artifacts/app-redesign/audit/feed-light-1440.png`
- `artifacts/app-redesign/audit/feed-dark-390.png`
- `artifacts/app-redesign/audit/profile-light-1440.png`
- `artifacts/app-redesign/audit/volunteering-light-1440.png`
- `artifacts/app-redesign/audit/chats-light-1440.png`
- `artifacts/app-redesign/details/settings-updates-1024.png`
- `artifacts/app-redesign/details/large-text-high-contrast-320.png`
- `artifacts/app-redesign/details/report-evidence.png`
- `artifacts/app-redesign/details/final-map-light-390.png`
- `artifacts/app-redesign/flows/camera-capture.png`

## Files changed by this task

The working tree already contained unrelated AI/dev tooling work and earlier public/auth/profile-setup changes. They were preserved. This table lists this task's implementation files, not every dirty file in the repository.

| File | Purpose |
| --- | --- |
| `src/styles/workspace.css` (new) | Scoped signed-in design tokens, type, navigation, page styles, legacy surface adapters, responsive/container rules, and accessibility preferences. |
| `src/components/layout/MainLayout.tsx` | Rebuilt shared workspace presentation; retained live subscriptions and real callbacks. |
| `src/components/layout/HiveNav.tsx` (new) | Shared navigation, actual hive search, create entry, settings/logout. |
| `src/components/layout/PageIntro.tsx` (new) | Reusable editorial section introduction. |
| `src/components/layout/NeighbourhoodContext.tsx` (new) | Purposeful feed sidebar with real application destinations. |
| `src/components/layout/WorkspaceFrame.tsx` (new) | Scoped theme wrapper for standalone and operational screens. |
| `src/components/admin/AdminLayout.tsx` | Coordinated admin shell and accessible mobile navigation. |
| `src/components/comments/CommentsSheet.tsx` | Native responsive reply dialog with one composer. |
| `src/components/comments/CommentHeader.tsx` | Accessible reply close control. |
| `src/components/comments/CommentComposer.tsx` | Accessible composer/send labels. |
| `src/components/feed/CreateModal.tsx` | Native creation dialog with original working choices. |
| `src/components/feed/Feed.tsx` | Coordinated empty-state presentation. |
| `src/components/feed/FeedCard.tsx` | Post hierarchy, semantic styling hooks, author navigation, action labels/state, reduced-motion handling. |
| `src/components/hiveSearch/HiveSearch.tsx` | Input/control labels and optional suppression of duplicate idle suggestions. |
| `src/components/profile/EditProfile.tsx` | Scoped editor styling hook; original save/upload behaviour retained. |
| `src/pages/Home/Home.tsx` | Feed composition, introduction, personal composer prompt, real hive filter/context column. |
| `src/pages/Profile/Profile.tsx` | Complete profile presentation, actual verification state, tabs/tiles, safe share feedback. |
| `src/pages/Search/Search.tsx` | Discovery introduction and named search input. |
| `src/pages/Community/Community.tsx` | Hive introduction and coordinated identity. |
| `src/pages/Chats/Chats.tsx` | Workspace sizing, conversation hierarchy, accessible controls, removed inert menu. |
| `src/pages/Notifications/Notifications.tsx` | Scoped presentation hook. |
| `src/pages/SavedPosts/SavedPosts.tsx` | Scoped presentation hook. |
| `src/pages/Volunteering/Volunteering.tsx` | Styling hooks across its five views and named filter; original workflows retained. |
| `src/pages/Map/Map.tsx` | Scoped presentation, real-pane projection, safe initial coordinates, marker semantics, attribution. |
| `src/pages/Create/Create.tsx` | Direct creation entry, media guard/preview cleanup, real profile identity, accessible controls, optional location serialization. |
| `src/pages/Camera/Camera.tsx` | Viewfinder identity/controls, keyboard shutter, preview cleanup, reliable stream disposal. |
| `src/pages/Post/Post.tsx` | Responsive detail actions and accessible action names/state. |
| `src/pages/Settings/Settings.tsx` | Outer sizing container for the existing settings experience. |
| `src/router/AppRouter.tsx` | Scoped wrappers around existing standalone/operational routes; original guards and destinations retained. |
| `scripts/inspect-app-references.mjs` (new) | Reproducible browser research capture. |
| `tests/browser/app-session.mjs` (new) | Local-only emulator fixture, endpoint interception, isolated browser session, evidence capture. |
| `tests/browser/workspace-audit.mjs` (new) | Broad route, theme, viewport, and axe matrix. |
| `tests/browser/workspace-flows.mjs` (new) | Real local social/navigation persistence checks. |
| `tests/browser/workspace-details.mjs` (new) | Deeper composer/profile/map/admin/preferences checks. |
| `tests/browser/workspace-camera.mjs` (new) | Synthetic-device camera-to-composer and stream-cleanup check. |
| `artifacts/app-redesign/` (new) | Research records, screenshots, JSON results, protected hashes, lint comparison, and verification logs. |
| `.audit/app-test-tools/` (local tooling) | Test-only Firebase CLI, demo emulator configuration/rules, and official Adoptium Java runtime. These are not application dependencies or production configuration. The downloaded Java directory/archive are excluded locally through `.git/info/exclude`. |
| `WORKSPACE_REDESIGN_REPORT.md` (new) | This implementation and verification record. |

## Remaining limits

- Live Cloudinary uploads, external AI responses, actual push delivery, real Google authentication, physical camera/video modes, and destructive administrative/account actions were not exercised. Existing integrations and handlers were preserved; passing compilation is not evidence that those external services succeeded.
- Emulators verify client behaviour and persistence, not production Firestore rules, indexes, or hosted-service configuration. No hosted configuration was changed.
- Lint remains nonzero because of the verified existing findings in EditProfile, Camera, Map, Notifications, and Volunteering. The new implementation adds no lint findings.
- The production build warns about the existing `vite-tsconfig-paths` plugin and a large main JS chunk: approximately 1,674.59 kB minified / 467.95 kB gzip. No new runtime library was added; route-level bundle restructuring was not part of this visual change.
- A Windows file-watcher `EBUSY` interruption occurred while writing a temporary audit script. The development server was restarted with process-local polling for the remaining verification. No Vite configuration or environment file was changed for that workaround.
- No deployment, commit, or Git push was performed during this task.
