/**
 * HIVEZ Landing Page - Media Configuration
 * 
 * Replace the paths below with your actual media files.
 * All components reference these constants, so you only need to
 * update the paths here when you have real assets.
 */

export const landingMedia = {
  // Hero background video (autoplay, muted, loop)
  // Recommended: MP4, 1920x1080 or higher, < 10MB for fast loading
  heroVideo: "/videos/demo-hero.mp4",

  // Fallback poster image shown while video loads / if video fails
  // Recommended: JPG/WebP, 1920x1080
  // TEMPORARY: Using the existing auth-bg.jpg until real hero media is provided
  heroPoster: "/auth-bg.jpg",

  // Section media
  aboutImage: "/images/about-community.jpg",
  discoverVideo: "/videos/discover-feed.mp4",
  nearbyImage: "/images/nearby-map.jpg",
  stories: [
    "/images/story-1.jpg",
    "/images/story-2.jpg",
    "/images/story-3.jpg",
    "/images/story-4.jpg",
  ] as string[],
  ctaBackground: "/images/cta-background.jpg",

  // Hive category images
  hiveCategories: {
    "Lost & Found": "/images/hives/lost-found.jpg",
    Roads: "/images/hives/roads.jpg",
    Safety: "/images/hives/safety.jpg",
    Pets: "/images/hives/pets.jpg",
    Environment: "/images/hives/environment.jpg",
    Events: "/images/hives/events.jpg",
    Help: "/images/hives/help.jpg",
    Community: "/images/hives/community.jpg",
  } as Record<string, string>,

  // Mock post media
  mockPosts: {
    post1: "/images/posts/post-1.jpg",
    post2: "/images/posts/post-2.jpg",
    post3: "/images/posts/post-3.jpg",
  } as Record<string, string>,

  // Avatars
  avatars: {
    user1: "/images/avatars/user-1.jpg",
    user2: "/images/avatars/user-2.jpg",
    user3: "/images/avatars/user-3.jpg",
  } as Record<string, string>,
};

export type LandingMedia = typeof landingMedia;