---
name: Civic Botanical & Honey Modern
colors:
  surface: '#fbf9f4'
  surface-dim: '#dbdad5'
  surface-bright: '#fbf9f4'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f4ee'
  surface-container: '#efeee9'
  surface-container-high: '#e9e8e3'
  surface-container-highest: '#e4e2dd'
  on-surface: '#1b1c19'
  on-surface-variant: '#414943'
  inverse-surface: '#30312d'
  inverse-on-surface: '#f2f1eb'
  outline: '#717973'
  outline-variant: '#c0c9c1'
  surface-tint: '#3a674f'
  primary: '#14422d'
  on-primary: '#ffffff'
  primary-container: '#2d5a43'
  on-primary-container: '#9fcfb2'
  inverse-primary: '#a1d1b4'
  secondary: '#7e5700'
  on-secondary: '#ffffff'
  secondary-container: '#fdbe4f'
  on-secondary-container: '#714d00'
  tertiary: '#583110'
  on-tertiary: '#ffffff'
  tertiary-container: '#734725'
  on-tertiary-container: '#f5b88c'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#bceecf'
  primary-fixed-dim: '#a1d1b4'
  on-primary-fixed: '#002112'
  on-primary-fixed-variant: '#224f39'
  secondary-fixed: '#ffdeac'
  secondary-fixed-dim: '#fabc4c'
  on-secondary-fixed: '#281900'
  on-secondary-fixed-variant: '#604100'
  tertiary-fixed: '#ffdcc5'
  tertiary-fixed-dim: '#f7b98e'
  on-tertiary-fixed: '#301400'
  on-tertiary-fixed-variant: '#673d1b'
  background: '#fbf9f4'
  on-background: '#1b1c19'
  surface-variant: '#e4e2dd'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.03em
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-sm: 1rem
  margin: 2rem
  margin-sm: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

The design system embodies authentic community action, local stewardship, and civic engagement. It merges the grounded reliability of public service and civic responsibility with the warmth, organic vibrancy, and approachability of collective community action.

The design movement blends **Warm Modernist Editorial** and **Tactile Organic Minimalism**:
- **Tone & Mood:** Grounded, trustworthy, neighborly, earnest, and proactive. It avoids cold tech cynicism or algorithmic hyper-stimulation in favor of calm, deliberate information density.
- **Visual Personality:** Cream and parchment foundations layered with forest civic greens and illuminated by warm honey-gold badges. Content is treated as community record: crisp cards, clear provenance tags, and high-legibility social updates.
- **Target Audience:** Civic volunteers, mutual aid groups, neighborhood coordinators, local environmentalists, and everyday citizens seeking tangible local impact.

## Colors

The palette centers on warm earthen tones paired with natural foliage greens and energetic honey amber:

### Primary & Accent Roles
- **Primary Civic Green (`#2D5A43` / `#234735`):** Serves as the bedrock for primary navigation pills, active sidebars, key action commitments, and verified civic badges in Light Mode.
- **Secondary Honey Amber (`#E5A93B` / Dark Mode `#F59E0B`):** Conveys active status, volunteer urgency, alert pips, category tags (e.g., `#LOST-PETS`), and lively calls to action.
- **Tertiary Ochre / Earth (`#8A5A36`):** Secondary contextual tags, geographic ward references, and metadata counters.

### Light Mode Architecture
- **Canvas Base:** `#F7F6F2` (Warm linen cream) with nested cards at `#FFFFFF` or `#FAF9F5`.
- **Borders & Dividers:** Delicate warm boundary `#E4E1D8`.
- **Typography:** `#1C1D1A` for deep primary text, `#575953` for secondary handles and metadata, `#8C8E86` for tertiary disabled states.

### Dark Mode Architecture
- **Canvas Base:** `#121312` with elevated surface modules at `#181A18` and interactive elements at `#202220`.
- **Accent Glow:** Active indicators shift to honey gold `#F59E0B` / `#FBBF24` for luminescent contrast against dark foliage tones.
- **Borders & Dividers:** Subtle deep contour `#2A2C29`.
- **Typography:** `#EDEDE8` primary white-cream text, `#9CA3AF` secondary neutral.

## Typography

The typography couples the geometric warmth and approachable curves of **Plus Jakarta Sans** for brand identity, headings, category tags, and interactive navigation with the utilitarian, highly legible rhythm of **Inter** for long-form updates, feed threads, and incident reports.

- **Headlines:** Set with deliberate negative tracking (`-0.02em` to `-0.03em`) to create a clean, contemporary editorial presence.
- **Labels & Tags:** Uppercase or small-caps badges utilize `label-sm` with slight positive letter spacing (`0.02em` to `0.04em`) to ensure legibility on colored pill containers.
- **Body Rhythm:** Generous line heights (`1.5x` to `1.6x`) prevent visual fatigue across dense community activity feeds.

## Layout & Spacing

The design system operates on a flexible 3-column asymmetric layout designed for community portals:

1. **Left Navigation Rail (Fixed / Collapsible):** 240px to 280px wide on desktop. Houses core community navigation (Feed, Volunteering, Notifications, Map, Hives directory, Settings).
2. **Center Primary Stream (Constrained Fluid):** Max-width 680px to 740px. Optimized for immersive photography, incident updates, and social action conversations.
3. **Right Context Rail (Supplementary):** 280px to 320px wide. Houses live volunteer calls, dispatch updates, and ward-level announcements.

### Form Factor Behavior
- **Desktop (>= 1200px):** 3 columns active. Outer margin `margin` (2rem), gutter `gutter` (1.5rem).
- **Tablet (768px - 1199px):** Left rail compresses into an icon rail (72px) or moves to a slide-out drawer; right rail stacks below or collapses under an "Updates" tab; feed takes primary width.
- **Mobile (< 768px):** Single-column layout. Top sticky navigation bar and bottom app tab bar. Outer canvas padding tightens to `space-md` (1rem).

## Elevation & Depth

Visual hierarchy prioritizes surface tone divergence and soft, natural tactile borders rather than heavy, artificial drop shadows:

- **Surface Layering:**
  - *Layer 0 (Canvas):* Deep background (`#F7F6F2` light, `#121312` dark).
  - *Layer 1 (Card / Container):* Pure elevated panels (`#FFFFFF` light, `#181A18` dark) bounded by 1px solid low-contrast borders (`#E4E1D8` light, `#2A2C29` dark).
  - *Layer 2 (Floating Popovers / Modals):* Elevated surfaces with a soft amber-tinted ambient shadow: `0 8px 30px -4px rgba(28, 29, 26, 0.08)` in Light Mode, and `0 12px 36px -4px rgba(0, 0, 0, 0.6)` with a 1px contour highlight (`#343834`) in Dark Mode.
- **Active Navigation Highlights:** In Light Mode, active navigation items adopt a solid, deep civic green fill (`#2D5A43`) with crisp white iconography; in Dark Mode, active navigation takes an illuminating warm honey-gold fill (`#F59E0B`) with near-black iconography (`#121312`) for high contrast.

## Shapes

The design system implements a friendly, structured corner radius strategy that softens the utilitarian nature of civic data:

- **Standard Elements (`rounded-lg` / 0.75rem to 1rem):** Primary post media, incident cards, search input fields, and right-rail update cards.
- **Interactive Badges & Pills (`rounded-full`):** Category indicators (`#LOST-PETS`), ward counters (`10 WARDS`), status tags (`ACTIVE`, `NEW`), and primary navigation anchors.
- **Avatars & Visual Icons:** Circular masks (`rounded-full`) for individual community members; squircle/rounded-xl masks for Hive group emblems.

## Components

### Buttons & Navigation Items
- **Primary Nav Item:** Solid pill (`rounded-xl` or full pill). In Light Mode, active item is filled with `#2D5A43` with white text/icon. In Dark Mode, active item is filled with honey gold `#F59E0B` with `#121312` text/icon.
- **Action Buttons:**
  - *Primary Action:* Solid civic green background, white label, subtle tap scale (0.98).
  - *Civic Volunteer Action:* Warm honey gold background (`#E5A93B`), dark text (`#1C1D1A`), high-emphasis visibility.
  - *Ghost / Tertiary:* Transparent background, `#575953` text, `#E4E1D8` border on hover.

### Badges & Category Chips
- **Status Chips:** Small-caps pill badge with dot indicator. 
  - *Alert / Urgent (`LOST-PETS`, `WATER LEAKAGE`):* Honey amber background tint (`rgba(229, 169, 59, 0.15)`), bold amber text (`#D97706` light, `#F59E0B` dark), and a small 6px solid gold status dot.
  - *Ward Counter (`10 WARDS`):* Light parchment fill (`#EFECE6`), subtle border, muted neutral text.

### Feed & Post Cards
- **Card Anatomy:** White or deep-charcoal container enclosed by a 1px border.
- **Card Header:** Member avatar on the left, author display name (`headline-sm`), civic handle, timestamp, followed by inline category chip.
- **Media Block:** Large-scale embedded image or video container with rounded inner corners (12px-16px) and high-contrast corner expansion triggers (`[⤢]`).
- **Interaction Bar:** Restrained horizontal row featuring comment count, volunteer sign-up trigger, share, and bookmark icons spaced evenly with comfortable hit targets.

### Input Fields & Search
- **Search Hive Input:** Enclosed capsule (`rounded-xl`), soft background (`#EFECE6` light, `#1E201E` dark), magnifying icon prefix, subtle border transition to primary green on focus.

### Updates & Volunteer Rail
- **Incident Snippet:** Clean vertical stack with micro-status pills (`ACTIVE`, `NEW`), volunteer quota indicators (e.g., "10 volunteers needed"), and a discreet dismiss or resolve action.