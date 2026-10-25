export type Point = { x: number; y: number };
export type FlightBounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};
export type Obstacle = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  weight: number;
};
type Curve = {
  start: Point;
  c1: Point;
  c2: Point;
  end: Point;
  duration: number;
  age: number;
  hover: number;
  sway: number;
  phase: number;
};
export type BeeFlight = {
  point: Point;
  visual: Point | null;
  velocity: Point;
  curve: Curve | null;
  hover: number;
  hoverDuration: number;
  age: number;
  bank: number;
  facing: number;
  lastTurn: number;
  initialized: boolean;
  random: () => number;
};

const clamp = (value: number, min = 0, max = 1) =>
  Math.max(min, Math.min(max, value));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const toPixels = (p: Point, b: FlightBounds): Point => ({
  x: mix(b.left, b.right, p.x),
  y: mix(b.top, b.bottom, p.y),
});
const toUnit = (p: Point, b: FlightBounds): Point => ({
  x: clamp((p.x - b.left) / Math.max(1, b.right - b.left)),
  y: clamp((p.y - b.top) / Math.max(1, b.bottom - b.top)),
});
const bounded = (p: Point, b: FlightBounds): Point => ({
  x: clamp(p.x, b.left, b.right),
  y: clamp(p.y, b.top, b.bottom),
});

export function obstruction(point: Point, obstacles: Obstacle[]) {
  let cost = 0;
  for (const r of obstacles) {
    if (
      point.x > r.left &&
      point.x < r.right &&
      point.y > r.top &&
      point.y < r.bottom
    )
      cost += r.weight;
  }
  return cost;
}

export function createBeeFlight(random = Math.random): BeeFlight {
  return {
    point: { x: 0.73, y: 0.26 },
    visual: null,
    velocity: { x: 0, y: 0 },
    curve: null,
    hover: 0,
    hoverDuration: 0,
    age: 0,
    bank: 0,
    facing: 1,
    lastTurn: 0,
    initialized: false,
    random,
  };
}

function curvePoint(c: Curve, t: number): Point {
  const a = 1 - t;
  return {
    x:
      a ** 3 * c.start.x +
      3 * a ** 2 * t * c.c1.x +
      3 * a * t ** 2 * c.c2.x +
      t ** 3 * c.end.x,
    y:
      a ** 3 * c.start.y +
      3 * a ** 2 * t * c.c1.y +
      3 * a * t ** 2 * c.c2.y +
      t ** 3 * c.end.y,
  };
}

function plan(
  state: BeeFlight,
  bounds: FlightBounds,
  obstacles: Obstacle[],
  touch: boolean,
) {
  const start = toPixels(state.point, bounds);
  const span = Math.hypot(
    bounds.right - bounds.left,
    bounds.bottom - bounds.top,
  );
  const desiredDistance = Math.min(
    touch ? 220 : 500,
    span * (0.25 + state.random() * 0.5),
  );
  let end = start;
  let best = Infinity;
  // Prefer open destinations AND open routes, rather than pausing over copy.
  for (let i = 0; i < 36; i++) {
    const candidate = toPixels(
      { x: 0.025 + state.random() * 0.95, y: 0.025 + state.random() * 0.95 },
      bounds,
    );
    const distance = Math.hypot(candidate.x - start.x, candidate.y - start.y);
    let score =
      obstruction(candidate, obstacles) * 5 +
      Math.abs(distance - desiredDistance) / Math.max(40, desiredDistance);
    for (const t of [0.25, 0.5, 0.75])
      score +=
        obstruction(
          { x: mix(start.x, candidate.x, t), y: mix(start.y, candidate.y, t) },
          obstacles,
        ) * 0.35;
    score += state.random() * 0.25;
    if (score < best) {
      best = score;
      end = candidate;
    }
  }
  const distance = Math.max(10, Math.hypot(end.x - start.x, end.y - start.y));
  const speed = (touch ? 15 : 29) * (0.8 + state.random() * 0.65);
  const duration = Math.max(3, distance / speed);
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const bend = (state.random() - 0.5) * 1.7;
  const hovering = obstruction(end, obstacles) === 0 && state.random() < 0.42;
  const incoming = {
    x: state.velocity.x * (bounds.right - bounds.left),
    y: state.velocity.y * (bounds.bottom - bounds.top),
  };
  const c1 = bounded(
    {
      x: start.x + (incoming.x * duration) / 3,
      y: start.y + (incoming.y * duration) / 3,
    },
    bounds,
  );
  const c2 = hovering
    ? end
    : bounded(
        {
          x: end.x - Math.cos(angle + bend) * distance * 0.28,
          y: end.y - Math.sin(angle + bend) * distance * 0.28,
        },
        bounds,
      );
  state.curve = {
    start: state.point,
    c1: toUnit(c1, bounds),
    c2: toUnit(c2, bounds),
    end: toUnit(end, bounds),
    duration,
    age: 0,
    hover: hovering ? (touch ? 1.5 : 0.7) + state.random() * 1.8 : 0,
    sway: Math.min(touch ? 5 : 12, distance * 0.045),
    phase: state.random() * Math.PI * 2,
  };
}

/** A C1-continuous cubic flight, with a tapered meander and occasional hovers.
 * Every control point is bounded; a cubic's convex hull stays within that box.
 * Unit coordinates preserve the route's progress during viewport reflow.
 */
export function advanceBeeFlight(
  state: BeeFlight,
  dt: number,
  bounds: FlightBounds,
  obstacles: Obstacle[],
  touch: boolean,
) {
  const previous = toPixels(state.point, bounds);
  state.age += dt;
  if (!state.initialized) {
    let best = obstruction(previous, obstacles);
    for (let i = 0; i < 50 && best > 0; i++) {
      const candidate = { x: state.random(), y: state.random() };
      const cost = obstruction(toPixels(candidate, bounds), obstacles);
      if (cost < best) {
        state.point = candidate;
        best = cost;
      }
    }
    state.initialized = true;
  }
  if (
    state.hover > 0 &&
    obstruction(toPixels(state.point, bounds), obstacles) === 0
  ) {
    state.hover = Math.max(0, state.hover - dt);
    state.velocity = { x: 0, y: 0 };
  } else {
    state.hover = 0;
    if (!state.curve) plan(state, bounds, obstacles, touch);
    const curve = state.curve!;
    curve.age = Math.min(curve.duration, curve.age + dt);
    const t = curve.age / curve.duration;
    const point = curvePoint(curve, t);
    state.point = point;
    const a = 1 - t;
    state.velocity = {
      x:
        (3 *
          (a * a * (curve.c1.x - curve.start.x) +
            2 * a * t * (curve.c2.x - curve.c1.x) +
            t * t * (curve.end.x - curve.c2.x))) /
        curve.duration,
      y:
        (3 *
          (a * a * (curve.c1.y - curve.start.y) +
            2 * a * t * (curve.c2.y - curve.c1.y) +
            t * t * (curve.end.y - curve.c2.y))) /
        curve.duration,
    };
    if (t === 1) {
      state.curve = null;
      state.hover = curve.hover;
      state.hoverDuration = curve.hover;
    }
  }
  const center = toPixels(state.point, bounds);
  const curve = state.curve;
  if (curve) {
    const t = curve.age / curve.duration;
    const taper = Math.sin(t * Math.PI) ** 2;
    center.x += Math.sin(t * Math.PI * 2 + curve.phase) * curve.sway * taper;
    center.y +=
      Math.sin(t * Math.PI * 4 + curve.phase) * curve.sway * 0.6 * taper;
  } else if (state.hover > 0) {
    const ramp =
      Math.sin(
        (Math.min(
          1,
          (state.hoverDuration - state.hover) / 0.5,
          state.hover / 0.5,
        ) *
          Math.PI) /
          2,
      ) ** 2;
    center.x += Math.sin(state.age * 1.3) * 1.5 * ramp;
    center.y += Math.sin(state.age * 1.7) * 2 * ramp;
  }
  const vx = state.velocity.x * (bounds.right - bounds.left);
  const vy = state.velocity.y * (bounds.bottom - bounds.top);
  const targetBank = clamp(vx * 0.09 + vy * 0.06, -8, 8);
  state.bank += (targetBank - state.bank) * (1 - Math.exp(-dt * 3));
  if (
    Math.abs(vx) > 4 &&
    state.age - state.lastTurn > 1.2 &&
    Math.sign(vx) !== state.facing
  ) {
    state.facing = Math.sign(vx);
    state.lastTurn = state.age;
  }
  const safe = bounded(center, bounds);
  state.visual = toUnit(safe, bounds);
  return safe;
}

export function restingBeePosition(state: BeeFlight, bounds: FlightBounds) {
  return toPixels(state.visual || state.point, bounds);
}

/** Keep the current screen position through reflow whenever it still fits.
 * If a sudden shrink removes that space, containment takes priority: project
 * to the nearest safe point and start the next curve with the current tangent.
 */
export function reframeBeeFlight(
  state: BeeFlight,
  before: FlightBounds,
  after: FlightBounds,
) {
  if (!state.initialized) return;
  const point = restingBeePosition(state, before);
  const safe = bounded(point, after);
  const vx = state.velocity.x * (before.right - before.left);
  const vy = state.velocity.y * (before.bottom - before.top);
  state.point = toUnit(safe, after);
  state.visual = state.point;
  state.velocity = {
    x: (safe.x !== point.x ? 0 : vx) / Math.max(1, after.right - after.left),
    y: (safe.y !== point.y ? 0 : vy) / Math.max(1, after.bottom - after.top),
  };
  state.curve = null;
  state.hover = 0;
}
