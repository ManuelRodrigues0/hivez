# Hivez AI Knowledge — Ultra Bee

> **Canonical runtime source:** `lib/ultra-bee/knowledge.ts`
> Ultra Bee's knowledge is injected server-side by `api/ultra-bee.ts` when building the
> system prompt (`lib/ultra-bee/prompt.ts`). This document mirrors that knowledge for
> humans — **when you edit Ultra Bee's knowledge, edit `lib/ultra-bee/knowledge.ts`**
> (it is bundled into the serverless function, so a markdown file alone would not reach the model).

## About Hivez

Hivez is a community-driven social platform ("Citizen Triage Network") for reporting, discussing
and supporting local issues. Citizens post reports about problems in their area, reports are
checked with AI verification, communities discuss them, and volunteers organize activities.

## Currently available (verified in codebase)

- **Accounts & profiles** — email/password + Google sign-in, guided profile setup, display name,
  unique @username, avatar, bio, verified badges, profile editing (`/profile/edit`)
- **Creating reports** — category-based reports (Lost Pet, Garbage/Waste, Broken Road, Blood
  Request, Missing Person, Damaged Property, Other) with structured details and photo/video
  evidence via camera or gallery (video uploads supported)
- **AI report verification** — on-device model (TensorFlow.js) + cloud providers (Gemini, xAI,
  NVIDIA, OpenRouter) checking media relevance; confidence levels and verification statuses;
  urgency levels (normal/important/urgent); no facial recognition
- **Feed** — home feed with ranking (`feedRanking`)
- **Engagement** — upvotes/likes, comments, share counter
- **Search** — user search page + people search in Direct Messages
- **Map** — location-based report browsing (`/map`)
- **Issue Communities ("Hives")** — `/hive/:id` with Discussion, Chat, Polls, Actions, Progress,
  Members, Evidence tabs; roles: owner/organizer/moderator/member
- **Volunteering** — volunteer groups, activities with participants, scheduling, progress
  statuses, evidence submissions and verification (`/volunteering`)
- **Direct messages** — real-time 1:1 chats with read receipts, unread counts, push
  notifications (`/chats`); **Ultra Bee** is the built-in AI assistant participant
- **Notifications** — in-app center + web push (FCM)
- **Admin tools** — role-gated `/admin` area
- **Platform** — responsive web app (desktop + mobile browsers)

## Planned / future (Ultra Bee must never present these as live)

- Saving/bookmarking posts
- Reposts
- Duplicate report detection
- Advanced location discovery beyond the current map
- Ultra Bee access to personal user data (posts, groups, activities, notifications) — future
  authenticated tool/function access
- Native iOS/Android applications
- Group chats in Direct Messages (currently 1:1 only)

## Ultra Bee rules (enforced by the system prompt)

1. Only describe features under "Currently available".
2. If unsure: "I don't have enough information to confirm that feature is currently available in Hivez."
3. Never invent buttons, menus or workflows.
4. Plain text replies, concise, friendly-professional with light bee flavor (max one reference).
