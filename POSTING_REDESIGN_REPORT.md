# Hivez posting and reporting redesign

Completed October 25, 2026 (America/Los_Angeles).

## Result

The create modal, create entry screen, text/media composer, and every photo-report stage now share an original **Local Dispatch** direction. The visual system uses Hivez’s existing Bricolage/Geist typography, paper backgrounds, forest ink, restrained serif accents, and black/yellow app theme.

The former instruction rail and oversized enclosing form have been replaced with a horizontal progress index, an open working stage, and a developing report summary. The text composer is a writing canvas with an attachment contact sheet and a practical finishing panel. The original bee artwork is imported unchanged in the composer masthead.

## Research actually performed

Awwwards initially timed out through the text browsing tool. An installed Playwright browser and local Chrome successfully opened the following pages. Recorded browser responses were HTTP 200. Screenshots and extracted page content are in `artifacts/posting-redesign/research/`.

| Reference | What was inspected | Interpretation used in Hivez |
| --- | --- | --- |
| https://www.awwwards.com/ | Homepage, scroll state, current project presentation | Commit to a coherent typographic direction throughout the workflow. |
| https://www.awwwards.com/sites/self-aware | Award presentation, typography/color information, linked form reference | Give a form the same art direction as the rest of a website. |
| https://www.awwwards.com/inspiration/project-inquiry-form-self-aware | Published form presentation at desktop and phone widths | Conversational hierarchy and generous writing space, adapted into ordinary accessible controls. |
| https://selfaware.studio/ | Live homepage, scroll, expressive type | Strong scale contrast with restrained color. The current live homepage differs from the award-era form presentation. |
| https://www.awwwards.com/sites/contra-project-calculator | Award presentation and link to the live calculator | Make the state of a multi-stage task understandable. |
| https://contra.com/project-rate-hiring-calculator/ | Live page, animated opening, scrolled calculator presentation, controls inventory and phone layout | Keep a user's work within one recognizable workspace. Hivez does not reproduce the 3D device or visual identity. |
| https://studiofreight.com/ | Live image-led homepage and scroll | Give imagery a clear role and use deliberate alignment. |
| https://studiofreight.com/contact | Actual inquiry form, desktop and phone layouts | Reduce unnecessary form containers and give fields clear hierarchy. |
| https://www.cosmos.so/ | Live homepage, scroll | Make the primary task obvious. |
| https://www.cosmos.so/explore | Live search/navigation and image collection at desktop and phone widths | Let uploaded photos retain their own proportions and use a readable contact sheet. |

These are design interpretations from the observed pages. Reference forms were not submitted, and their authentication or persistence was not tested. Awwwards’ embedded form presentation was inspected as a presentation, not a working form. No reference artwork, photography, source code, or distinctive interaction was copied.

Research evidence: `references.json`, `interactions.json`, and the corresponding desktop, scroll, and mobile PNGs in the research directory.

## Implemented experience

- A coordinated two-choice create dialog and standalone entry screen.
- A branded masthead with the existing bee and existing app theme toggle.
- Text writing and live preview modes.
- Photo/video attachment selection, drag/drop, validation, removal, and video audio controls.
- A contact sheet that displays selected files with their names and preserves the whole image using `object-fit: contain`.
- Hive selection, optional place entry/detection, audience display derived from the current profile, and sensitive-content preference in the text/media composer.
- Empty posts cannot be shared. Upload errors appear inline without discarding the draft.
- A photo-report progress index and consistent Hive, evidence, check, place, details, and review stages.
- A real report summary assembled from the selected photo, category, description, and place.
- Existing image verification states and submission restrictions, with calmer status messaging.
- Existing optional OmniRoute wording and Hive-analysis controls retained.
- A complete report review including category-specific fields, urgency, verification status, location, and sensitive-content preference.

## Usability repairs made during review

- Optional-evidence categories can continue without a photo. Their progress list and Back action skip the absent verification stage, avoiding an empty screen.
- Selecting the same evidence file again works because file-input values are cleared after selection.
- Evidence cannot be replaced while its check is running. A validation request cannot overwrite a more recently selected category/file.
- Switching create routes remounts the draft controller, so a previous mode's attachments and state do not leak into a fresh composition.
- Stage changes focus their heading and return the viewport to the top. Invalid details focus the missing field and announce an inline error.
- Progress labels were shortened after a 320px visual review revealed crowding.
- Review no longer displays a verification badge for a report that has not passed an image check.

## Files changed for this task

| File | Purpose |
| --- | --- |
| `src/components/create/ComposerParts.tsx` | Shared masthead, create choices, author/audience identity, checklist, and footer. |
| `src/components/create/CreateEntry.tsx` | Redesigned standalone entry screen. |
| `src/components/create/PostComposer.tsx` | Controlled writing/preview UI, contact sheet, attachments, and finishing panel. |
| `src/styles/composer.css` | Styles scoped to the new dispatch components and create dialog, responsive layouts, theme variables, and reduced-motion handling. |
| `src/pages/Create/Create.tsx` | Connect the new UI to the existing upload, report, location, verification, AI, and publishing functions; restyle all report stages and apply the usability repairs above. |
| `src/components/feed/CreateModal.tsx` | Reuse the new choice presentation inside the existing native modal. |
| `scripts/verify-posting-redesign.mjs` | Repeatable Chrome UI and emulator-persistence checks. |
| `scripts/verify-posting-states.mjs` | Optional evidence, validation, AI suggestion, rejection, small-screen, and reduced-motion checks. |
| `artifacts/posting-redesign/` | Research captures, browser screenshots, and structured verification results. |
| `POSTING_REDESIGN_REPORT.md` | This report. |

Temporary research scripts were run under `.audit/`. The existing local emulator configuration and Java installation were reused. No dependency was added.

The working tree already contained extensive changes before this task. Unrelated source, Firebase configuration, schemas/rules, environment variables, authentication, landing pages, and mascot source files were preserved. Nothing was deployed or pushed.

## Browser verification

The running Vite process was identified as `D:\hivez\node_modules\vite\bin\vite.js` on `http://localhost:5174`. Chrome ran against that server with an isolated browser profile. Firebase Auth and Firestore were redirected in the browser to local emulators for the demo project `demo-hivez-design`; external network access in the test session was restricted.

The following checks passed on the final implementation:

1. Open the create dialog and close it with Escape; render the entry page.
2. Write text, change Hive, add a place, enable sensitive content, switch preview/edit modes, publish, and inspect the actual stored emulator document.
3. Validate, render, remove, and re-add an image; publish a media post and inspect its stored media fields.
4. Complete Hive search → evidence → image check → place → details/urgency → review → submit; inspect the stored report document.
5. Switch the app theme and inspect desktop plus 390px and 320px layouts without horizontal document overflow.
6. Skip optional evidence, go back, and trigger required-detail validation without reaching an empty stage.
7. Request wording assistance and verify that Discard preserves the original, Edit loads the suggestion, and Accept explicitly applies it. Render existing-Hive analysis without silently changing the draft.
8. Reject an unsupported file; exercise a rejected image-check result; confirm Continue is unavailable; replace and reselect evidence successfully.
9. Inspect phone evidence, details, and review screens; confirm stage animation becomes `none` under `prefers-reduced-motion: reduce`; check the reviewed controls have accessible names/labels.

Both final browser result files contain empty runtime-error, console-warning/error, and failed-request arrays:

- `artifacts/posting-redesign/browser-results.json`
- `artifacts/posting-redesign/states-results.json`

Screenshots were reviewed at the entry, text editor, report category/evidence/details/review, dark theme, and mobile states. Refinements were made in code and the relevant browser checks were rerun.

### What the browser checks do and do not prove

The UI, media-file validation, Firebase authentication, form state, and Firestore persistence were exercised through the actual application. Cloudinary upload responses, the local image model, cloud image-check decisions, and OmniRoute suggestion/analysis responses used explicitly controlled browser fixtures. These checks establish that the redesigned UI handles those response contracts correctly; they do not establish live provider availability or model accuracy. No production post or upload was created.

Device camera capture, GPS permission/detection on physical hardware, actual screen-reader speech, video recording, and live external AI/storage calls were not exercised in this redesign verification. Their existing implementations remain connected. No WCAG certification or live service health claim is made.

## Build and code checks

- `npm run build`: passed, including `tsc -b` and Vite production bundling.
- Focused ESLint across the new components, changed create UI, and both verification scripts: passed.
- `git diff --check` for the changed tracked UI files: passed; Git emits its existing LF/CRLF conversion notices.
- React review: hooks remain unconditional; route changes reset composition state deliberately; blob previews are revoked; existing event/API handlers are reused; the UI uses native controls, explicit labels, visible focus, and a native modal; no new runtime dependency was introduced.

Vite continues to report the existing `vite-tsconfig-paths` recommendation and large output chunks. This task does not restructure the application's global bundle.

To repeat the browser scripts, start the existing local Auth/Firestore demo emulators on ports 9099/8080 and the Vite server on 5174, then run:

```powershell
node scripts/verify-posting-redesign.mjs
node scripts/verify-posting-states.mjs
```

The scripts use the existing Playwright installation in `.audit/browser/`; `HIVEZ_TEST_ORIGIN` and `HIVEZ_PLAYWRIGHT_MODULE` can override those local defaults.

## Assets

No new production photography or illustration was needed. The bee remains the exact existing `src/assets/auth/newbee2.png`. Images displayed in the composer come from the user's selected files. Browser fixtures reuse the repository's existing `public/auth/shared-street.jpg` and `artifacts/api-audit/images/overflowing-bin.jpg`; they are test content, not inserted into the product as live activity.
