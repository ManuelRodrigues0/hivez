# Hivez Settings redesign and live browser audit

## Design and scope

The Settings workspace uses the direction **“Your hive. Your way.”**: calm, editorial surfaces, forest green in light mode, deep green charcoal and honey accents in dark mode, compact Lucide icons, clear grouping, and an illustrated welcome. The supplied Firefox screenshots informed the navigation hierarchy, focus on readable controls, theme choice previews, and selective mascot use. The redesign keeps Hivez’s visual identity instead of borrowing Firefox’s colors or layout. Mozilla’s [Settings redesign](https://blog.mozilla.org/en/firefox/firefox-settings/), its [design discussion](https://blog.mozilla.org/en/firefox/new-firefox-design/), and Notion’s [account settings guidance](https://www.notion.com/en-gb/help/account-settings) informed grouping, labels, focus, and system appearance behavior.

The live audit covered `/settings` and its ten implemented sections: Account, Privacy, Security, Notifications, Content, Appearance, Accessibility, Language, Data, and Delete/deactivate. Saved and Activity were checked as redirects. Search, category navigation and its mobile selector, profile-edit shortcut, settings forms, theme previews, switches and selectors, data confirmation dialog, sign-out confirmation, cancel and Escape paths were exercised. No fake settings or unavailable backend actions were introduced.

The existing `src/assets/auth/newbee2.png` bee is used on the overview. I inspected the available mascot files and reused the static artwork so a functional page does not preload animation or add motion. No source asset was replaced and no new artwork was generated; the theme preview cards are CSS/HTML.

## Live findings and fixes

- **Overview records separators:** At desktop width, the two-column “Your records” card had misplaced internal borders. I scoped a records-panel class and aligned the row and column dividers in `src/pages/Settings/Settings.tsx` and `src/pages/Settings/settings.css`. The corrected overview was visually rechecked at desktop and mobile sizes.
- **Nested page title:** The shared desktop header showed “HIVEZ” on nested Settings routes because `MainLayout` only recognized the exact `/settings` path. `src/components/layout/MainLayout.tsx` now maps each implemented section to its page title. A live browser check compared the desktop header title and page heading across all ten sections.
- **Keyboard focus after save:** A switch became disabled while its Firestore save was pending, which dropped keyboard focus and prevented a second Space key from toggling it. `Switch` in `src/pages/Settings/Settings.tsx` now restores focus after a keyboard-initiated save completes. A real browser test toggled Discoverability off and on with Space, confirmed focus after both saves, and verified Firestore returned to the initial value.

The full-screen desktop review found no further actionable visual defects. Related appearance, privacy, account, overview, and narrow-screen layouts were revisited after the fixes.

## Browser and safety

I launched the installed Google Chrome 155 with Playwright in a new isolated headless context. The CUA browser entry points were unavailable, so this independent local browser path was used. The browser opened the actual Vite application at `http://localhost:5173` and used the application’s real Settings components and Firebase client code. Only Firebase endpoint configuration was redirected in transit to local Auth and Firestore emulators, using a synthetic test account and seeded test profile. Browser routing blocked all other network origins. No hosted Firebase data, production credentials, or unrelated browser profiles were accessed; nothing was deployed.

## Coverage and results

- **Routes:** Overview, ten Settings sections, Saved redirect, and Activity redirect. Dark-mode layout checks exercised all 13 routes at each viewport. Light mode exercised the same 13 routes at each viewport.
- **Viewports:** 320×844, 360×800, 390×844, 430×932, 768×1024, 1024×768, 1280×800, and 1440×900. The light-mode matrix recorded 104 route/viewport combinations; none had document/body horizontal overflow or visible controls outside the viewport. The dark-mode matrix also recorded no overflow or clipped controls. Mobile overview/account/privacy/appearance were captured and visually reviewed at 320, 390, 768, and 1024 widths.
- **Themes:** Light and dark were rendered and visually reviewed, including the appearance previews. Every route/viewport combination was measured in both themes. System selection was exercised, and the existing ThemeContext system-change behavior is covered by the Settings regression suite.
- **Interaction and accessibility:** Search results, Escape-to-clear, Ctrl+K, desktop and mobile category navigation, profile-edit shortcut, preference switches and selection controls, Tab focus visibility, keyboard Space activation with focus retention, native dialog open/Escape/cancel, sign-out Escape, and reduced-motion/high-contrast settings were exercised. Theme and app-device preferences used the isolated browser context. No destructive account action, credential update, password email, or push registration was attempted.
- **Persistence:** Discoverability wrote `false` and then `true` through the real Settings save path into the local Firestore emulator. The synthetic account was seeded with `true`; the final document value was verified as `true`.
- **Browser diagnostics:** Chrome console errors/warnings: none. Page exceptions: none. Failed requests: none. Blocked outbound requests: none.
- **Artifacts:** Browser evidence and metrics are in `.audit/settings-browser/`. The reusable local browser scripts are in `tests/browser/`.

## Changed files

| File | Purpose |
| --- | --- |
| `src/pages/Settings/Settings.tsx` | Redesigned overview and sections, search, controls, dialogs, save recovery, records panel class, and switch focus retention |
| `src/pages/Settings/settings.css` | Scoped Settings visual system, shared app-theme tokens, responsive layouts, focus and motion styles |
| `src/components/layout/MainLayout.tsx` | Correct nested Settings titles; global Updates rail width, persistence, and collapse behavior |
| `src/components/layout/UpdatesPanel.tsx` | Accessible collapse/expand controls and compact Updates rail |
| `src/context/ThemeContext.tsx` | Reactive system-theme behavior using the existing theme context and storage keys |
| `package.json`, `package-lock.json` | Development test dependencies and Settings test command |
| `tests/settings.test.tsx`, `tests/settings.setup.ts`, `tests/settings.vitest.config.mjs` | Component-level Settings regression suite and setup |
| `tests/browser/settings-session.mjs`, `tests/browser/settings-audit.mjs`, `tests/browser/settings-responsive-review.mjs`, `tests/browser/settings-capture-sections.mjs`, `tests/browser/settings-updates-collapse.mjs` | Isolated real-browser setup, route/viewport audit, section screenshots, and emulator-backed UI verification |
| `SETTINGS_REDESIGN_REPORT.md` | Design and verification record |

## Automated verification and limitations

| Check | Result |
| --- | --- |
| `npm run test:settings` | 32 tests passed |
| `npx tsc -b` | Passed |
| `npm run build` | Passed; existing large-chunk and Vite plugin migration warnings remain |
| Targeted ESLint on changed source and Settings tests | Passed |
| `git diff --check` | Passed |
| Repository-wide `npm run lint` | Existing repository debt: 5,901 errors and 4 warnings; targeted changed-file lint is clean |

Production credential changes, push permission/token registration, actual account deletion/deactivation, and hosted Firestore writes were intentionally not tested. The local browser audit does not establish behavior against production services. The broader app-wide lint command still fails on existing repository issues.

## Follow-up: app-bar Updates drawer and hidden Settings scrollbar

The unused block beside the Settings toolbar came from the sidebar's 72px sticky offset; the desktop Settings title now moves up and aligns beside the toolbar. The Updates control is now a standard labeled app-bar megaphone action that opens a 384px, non-blocking right-side drawer. The drawer has a clear close action, closes with Escape, restores focus to its trigger, and reserves its width in the desktop layout so Settings cards and illustrations reflow instead of being covered. On mobile, it overlays without reserving width. The preference remains available on desktop and mobile and persists across routes. The Settings sidebar scrollbar is visually hidden while its navigation remains scrollable.

In isolated Chrome, I verified closed-by-default behavior, open/close, Escape and focus return, Settings sidebar scroll treatment, and no reserved width while closed across `/`, `/search`, `/map`, `/settings`, Account, Privacy, and Appearance. With Updates open at 1440?900, the Settings welcome card ended before the drawer began and the bee artwork remained visible. The drawer also opened at 1024?768; at 390?844 it overlays without horizontal overflow or reserving width. Computed drawer and panel shadows were none, with no outer panel border or radius. Computed Settings background, surface, text, and accent tokens matched the site in both light and dark themes. The browser recorded no console errors, exceptions, or failed requests; it blocked 48 external OpenStreetMap tile requests on the Map route. Pattern research used [Material Design's side-sheet guidance](https://m2.material.io/components/sheets-side) for app-bar triggers and a separate close affordance, plus [Fluent 2's drawer guidance](https://fluent2.microsoft.design/components/web/react/core/drawer/usage) for an optional non-modal panel suited to at-a-glance information.

These follow-up changes are in `src/components/layout/MainLayout.tsx`, `src/components/layout/UpdatesPanel.tsx`, `src/components/layout/updatesPanel.css`, and `src/pages/Settings/settings.css`. The browser check is recorded in `tests/browser/settings-updates-collapse.mjs`.
