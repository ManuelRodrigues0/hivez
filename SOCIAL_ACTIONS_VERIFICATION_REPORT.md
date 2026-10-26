# Hivez post actions - all-surface follow-up

October 26, 2026. This section supersedes the earlier scope claim below.

## Status and deployment boundary

User explicitly authorized publishing these rules on October 26, 2026 and completed Firebase CLI sign-in. Deployment is complete; the active release was downloaded and verified against the tested file.

The frontend now uses one shared implementation for social post actions. Verification uses the actual local Vite application at `http://localhost:5174`, Chrome, Firebase Auth/Firestore emulators, and a copy of this repository's rules. Synthetic test posts and accounts stay in the loopback-only `demo-hivez-design` project.

**Published successfully to Firebase project `hivez-21680`. The active `cloud.firestore` release uses ruleset `52aff09a-308c-428b-a538-9eb7a7865e90` and exactly matches the tested local rule source. Existing hosted posts, users, comments, and messages were not modified by the deployment verification.**

### Production deployment and verification

- Backed up the prior active rule source and release metadata in `artifacts/social-actions/deployment/before-firestore.rules` and `before-release.json`.
- Found existing production-only owner permissions for `users/{uid}/sessions` and `users/{uid}/pushTokens`. Restored those exact blocks to the local file before publishing. The diff against the backed-up production rules contains only the intended legacy privacy/visibility and ReHive query repairs.
- Re-ran **44/44 local permission checks** on the merged file, including 14 owner/privacy/validation checks for the preserved session and push-token permissions.
- Read masked fields from existing cloud posts and author profiles. Five sampled public posts actually lacked `visibility`; three also lacked modern author privacy fields.
- Firebase's official Rules API reproduced **10/10 failing read/like evaluations** against the old production source with these existing schemas, reporting `Property visibility is undefined on object`. The corrected candidate passed all ten.
- Published with `firebase deploy --only firestore:rules --project hivez-21680 --non-interactive`. Firebase compiled and released the rules successfully. Functions, indexes, hosting, and frontend assets were not deployed.
- Downloaded the active release after deployment: the source matches the tested file byte for byte (SHA-256 below). Evidence: `artifacts/social-actions/deployment/after-release.json` and `after-firestore.rules`.
- Re-ran those ten evaluations against the downloaded deployed source: **10/10 SUCCESS**, zero compiler issues. Evidence: `live-rule-evaluation-before.json` and `live-rule-evaluation-after.json`.

These cloud evaluations simulate request contexts using actual existing document fields; they do not submit real likes/comments or create documents. Function mocks explicitly represent the supplied public-author data and no-block scenario. They are distinct from the actual browser-and-database writes exercised in the local emulator. The source, release identity, and old/new permission failure are now verified against the real project. No manual production browser write is claimed.

Firebase's Rules API test format is documented at https://firebase.google.com/docs/reference/rules/rest/v1/projects/test. Refresh Hivez to reattach any listeners that had already stopped after an earlier permission denial.

The open signed-in Chrome window was inspected read-only through native accessibility. Its seven toolbar controls were present. Native click/screenshot integration failed with unavailable input geometry and a screenshot timeout after recovery; no live cloud likes, comments, or messages were sent. Interactive verification below used a separate Chrome session connected to local emulators. A temporary read-only diagnostics hook did not return live-schema results and was removed.

## Confirmed defects and repairs

1. **Different implementations across views.** Full post details duplicated feed action handlers and omitted volunteering. Details now render `FeedCard`, which uses the shared `PostActions` controller. The same seven buttons are available in Feed, Hive, Saved Posts, and full post details.
2. **Grid icons were decorative.** Profile Posts, Media, ReHives, Explore, and search rendered engagement spans inside a button that opened the post. Those counts now have proper like/unlike, replies, and ReHive/undo buttons using the same controller. Opening a post is a separate button, so social controls never rely on nested buttons or event cancellation. Compact counters subscribe to the actual post for live search results.
3. **Legacy permission failures.** Before the rules repair, an authenticated emulator request received `403 PERMISSION_DENIED` both reading and liking a public legacy post with no `visibility`, whose public author lacked modern privacy fields. Optional-field defaults now match the client privacy model, including the supported `privateAccount` flag. Explicit private accounts, follower-only posts, unauthenticated access, and blocked interactions retain restrictions. Optional null/partial privacy maps are handled explicitly. Firebase documents the optional-map-field approach at https://firebase.google.com/docs/firestore/security/rules-fields#enforcing_types_for_optional_fields.
4. **Other people's ReHive profile query failed.** The emulator reproduced a denied query on another user's ReHives. List authorization now checks access to the profile identified by the query's `userId`. This exposes ReHive reference records only; each original post still has its own audience check and client privacy filtering. Individual state reads retain the existing ownership/post-access checks.
5. **Stored IDs could override document paths.** A post document containing an old `id` field could send actions to that stale ID. Feed, discovery, profile, saved/ReHive lookups, and detail now use Firestore's document ID after spreading stored fields. The browser fixture deliberately includes `id: "stale-imported-id"` and verifies writes to the real document.
6. **Tile styles leaked into replies.** Browser inspection caught profile image selectors enlarging avatars inside tile-owned dialogs. Shared dialogs now use a portal to the workspace root, outside profile/Explore tile styles and clipping. The workspace theme remains available.
7. **Explore hit targets overlapped.** Browser hit testing found the full-tile open button intercepting social controls. The action overlay now sits above that link and accepts pointer input only on its actual controls.
8. **Reply selection race.** A saved comment can appear before its optional notification finishes. Selecting a new reply target during that interval was cleared by the previous send's completion. Completion now clears only the submitted draft and reply target, preserving a newly selected one.
9. **Older counters could go negative.** Like, ReHive, and save transactions now read the authoritative parent count, tolerate absent counters, and clamp decrements at zero. Transactions still deduplicate actions across sessions.
10. **Stale/deleted detail content.** Details clear a removed post, use a route-specific result, and show a useful unavailable state on read failure. The previous UI recommending permissive Firebase rules was removed.

## What the actions do

| Control | Behavior |
| --- | --- |
| Heart | Atomic persistent like/unlike and live count, pressed state and pending protection. |
| Reply bubble | Opens replies; supports posting, threaded replies, comment likes, own comment deletion, and useful errors. |
| ReHive | Persistent repost reference, live count, profile ReHives, and undo. |
| Helping hand | Opens or creates the post's issue community, joins once, then navigates to it. |
| Bookmark | Private persistent save, Saved Posts listing, and removal. |
| Share | Native share where available; copy-link menu and clipboard fallback. |
| Paper plane | Opens recipient search and sends a real POST_SHARE chat message; recipient privacy, partial failure, retry, and unread state remain intact. |

Only the controls actually displayed on compact tiles are shown there. Opening the tile provides the complete seven-action post. Map popups, notifications, and shared-chat previews continue to lead to that common post route. No claim is made that those navigation entry points were all manually clicked in this follow-up.

## Follow-up files

| File | Purpose |
| --- | --- |
| `src/components/feed/PostActions.tsx` | Shared full/compact action controller, subscriptions, dialogs and clipboard/share behavior. |
| `src/components/feed/FeedCard.tsx` | Delegates social controls; retains post content and options. |
| `src/pages/Post/Post.tsx` | Live detail using FeedCard; seven controls, deletion and unavailable state. |
| `src/pages/Profile/Profile.tsx` | Real tile buttons and authoritative IDs on all profile tabs. |
| `src/components/search/ExploreGrid.tsx` | Real tile buttons, keyboard reveal, pointer layering, authoritative IDs. |
| `src/pages/Search/Search.tsx` | Real controls in post results; separate open button and authoritative IDs. |
| `src/components/feed/Feed.tsx` | Authoritative IDs in realtime feed snapshots. |
| `src/services/feedRanking.ts` | Authoritative IDs in initial feed load. |
| `src/services/rehives.ts` | Authoritative IDs in profile lookups and nonnegative transactional counts. |
| `src/services/savedPosts.ts` | Authoritative saved-record IDs and nonnegative transactional counts. |
| `src/components/comments/CommentsSheet.tsx` | Preserve a newly selected reply target when an earlier send finishes. |
| `src/styles/workspace.css` | Compact control targets, contrast, focus, separate profile media/open area and mobile layout. |
| `firestore.rules` | Published legacy privacy/visibility defaults and protected ReHive lists; preserves existing production session/push-token rules. |
| `scripts/verify-post-surfaces.mjs` | Browser checks across post contexts, stale IDs, legacy fields, mobile and deletion. |
| `scripts/verify-post-compatibility.mjs` | Authenticated allow/deny checks against local repository rules; local fixture cleanup. |
| `scripts/verify-social-actions.mjs` | Scope post text assertions to the visible card after dialogs moved into portals. |
| `tests/feed-actions.test.tsx` | Transaction mock includes the authoritative post read. |
| `SOCIAL_ACTIONS_VERIFICATION_REPORT.md` | This follow-up and preserved earlier repair history. |

The working tree already contained extensive modifications before this follow-up. Files unrelated to these changes were preserved. Earlier service repairs described below were retained. No new package or visual asset was added.

## Verification results

| Verification | Result | Evidence |
| --- | --- | --- |
| Core action browser regression | 8/8 passed | `artifacts/social-actions/results.json` |
| Keyboard, mobile, partial failures and privacy browser checks | 7/7 passed | `artifacts/social-actions/states-results.json` |
| All-surface legacy photo-post browser checks | 11/11 passed | `artifacts/social-actions/surfaces-results.json` |
| Real rules allow/deny compatibility requests | 44/44 passed | `artifacts/social-actions/compatibility-results.json` |
| Focused React action tests | 2/2 passed | `npx vitest run --config tests/feed-actions.vitest.config.mjs` |
| Focused service contract tests | 5/5 passed | `npx vitest run --config tests/post-actions.vitest.config.mjs` |
| TypeScript | Passed | `npx tsc -b --pretty false`; also included in production build |
| Production build | Passed | `npm run build` |
| Focused lint | Passed | Changed social-action TSX/services/scripts/tests checked with ESLint; no full-repository lint success is claimed. |
| Whitespace diff check | Passed | `git diff --check` on affected tracked files; Git emitted only LF/CRLF conversion notices. |

The final browser matrix verifies actual persistence of likes, replies, ReHives, correct post IDs, community membership, and deletion. On each of Feed/Hive/Saved/detail it exercises like/undo, posting a reply, ReHive/undo, copy link, opening the send dialog, and joining/opening the issue community; saved pressed state is checked there, with actual save/unsave persistence and actual DM sends covered by the core regression. Profile Posts/Media/ReHives, Explore, and search execute real like/undo, reply submission, and ReHive/undo without activating their open-post button. The legacy fixture omits `visibility` and modern author privacy fields, stores a deliberately wrong `id`, and has missing optional counters.

Keyboard checks include Escape, modal focus containment and focus restoration. Phone checks cover profile/Explore at 390px and the full action row/share menu at 320px, with light and dark appearance checked by the state regression. This follow-up did not repeat a complete accessibility audit or every appearance across every route.

Core and surface browser runs recorded zero browser exceptions and zero console errors/warnings. The state run recorded one deliberately triggered, handled comment-privacy rejection and no unexpected console issues. Test-created third-party avatar requests initially failed under the harness network block; minimal fixtures were corrected/cleaned and final runs have no such failures. Earlier failed iterations exposed the profile dialog CSS leak, Explore hit-target overlap, and reply-selection race; the final result artifacts above contain passing reruns after those fixes.

The tested emulator rule file, final `firestore.rules`, and downloaded active production source have matching SHA-256:
`B28D0DC1BB238D5EFEE2F8AB12A41830BC04A6ECAE25F14D4C9B5CF4F76C2E1C`.

Existing build warnings remain about large JavaScript chunks and the `vite-tsconfig-paths` plugin. No dependency was added for these repairs. Native OS Web Share behavior was tested with controlled success/cancel/failure responses; actual browser clipboard writes were verified. Production deployment and permission evaluations are now verified as detailed above. Real cloud user writes were not performed; their browser persistence tests used the local emulator. The user explicitly approved publishing the reviewed rules after the earlier no-deployment instruction. No broad permissive rule replacement or data migration was performed.

The emulator terminal also recorded reconnect/back-channel pressure warnings during the extended test session; no corresponding unexpected browser errors occurred in the final runs. This was functional verification, not a production load test.

The original Vite server on port 5174 was reused and left running. The test Auth/Firestore emulators were stopped after verification.

---

# Hivez social post actions — verification and repairs

Completed October 26, 2026 (America/Los_Angeles).

## Outcome

All seven actions in the supplied post toolbar passed browser checks through the actual application and local Firebase Auth/Firestore emulators using an exact copy of the repository's Firestore rules. These checks exercised real client writes, counters, listeners, navigation, and reload persistence; social-action results were not mocked.

| Action | Behavior verified |
| --- | --- |
| Heart | Like/unlike creates/removes the user's like, changes the post counter once, and persists after reload. |
| Comments | Opens the thread; posts a comment; attaches a reply to its parent; updates the post count; deletes the user's reply and decrements the count. |
| ReHive | Creates the ReHive, updates its counter, appears on the user's ReHives profile tab, and can be undone. |
| Volunteer | Creates a missing community for an older post, joins it, opens its page, and does not add duplicate membership on a repeat click. |
| Bookmark | Saves privately, appears in Saved Posts after reload, and disappears when unsaved. |
| Share | Copies the actual post URL into the browser clipboard; that URL opens the post. Native-share success, cancellation, and copy fallback were checked with controlled Web Share API responses. |
| Paper plane | Finds a recipient, sends the post to a new conversation, stores the POST_SHARE message and unread count, displays the preview in Chats, and opens the original post from it. |

Another person's comment can also be liked/unliked successfully under the existing rules.

## Repairs

### Volunteering on older posts

The browser reproduced a Firestore permission rejection when a neighbour volunteered on a post without an issue community. Community creation tried to attach `issueCommunityId` to the original post, which a non-author cannot edit.

The feed now requests community creation without that post metadata update for a non-author. The deterministic community ID is already sufficient for the application's lookup. Creation now uses a transaction so simultaneous attempts do not reset an existing community. Author-created posts continue to receive the metadata link.

### Sending a post by DM

Recipient audience checks previously called the general viewer-access function with a third person's ID. That function reads the block relationship between the recipient and author, which the sender is not authorized to read. The new audience helper checks public/private post visibility and follower eligibility without querying another pair's private block documents. The sender's own access and messaging permissions are still checked. The recipient's preview continues to check its viewer's access and block relationship before displaying the post.

The service also creates a missing parent chat once before the message batch, matching the existing rules that read the parent chat when authorizing message creation. The message and its preview are then committed together. Existing chat creation times are preserved.

The send sheet now:

- Uses a native modal with Escape, focus containment, focus restoration, and scroll locking.
- Displays errors inside the sheet.
- Prevents concurrent sends and changing recipients during a send.
- Retains only failed recipients after a partial send, allowing retry without resending successful messages.
- Deduplicates recent recipients when older and canonical chat records refer to the same person. This removed a React duplicate-key warning found during testing.

### Comments

- A submission lock and disabled sending state prevent repeated Enter/click submissions. Shift+Enter and IME composition are preserved.
- Reply selection focuses the composer; failed sends retain the draft.
- Loading errors have an explicit retry state; failed/stale mention searches are handled.
- Own-comment deletion and its post counter are committed in one transaction. Deleting an already-removed comment cannot decrement the count again.
- Comment likes use their existing like documents as the source of truth. They no longer attempt to edit another author's comment counter, which the current rules prohibit. The displayed count follows the actual like collection.
- Comment options have accessible labels and remain visible on touch devices. Copy/report/delete failures have useful feedback.

### Toolbar behavior

Share menus align inward on small screens, close on Escape, and restore focus to their trigger. The seven icons have descriptive tooltips; toggle actions preserve their accessible pressed state.

## Actual verification

The existing Vite process was identified as the repository's server on `http://localhost:5174`. Chrome used an isolated profile. Firebase endpoints were redirected to loopback emulators for demo project `demo-hivez-design`. Synthetic posts, profiles, and messages were created only there.

The test emulator loaded `.audit/app-test-tools/firestore-social.rules`, a byte-identical copy of `firestore.rules`. Both SHA-256 hashes were:

```text
73F6006982CB24EDC0D934E76AE6246A599C495519CF2FECF728A1C7A2DA844F
```

The repository's rules, Firebase configuration, environment variables, and hosted production data were not changed. Nothing was deployed or pushed.

### Passing checks

`scripts/verify-social-actions.mjs`: 8 browser scenarios passed, covering all seven toolbar actions plus cross-author comment likes. Post/message documents, counters, membership, saved records, and ReHive records were inspected through the emulator REST API after the browser operations.

`scripts/verify-social-states.mjs`: 7 further browser scenarios passed:

1. Phone share menu remains inside the screen; Escape restores focus.
2. Send dialog contains keyboard focus; Escape closes and restores focus.
3. A partial DM send retains failed recipients; retry does not duplicate successful sends.
4. Native-share success, cancellation, and unavailable-share fallback handle their respective API contracts.
5. Comment privacy denial preserves the draft and permits a successful retry when commenting is enabled.
6. A followers-only post cannot be sent to a recipient outside its audience.
7. The toolbar has no horizontal page overflow at 320px in either app theme.

The final main browser run recorded no page exceptions or console errors/warnings. The state run recorded no page exceptions and only the intentional comment-privacy denial exercised by the test. Recorded aborted requests were mascot video loads cancelled during navigation; they were not failed social writes.

Evidence:

- `artifacts/social-actions/results.json`
- `artifacts/social-actions/states-results.json`
- `artifacts/social-actions/screenshots/`

The operating system's real native share sheet was not automated. Its API responses were simulated for success, cancellation, and unavailability; clipboard writes and copied-link navigation were real. Hosted Firebase permissions were not inspected; the browser verification uses the checked-in rules above.

### Code checks

- Production build (`npm run build`, including TypeScript): passed.
- Focused ESLint for changed components/services, verification scripts, and the updated service test: passed.
- Existing focused feed tests: 2 passed.
- Existing focused action-service tests: 5 passed, updated for the new recipient-audience helper.
- `git diff --check` for changed tracked code: passed, with Git's existing LF/CRLF conversion notices.

Vite still reports the repository's existing large-chunk and tsconfig-path-plugin recommendations.

## Files changed in this task

| File | Purpose |
| --- | --- |
| `src/components/feed/FeedCard.tsx` | Safe legacy-community creation, share menu alignment/Escape/focus, toolbar descriptions. |
| `src/components/feed/PostSendSheet.tsx` | Accessible modal, recipient deduplication, guarded sends, inline failures, partial-send retry. |
| `src/components/comments/CommentsSheet.tsx` | Send lock, loading retry, draft/error handling, safe mention lookup and reply focus. |
| `src/components/comments/CommentComposer.tsx` | Busy-state protection and composition-aware Enter behavior. |
| `src/components/comments/CommentCard.tsx` | Live like totals, accessible options, clipboard fallback and action feedback. |
| `src/services/comments.ts` | Comment-like persistence compatible with current permissions and atomic deletion/count updates. |
| `src/services/dmSharing.ts` | Recipient audience validation, safe first-chat creation and preserved chat timestamps. |
| `src/services/privacy.ts` | Sharing-specific audience check that does not read another pair's blocks. |
| `src/services/volunteering.ts` | Transactional community initialization and optional author-only post metadata linking. |
| `tests/post-actions.test.ts` | Updated mocked service contract for recipient audience checks. |
| `scripts/verify-social-actions.mjs` | Actual browser/persistence checks for the toolbar actions. |
| `scripts/verify-social-states.mjs` | Mobile, keyboard, privacy, partial-send and share-state checks. |
| `artifacts/social-actions/` | Recorded browser results and screenshots. |
| `SOCIAL_ACTIONS_VERIFICATION_REPORT.md` | This report. |

Temporary emulator configuration and a copy of the unchanged rules were created under `.audit/app-test-tools/`. The working tree contained extensive pre-existing changes; unrelated work was preserved.
