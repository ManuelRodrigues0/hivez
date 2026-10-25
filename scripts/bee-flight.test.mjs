import { test } from "node:test";
import assert from "node:assert/strict";
import {
  advanceBeeFlight,
  createBeeFlight,
  restingBeePosition,
  reframeBeeFlight,
} from "../src/components/landing/beeFlight.ts";

function seeded(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

test("long flights remain bounded, vary direction and include gentle hovers", () => {
  const bounds = { left: 132, right: 1308, top: 184, bottom: 862 };
  const state = createBeeFlight(seeded(345));
  const directions = new Set();
  let hovers = 0,
    previous;
  for (let i = 0; i < 60 * 600; i++) {
    const p = advanceBeeFlight(state, 1 / 60, bounds, [], false);
    assert.ok(
      p.x >= bounds.left &&
        p.x <= bounds.right &&
        p.y >= bounds.top &&
        p.y <= bounds.bottom,
    );
    assert.ok(Math.abs(state.bank) <= 8);
    if (state.velocity.x > 0.001) directions.add("right");
    if (state.velocity.x < -0.001) directions.add("left");
    if (state.velocity.y > 0.001) directions.add("down");
    if (state.velocity.y < -0.001) directions.add("up");
    if (state.hover > 0) hovers++;
    if (previous)
      assert.ok(
        Math.hypot(p.x - previous.x, p.y - previous.y) < 3,
        "No position discontinuity at curve/hover joins",
      );
    previous = p;
  }
  assert.equal(directions.size, 4);
  assert.ok(hovers > 60);
});

test("viewport reflow preserves route progress and stays valid in tiny bounds", () => {
  const state = createBeeFlight(seeded(11));
  const boxes = [
    { left: 132, right: 1308, top: 184, bottom: 862 },
    { left: 120, right: 121, top: 150, bottom: 151 },
    { left: 90, right: 290, top: 134, bottom: 780 },
    { left: 25, right: 25, top: 40, bottom: 40 },
  ];
  for (let i = 0; i < 6000; i++) {
    const b = boxes[Math.floor(i / 100) % boxes.length];
    const p = advanceBeeFlight(state, 1 / 60, b, [], i % 2 === 0);
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
    assert.ok(
      p.x >= b.left && p.x <= b.right && p.y >= b.top && p.y <= b.bottom,
    );
  }
});

test("resting position freezes the last painted meander, rather than snapping to its baseline", () => {
  const state = createBeeFlight(seeded(9));
  const bounds = { left: 100, right: 1100, top: 140, bottom: 800 };
  let p;
  for (let i = 0; i < 180; i++)
    p = advanceBeeFlight(state, 1 / 60, bounds, [], false);
  const rest = restingBeePosition(state, bounds);
  assert.ok(
    Math.abs(p.x - rest.x) < 0.000001 && Math.abs(p.y - rest.y) < 0.000001,
  );
});

test("ordinary resize retains screen position; a cutoff uses the nearest safe point", () => {
  const state = createBeeFlight(seeded(17));
  const original = { left: 130, right: 1300, top: 180, bottom: 860 };
  for (let i = 0; i < 120; i++)
    advanceBeeFlight(state, 1 / 60, original, [], false);
  const before = restingBeePosition(state, original);
  const expanded = { left: 130, right: 1600, top: 180, bottom: 1000 };
  reframeBeeFlight(state, original, expanded);
  assert.deepEqual(restingBeePosition(state, expanded), before);
  const tiny = { left: 90, right: 230, top: 150, bottom: 360 };
  reframeBeeFlight(state, expanded, tiny);
  const point = restingBeePosition(state, tiny);
  assert.equal(point.x, Math.max(tiny.left, Math.min(tiny.right, before.x)));
  assert.equal(point.y, Math.max(tiny.top, Math.min(tiny.bottom, before.y)));
  const first = advanceBeeFlight(state, 0, tiny, [], false);
  assert.deepEqual(first, point);
});
