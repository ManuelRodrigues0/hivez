/**
 * Hivez knowledge for Ultra Bee.
 *
 * This is the single source of truth for what Ultra Bee knows about Hivez.
 * It is bundled into the server-side Ultra Bee API route (api/ultra-bee.ts)
 * and injected into the system prompt, so it is never exposed to the browser
 * as instructions the user could edit.
 *
 * IMPORTANT: keep this accurate to the real product. Verify features in the
 * codebase before listing them under CURRENT FEATURES. Never list planned
 * work as available.
 */

export const HIVEZ_KNOWLEDGE = `
ABOUT HIVEZ
Hivez is a community-driven social platform (its tagline is "Citizen Triage Network") for reporting, discussing and supporting local issues. Citizens post reports about problems in their area, reports are checked with AI verification, communities discuss them, and volunteers organize activities to resolve them.

CURRENT FEATURES (live in the app today)
- Accounts and profiles: sign up / log in with email or Google, guided profile setup, display name, unique @username, profile photo, bio, verified badges, editable profile.
- Creating reports: users pick a category (for example Lost Pet, Garbage/Waste, Broken Road, Blood Request, Missing Person, Damaged Property, Other), add details and photo/video evidence via camera or gallery. Video uploads are supported.
- AI report verification: report media is checked by an on-device AI model plus cloud AI providers (Gemini, xAI, NVIDIA, OpenRouter models) to confirm the media is relevant to the chosen category. Reports get verification levels (high/medium/low confidence) and statuses (pending, ai_checked, requires_review, local_model_only). Urgency levels: normal, important, urgent.
- Privacy: report verification never identifies people. Missing Person reports are only checked for image usability and relevance, with no facial recognition.
- Feed: home feed of reports with ranking.
- Engagement: upvote (like) posts, comment on posts, and share posts (share counter).
- Search: a Search page for finding users, plus people search inside Direct Messages.
- Map: browse reports by location.
- Issue Communities ("Hives"): each category maps to an Issue Community. Communities have Discussion, Chat, Polls, Actions, Progress, Members and Evidence tabs. Members discuss, chat in real time, vote in polls (managers can create, close and reopen them), track progress and submit evidence. Roles include owner, organizer, moderator and member.
- Volunteering: volunteer groups (create/join/leave), volunteer activities with participants and statuses (for example in progress), scheduling, updates and evidence submissions that organizers and moderators can verify.
- Direct messages: real-time one-to-one chats with read receipts, unread counts and push notifications. "Ultra Bee" is Hivez's built-in AI assistant available in Direct Messages.
- Notifications: in-app notification center plus optional web push notifications.
- Navigation: main navigation includes the Home feed, Volunteering, Notifications, Map, Chats, Search, Profile, Settings, and a Create option for new reports.
- Platform: Hivez is a web app that works in desktop and mobile browsers.

PLANNED / NOT YET AVAILABLE (never describe these as live)
- Saving or bookmarking posts
- Reposts
- Duplicate report detection
- Advanced location discovery beyond the current map
- Ultra Bee accessing your personal Hivez data (your posts, groups, activities or notifications) - future authenticated tool access
- Native iOS/Android applications
- Group chats in Direct Messages (currently one-to-one only)
`.trim();
