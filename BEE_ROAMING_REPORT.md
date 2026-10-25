# Hivez bee — autonomous viewport flight

Implemented locally on 25 October 2026. This supersedes the cursor-following behaviour described in the earlier landing redesign report. No deployment or backend changes were made.

## What changed

The landing-page bee now explores the visible viewport independently. The original `public/assets/bee-fly.webm` is still the sole mascot source. Its artwork, proportions, colours, wings, original crop, 320 × 180 matte-processing dimensions, transparency treatment and display quality are preserved. No replacement, duplicate bee or new mascot asset was introduced. `src/components/hivez/BeeMascot.tsx`, used elsewhere, was left unchanged.

The old `BeeCursor` controller was removed. Its `mousemove` listener, `clientX/clientY` positioning, pointer-directed GSAP tweens, pointer-derived tilt and cursor-centred honeycomb coordinates are gone. No movement or field-rendering code reads mouse or pointer coordinates. Capability media queries only select the calmer touch treatment; they do not track input position. The native cursor is unchanged.

## Flight design

`beeFlight.ts` holds the animation model; `BeeRoamer.tsx` owns the DOM/canvas controller. Cubic Bézier segments carry the incoming tangent into the next segment where boundaries allow. Variable destination distance, control-point direction and duration create horizontal, vertical and diagonal travel. A small, tapered meander changes the path without introducing a repeating circle or abrupt endpoint offsets.

Controlled randomness chooses among 36 candidate destinations, scoring both endpoints and route samples against headings, paragraphs and interactive controls. The bee favours open space. It occasionally slows to a brief hover only at unobstructed destinations; hover drift ramps in and out. Gentle banking is limited to ±8 degrees. Direction flips use the original mirrored orientation without interpolating the artwork through a distorted shape.

The existing desktop frame remains 208 × 128 pixels. Touch devices, windows narrower than 640 pixels, and viewports shorter than 420 pixels use a calmer 128-pixel-wide frame, slower travel, smaller meanders and longer quiet intervals. This leaves room to explore on small desktop windows too. Very small viewports can uniformly scale the frame only as needed to fit, preserving its aspect ratio.

The layer remains `position: fixed` and `pointer-events: none`. A reserved area below the actual sticky navigation prevents flight over the navbar. Destinations avoid content where space permits; in dense mobile layouts the bee can briefly pass across content, but it never captures taps, clicks, focus or selection. The shared-topic map, signup link and mobile menu were exercised in the browser while the bee was present.

## Viewport containment and resize behaviour

The controller measures `visualViewport` width, height and offsets, falling back to window dimensions. Its safe rectangle accounts for the full rendered frame, a conservative envelope for the maximum 8-degree rotation, the navigation height and edge margins. All Bézier control points are inside that rectangle; the curve stays in their convex hull. The final meander/hover position is also constrained to it.

Window resize, visual-viewport resize/panning and navbar size changes recalculate geometry. Ordinary resizing preserves the bee's exact current screen position whenever it remains valid, then continues with a new inward-capable curve. It does not reset to a spawn point or repeatedly target an edge.

If an instantaneous shrink cuts away the bee's previous location, strict containment requires an immediate correction into the new rectangle. The controller uses the nearest valid point, preserves the safe incoming tangent and continues smoothly. It cannot retain an out-of-screen position while also remaining fully visible. This necessary resize correction is distinct from a flight teleport; normal flight and resizes that still contain the bee preserve position continuity.

Scroll changes refresh content-avoidance geometry at most every 150 ms; they do not place the bee in document coordinates. Measurements are batched outside the per-frame path calculation.

## Honeycomb effect

The original 28-pixel hexagonal lattice, restrained wave and proximity emphasis remain. Its emphasis centre is now the bee's actual rendered centre, including curved-path meander and hover drift. The same position drives the DOM transform and field renderer; no cursor position is retained separately.

Flight uses `requestAnimationFrame`; the honeycomb redraws at 24 fps to keep the effect lightweight. Hex centres are cached until viewport geometry changes. The original restrained theme colours and opacity are retained. No glow or particle cloud was added.

## Performance, accessibility and cleanup

The flight model, curve progress and geometry live in refs/local controller state. Animation frames do not set React state. Movement uses transforms; geometry is measured only on viewport/content changes. There are no movement intervals or mouse listeners.

All requestAnimationFrame callbacks, ResizeObserver subscriptions, scroll/resize listeners, media-query listeners and visibility listeners are removed on cleanup. Navigating into signup removes the roaming component; the shared auth mascot is unaffected.

The existing motion setting and the live `prefers-reduced-motion` query both freeze roaming, banking, field motion and wing playback. The last painted position is preserved, including any meander offset. The visibility handler pauses the controller and video and resumes from retained flight state. A separate `active` playback guard prevents a hidden tab from restarting video while waiting for a suspended animation frame. The original image-processing algorithm is unchanged.

## Files changed for this task

| File | Purpose |
| --- | --- |
| `src/components/landing/BeeCursor.tsx` | Removed the old pointer-driven component. |
| `src/components/landing/BeeRoamer.tsx` | New landing-only animation, geometry, avoidance, honeycomb and lifecycle controller. |
| `src/components/landing/beeFlight.ts` | Curved-flight model, random planning, hover transitions, banking and safe resize rebasing. |
| `src/components/landing/BeeChromaVideo.tsx` | Added the inactive-document playback guard; source asset and matte algorithm retained. |
| `src/pages/Landing/Landing.tsx` | Replaced only the bee import/component with `BeeRoamer`. |
| `src/styles/landing.css` | Replaced the cursor frame selector, added the flight transform wrapper and enabled the calm mascot on touch. Page design styles were preserved. |
| `scripts/bee-flight.test.mjs` | Four deterministic tests for long flight, tight bounds, pause continuity and resize continuity. |
| `scripts/verify-bee-roaming.mjs` | Real-browser roaming, pointer-independence, bounds, scrolling, touch, original-asset and visibility-handler checks. |
| `scripts/verify-landing.mjs` | Updated obsolete cursor-following and touch-hidden assertions to the autonomous behaviour. |
| `BEE_ROAMING_REPORT.md` | This report. |
| `LANDING_REDESIGN_REPORT.md` | Added a pointer to this newer behaviour report. |
| `artifacts/bee-roaming/*` | Actual browser traces and screenshots for this task. |

Existing working-tree changes from the earlier redesign and API/local-server work were preserved. No Firebase/authentication logic, routes, application data, colours, page typography, photography or section layouts were changed.

## Verification

The existing Vite process was identified as this checkout's server and its actual page opened at http://localhost:5173/. Both pre-existing development servers later stopped; a new server was started from this checkout on strict port 5173, and its `BeeRoamer.tsx` module returned HTTP 200 before the final regression check. An isolated Playwright-controlled installed Chrome browser was used. The bee was visually observed at different positions with the mouse untouched; browser frame sampling supplemented direct screenshot observation.

The final machine-readable evidence is in `artifacts/bee-roaming/browser-results.json`. The landing regression run writes separately under `artifacts/bee-roaming/landing-regression/`, preserving the earlier redesign's historical results.

| Check | Actual result |
| --- | --- |
| Production build | Final `npm run build` passed; 3,959 modules transformed; Vite phase 13.64 seconds. Its `tsc -b` passed. Existing chunk-size/configuration warnings remain. |
| Dedicated type check | `node node_modules/typescript/bin/tsc -b --pretty false` exited 0. |
| Focused lint | BeeRoamer, beeFlight, BeeChromaVideo and Landing passed ESLint with no warnings. |
| Flight model tests | `node --test scripts/bee-flight.test.mjs`: **4 passed**. Includes ten simulated minutes, all four directions, hovering, tiny/degenerate safe rectangles, no curve/hover discontinuities, stationary-frame continuity and ordinary-resize position preservation. |
| Roaming browser suite | **12 checks passed** on the actual application. |
| Stationary mouse | Bee moved independently during an 8-second observation. |
| Rapid mouse movement | 45 rapid pointer moves did not control the bee; zero application mousemove/pointermove listeners were registered. Native cursor remained available. |
| Direction and smoothness | Real-time trace covered approximately **34.1 seconds**, with 160 sampled positions and observed **left, down, right, up** travel. Maximum recorded ordinary frame displacement was **1.92 pixels**. |
| Scrolling | All sections through the footer were scrolled and checked; the fixed bee stayed in the visible viewport. |
| Resize/small viewport | Repeated 240?280, 320?320, 320?480, 390?844, 768?600, 844?390, 1440?960 and 1920?1080 sizes; **zero monitored frames outside the viewport**. Includes repeated portrait/landscape changes. |
| Honeycomb | Its centre matched the rendered bee within 5 pixels for **209/209** sampled positions. It updated while the mouse stayed still. |
| Original asset | SHA-256 unchanged: `501111bc4a6a1b1d1ed6a752aea9d70a61705301001437600948834eac7355fd`. Original WebM path, 320?180 canvas, muted playback, opaque artwork and transparent surround verified. |
| Reduced motion | Position and video froze; rapid mouse movement could not move them. Live system-preference changes were tested on touch. |
| Touch | One 128-pixel-wide mascot moved calmly; mobile-menu taps worked. |
| Clickability and cleanup | Map-pin selection and signup CTA worked; roaming layer disappeared on the auth route. All four auth handoffs and remounts also passed the landing regression. |
| Visibility handler | Explicit simulated hidden/visible events paused the position and video, then resumed without a frame jump. Native tab-visibility limitations are stated below. |
| Landing regression | **14 checks passed**: pins, journey, Hive topics, keyboard FAQ, motion toggle, anchors, auth handoffs, responsive widths, menu focus, themes, large text and runtime/network checks. Axe was not rerun for this focused animation task. |
| Console/network | No page/console errors or failed HTTP responses in either completed suite. |

Evidence: [roaming results](artifacts/bee-roaming/browser-results.json), [landing regression results](artifacts/bee-roaming/landing-regression/browser-results.json), [flight start](artifacts/bee-roaming/flight-start.png), [later flight position](artifacts/bee-roaming/flight-later.png), and [touch flight](artifacts/bee-roaming/touch-flight.png).

No blocking animation defect remained in the tested scenarios. The final source scan found no mouse/pointer-coordinate reads or input-move handlers in the flight controller/model. Original mascot assets and the shared auth mascot component have no Git modifications.

## Direction-orientation follow-up (25 October 2026)

The attached browser recording exposed a mismatch between the flight direction and the bee's facing direction. The original artwork faces left, but the controller treated an unmirrored image as facing right. `BeeRoamer.tsx` now mirrors the original artwork when its horizontal travel direction is right, preserving the asset itself. The browser verifier records the artwork transform alongside real movement and checks that the bee faces into its horizontal travel direction. In the follow-up run, **93/93** horizontal samples agreed; all 12 roaming checks passed. Evidence is in [the updated browser results](artifacts/bee-roaming/facing-fix/browser-results.json), with [before-flight screenshot](artifacts/bee-roaming/facing-fix/flight-start.png) and [later position](artifacts/bee-roaming/facing-fix/flight-later.png).


## Reproduction and limits

```powershell
node --test scripts/bee-flight.test.mjs
node scripts/verify-bee-roaming.mjs http://localhost:5173 artifacts/bee-roaming
node scripts/verify-landing.mjs http://localhost:5173 artifacts/bee-roaming/landing-regression
npm run build
```

The browser scripts use externally installed Playwright. `HIVEZ_PLAYWRIGHT_MODULE` can supply its `index.mjs` file URL, and `HIVEZ_CHROME_PATH` can supply the browser executable. Optional `HIVEZ_RECORD_VIDEO=1` requires Playwright's video tooling; screenshots and traces are captured without that dependency.

This automation runtime reports tabs as visible even when another tab is brought forward, in both headless and an isolated visible-browser attempt. Therefore the visibility-handler test explicitly simulates `document.hidden` in the isolated test page and dispatches the visibility event. It verifies pause/resume of position and video; it is not reported as a native background-tab observation. An initial browser-freeze test used an overly strict cross-protocol position comparison and was replaced with this targeted handler test.

The page was exercised locally without creating accounts or changing production data. Real-device Safari testing was not performed. The existing whole-application bundle/configuration warnings remain outside this animation change.
