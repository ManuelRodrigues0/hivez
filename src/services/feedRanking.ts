import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/firebase/firebase";
import type { FeedPost } from "@/components/feed/Feed";
import { haversineKm, normalizeLocation, type LocationSnapshot } from "@/services/location";

export const RANKING_VERSION = 1;

export const FEED_WEIGHTS = {
  location: 34,
  areaMatch: 8,
  recency: 28,
  engagement: 18,
  engagementRate: 12,
  velocity: 20,
  followedAuthor: 26,
  networkEngagement: 22,
  interest: 16,
  urgency: 44,
  communityAction: 24,
  communityConfirmation: 16,
  contentQuality: 8,
  exploration: 7,
  negativeFeedback: 36,
  resolvedPenalty: 20,
  repeatedAuthorPenalty: 7,
  repeatedCategoryPenalty: 4,
} as const;

const ACTION_WEIGHTS = {
  like: 1,
  comment: 3,
  share: 5,
  save: 4,
  volunteer: 8,
  confirm: 5,
  helpful: 4,
  profileVisit: 1,
  view: 0.05,
} as const;

const URGENT_CATEGORIES = new Set(["electric-hazards", "blood-requests", "missing-persons", "fallen-trees"]);
const LONG_LIVED_CATEGORIES = new Set(["lost-pets", "missing-persons", "blood-requests"]);

export interface RankedPost extends FeedPost {
  distanceKm?: number | null;
  ranking?: {
    version: number;
    score: number;
    reasons: Record<string, number>;
  };
}

interface UserFeedContext {
  uid?: string;
  location?: LocationSnapshot | null;
  category?: string;
  hashtag?: string;
}

interface EngagementEvent {
  postId: string;
  actorId: string;
  type: keyof typeof ACTION_WEIGHTS | "hide" | "report" | "mute";
  category?: string;
  createdAt?: { toDate?: () => Date };
}

export async function loadRankedFeed(context: UserFeedContext): Promise<RankedPost[]> {
  const [recent, followingIds, interactions, activities, communities] = await Promise.all([
    loadRecentPosts(context.category),
    loadFollowingIds(context.uid),
    loadRecentInteractions(context.uid),
    loadVolunteerActivityCounts(),
    loadIssueCommunityByPost(),
  ]);

  const candidates = dedupePosts(recent);
  const filtered = context.hashtag
    ? candidates.filter((post) => post.hashtags?.some((tag) => tag.toLowerCase() === context.hashtag?.toLowerCase()))
    : candidates;
  const userInterests = deriveInterestScores(interactions.ownEvents);

  const ranked = filtered
    .map((post) =>
      rankPost(post, {
        ...context,
        followingIds,
        networkEvents: interactions.networkEventsByPost.get(post.id) || [],
        ownEvents: interactions.ownEventsByPost.get(post.id) || [],
        userInterests,
        volunteerCount: activities.get(post.issueCommunityId || "") || 0,
        community: communities.get(post.id),
      }),
    )
    .sort((a, b) => (b.ranking?.score || 0) - (a.ranking?.score || 0));

  return applyDiversity(ranked);
}

function rankPost(
  post: FeedPost,
  context: UserFeedContext & {
    followingIds: Set<string>;
    networkEvents: EngagementEvent[];
    ownEvents: EngagementEvent[];
    userInterests: Map<string, number>;
    volunteerCount: number;
    community?: DocumentData;
  },
): RankedPost {
  const postLocation = normalizeLocation(post.locationSnapshot);
  const distanceKm = postLocation && context.location ? haversineKm(context.location, postLocation) : null;
  const ageHours = getAgeHours(post.createdAt);
  const engagementRaw = weightedEngagement(post);
  const impressions = Math.max(25, post.impressions || post.views || 0);
  const category = post.category || "community";
  const status = String(context.community?.status || "");

  const locationScore = distanceKm == null ? 0 : Math.exp(-distanceKm / 7) * FEED_WEIGHTS.location;
  const areaMatchScore =
    postLocation?.area && context.location?.area && postLocation.area.toLowerCase() === context.location.area.toLowerCase()
      ? FEED_WEIGHTS.areaMatch
      : 0;
  const halfLife = LONG_LIVED_CATEGORIES.has(category) ? 96 : URGENT_CATEGORIES.has(category) ? 72 : 36;
  const recencyScore = Math.exp(-ageHours / halfLife) * FEED_WEIGHTS.recency;
  const engagementScore = Math.log1p(engagementRaw) * FEED_WEIGHTS.engagement;
  const engagementRateScore = Math.min(1, engagementRaw / impressions) * FEED_WEIGHTS.engagementRate;
  const velocityScore = engagementVelocity(post, ageHours) * FEED_WEIGHTS.velocity;
  const followedAuthorScore = context.followingIds.has(post.uid) ? FEED_WEIGHTS.followedAuthor : 0;
  const networkEngagementScore = networkScore(context.networkEvents) * FEED_WEIGHTS.networkEngagement;
  const interestScore = Math.min(1, context.userInterests.get(category) || 0) * FEED_WEIGHTS.interest;
  const urgencyScore = urgencyScoreFor(post) * FEED_WEIGHTS.urgency;
  const communityActionScore = Math.min(1, context.volunteerCount / 5) * FEED_WEIGHTS.communityAction;
  const communityConfirmationScore = Math.min(1, Math.max(0, Number(context.community?.memberCount || 1) - 1) / 8) * FEED_WEIGHTS.communityConfirmation;
  const contentQualityScore = contentQuality(post) * FEED_WEIGHTS.contentQuality;
  const explorationScore = deterministicExploration(post.id) * FEED_WEIGHTS.exploration;
  const negativeFeedbackScore = negativeScore(context.ownEvents) * FEED_WEIGHTS.negativeFeedback;
  const resolvedPenalty = status === "RESOLVED" || status === "VERIFIED" ? FEED_WEIGHTS.resolvedPenalty : 0;

  const reasons = {
    location: round(locationScore),
    areaMatch: round(areaMatchScore),
    recency: round(recencyScore),
    engagement: round(engagementScore),
    engagementRate: round(engagementRateScore),
    velocity: round(velocityScore),
    followedAuthor: round(followedAuthorScore),
    networkEngagement: round(networkEngagementScore),
    interest: round(interestScore),
    urgency: round(urgencyScore),
    communityAction: round(communityActionScore),
    communityConfirmation: round(communityConfirmationScore),
    contentQuality: round(contentQualityScore),
    exploration: round(explorationScore),
    negativeFeedback: -round(negativeFeedbackScore),
    resolvedPenalty: -round(resolvedPenalty),
  };

  const score = Object.values(reasons).reduce((total, value) => total + value, 0);
  return { ...post, distanceKm, ranking: { version: RANKING_VERSION, score: round(score), reasons } };
}

async function loadRecentPosts(category?: string) {
  const q = category
    ? query(collection(db, "posts"), where("category", "==", category), orderBy("createdAt", "desc"), limit(160))
    : query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(220));
  const snap = await getDocs(q);
  return snap.docs.map((item) => ({ id: item.id, ...item.data() }) as FeedPost);
}

async function loadFollowingIds(uid?: string) {
  const ids = new Set<string>();
  if (!uid) return ids;
  const snap = await getDocs(collection(db, "users", uid, "following"));
  snap.docs.forEach((item) => ids.add(item.id));
  return ids;
}

async function loadRecentInteractions(uid?: string) {
  const ownEvents: EngagementEvent[] = [];
  const networkEvents: EngagementEvent[] = [];
  if (!uid) {
    return { ownEvents, ownEventsByPost: new Map<string, EngagementEvent[]>(), networkEventsByPost: new Map<string, EngagementEvent[]>() };
  }

  const followingIds = await loadFollowingIds(uid);
  const snap = await getDocs(query(collection(db, "postEngagements"), orderBy("createdAt", "desc"), limit(500)));
  snap.docs.forEach((item) => {
    const event = item.data() as EngagementEvent;
    if (event.actorId === uid) ownEvents.push(event);
    if (followingIds.has(event.actorId)) networkEvents.push(event);
  });

  return {
    ownEvents,
    ownEventsByPost: groupByPost(ownEvents),
    networkEventsByPost: groupByPost(networkEvents),
  };
}

async function loadVolunteerActivityCounts() {
  const counts = new Map<string, number>();
  const snap = await getDocs(collection(db, "volunteerActivities"));
  snap.docs.forEach((item) => {
    const data = item.data();
    counts.set(data.communityId, (counts.get(data.communityId) || 0) + Number(data.volunteerCount || 0));
  });
  return counts;
}

async function loadIssueCommunityByPost() {
  const map = new Map<string, DocumentData>();
  const snap = await getDocs(collection(db, "issueCommunities"));
  snap.docs.forEach((item) => {
    const data = item.data();
    if (data.postId) map.set(data.postId, data);
  });
  return map;
}

function weightedEngagement(post: FeedPost) {
  return (
    (post.likes || 0) * ACTION_WEIGHTS.like +
    (post.comments || 0) * ACTION_WEIGHTS.comment +
    (post.shares || 0) * ACTION_WEIGHTS.share +
    (post.saves || 0) * ACTION_WEIGHTS.save +
    (post.confirmations || 0) * ACTION_WEIGHTS.confirm +
    (post.views || 0) * ACTION_WEIGHTS.view
  );
}

function engagementVelocity(post: FeedPost, ageHours: number) {
  const earlyHours = Math.max(0.25, Math.min(ageHours, 24));
  return Math.min(1, weightedEngagement(post) / earlyHours / 25);
}

function networkScore(events: EngagementEvent[]) {
  const capped = events.slice(0, 12).reduce((score, event) => score + (ACTION_WEIGHTS[event.type as keyof typeof ACTION_WEIGHTS] || 0), 0);
  return Math.min(1, capped / 18);
}

function urgencyScoreFor(post: FeedPost) {
  const explicit = typeof post.urgency === "number" ? Math.max(0, Math.min(1, post.urgency)) : 0;
  const category = post.category && URGENT_CATEGORIES.has(post.category) ? 0.85 : 0;
  const text = `${post.caption || ""} ${post.category || ""}`.toLowerCase();
  const keyword = /(urgent|emergency|danger|hazard|missing|blood|accident|fire|exposed wire|flood)/.test(text) ? 0.75 : 0;
  return Math.max(explicit, category, keyword);
}

function contentQuality(post: FeedPost) {
  const caption = post.caption?.trim() || "";
  const hasUsefulText = caption.length > 30 ? 0.45 : caption.length > 5 ? 0.2 : 0;
  const hasMedia = post.mediaUrl || post.mediaItems?.length ? 0.25 : 0;
  const hasCategory = post.category ? 0.15 : 0;
  const hasLocation = normalizeLocation(post.locationSnapshot) ? 0.15 : 0;
  return hasUsefulText + hasMedia + hasCategory + hasLocation;
}

function negativeScore(events: EngagementEvent[]) {
  return events.some((event) => event.type === "report" || event.type === "hide" || event.type === "mute") ? 1 : 0;
}

function deriveInterestScores(events: EngagementEvent[]) {
  const scores = new Map<string, number>();
  events.forEach((event) => {
    if (!event.category) return;
    scores.set(event.category, (scores.get(event.category) || 0) + (ACTION_WEIGHTS[event.type as keyof typeof ACTION_WEIGHTS] || 0.2));
  });
  const max = Math.max(1, ...scores.values());
  scores.forEach((value, key) => scores.set(key, value / max));
  return scores;
}

function applyDiversity(posts: RankedPost[]) {
  const authorCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  return posts
    .map((post) => {
      const authorSeen = authorCounts.get(post.uid) || 0;
      const categorySeen = categoryCounts.get(post.category || "") || 0;
      authorCounts.set(post.uid, authorSeen + 1);
      categoryCounts.set(post.category || "", categorySeen + 1);
      const penalty = authorSeen * FEED_WEIGHTS.repeatedAuthorPenalty + Math.max(0, categorySeen - 2) * FEED_WEIGHTS.repeatedCategoryPenalty;
      return {
        ...post,
        ranking: post.ranking && {
          ...post.ranking,
          score: round(post.ranking.score - penalty),
          reasons: { ...post.ranking.reasons, diversityPenalty: -round(penalty) },
        },
      };
    })
    .sort((a, b) => (b.ranking?.score || 0) - (a.ranking?.score || 0));
}

function dedupePosts(posts: FeedPost[]) {
  return [...new Map(posts.map((post) => [post.id, post])).values()];
}

function groupByPost(events: EngagementEvent[]) {
  const map = new Map<string, EngagementEvent[]>();
  events.forEach((event) => {
    if (!event.postId) return;
    const list = map.get(event.postId) || [];
    list.push(event);
    map.set(event.postId, list);
  });
  return map;
}

function getAgeHours(timestamp: unknown) {
  const date = typeof timestamp === "object" && timestamp && "toDate" in timestamp ? (timestamp as { toDate: () => Date }).toDate() : new Date();
  return Math.max(0.05, (Date.now() - date.getTime()) / 36e5);
}

function deterministicExploration(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) % 1000;
  return hash / 1000;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
