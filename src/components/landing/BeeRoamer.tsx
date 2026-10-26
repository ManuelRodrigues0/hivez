import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/context/ThemeContext";
import BeeChromaVideo from "./BeeChromaVideo";
import {
  advanceBeeFlight,
  createBeeFlight,
  obstruction,
  reframeBeeFlight,
  restingBeePosition,
} from "./beeFlight";
import type { BeeFlight, FlightBounds, Obstacle } from "./beeFlight";

/** Landing-only flight controller. No mouse/pointer position is read or stored. */
export default function BeeRoamer() {
  const layerRef = useRef<HTMLDivElement>(null);
  const beeRef = useRef<HTMLDivElement>(null);
  const artRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLCanvasElement>(null);
  const flightRef = useRef<BeeFlight | null>(null);
  const boundsRef = useRef<FlightBounds | null>(null);
  const { reducedMotion, publicTheme } = useTheme();
  const [visible, setVisible] = useState(() => !document.hidden);
  const [systemReduced, setSystemReduced] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [touch, setTouch] = useState(
    () => matchMedia("(hover: none), (pointer: coarse)").matches,
  );
  const still = reducedMotion || systemReduced;

  useEffect(() => {
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const coarse = matchMedia("(hover: none), (pointer: coarse)");
    const onMotion = () => setSystemReduced(motion.matches);
    const onInput = () => setTouch(coarse.matches);
    const onVisibility = () => setVisible(!document.hidden);
    motion.addEventListener("change", onMotion);
    coarse.addEventListener("change", onInput);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      motion.removeEventListener("change", onMotion);
      coarse.removeEventListener("change", onInput);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    const bee = beeRef.current;
    const art = artRef.current;
    const canvas = fieldRef.current;
    const ctx = canvas?.getContext("2d");
    if (!layer || !bee || !art || !canvas || !ctx) return;
    const state = flightRef.current || (flightRef.current = createBeeFlight());
    const viewport = window.visualViewport;
    let bounds: FlightBounds = { left: 0, right: 0, top: 0, bottom: 0 };
    let obstacles: Obstacle[] = [];
    let width = 0,
      height = 0,
      beeWidth = 208,
      beeHeight = 128;
    let originX = 0,
      originY = 0;
    let calmFlight = touch;
    let frame = 0,
      measureFrame = 0,
      lastTime = 0,
      lastField = -Infinity,
      lastMeasure = -Infinity,
      lastAvoid = -Infinity;
    let geometryDirty = false;
    const hexes: { x: number; y: number }[] = [];

    const measureObstacles = () => {
      obstacles = [];
      for (const element of document.querySelectorAll<HTMLElement>(
        ".hz-landing h1, .hz-landing h2, .hz-landing h3, .hz-landing p, .hz-landing a, .hz-landing button, .hz-landing input, .hz-landing textarea, .hz-landing select, .hz-landing summary",
      )) {
        const r = element.getBoundingClientRect();
        if (
          !r.width ||
          !r.height ||
          r.bottom < originY ||
          r.top > originY + height
        )
          continue;
        const interactive = element.matches(
          "a,button,input,textarea,select,summary",
        );
        // Use the artwork's visible footprint for avoidance; its full rotated
        // frame is still used separately for strict viewport containment.
        obstacles.push({
          left: r.left - originX - beeWidth * 0.34,
          right: r.right - originX + beeWidth * 0.34,
          top: r.top - originY - beeHeight * 0.4,
          bottom: r.bottom - originY + beeHeight * 0.4,
          weight: interactive ? 5 : element.matches("h1,h2,h3") ? 3 : 1,
        });
      }
      const current = restingBeePosition(state, bounds);
      if (
        !still &&
        obstruction(current, obstacles) > 0 &&
        state.age - lastAvoid > 1.8
      ) {
        state.point = state.visual || state.point;
        state.curve = null;
        state.hover = 0;
        lastAvoid = state.age;
      }
      lastMeasure = performance.now();
      geometryDirty = false;
    };
    const paintField = (x: number, y: number) => {
      ctx.clearRect(0, 0, width, height);
      const radius = calmFlight ? 120 : 180;
      for (const hex of hexes) {
        const distance = Math.hypot(x - hex.x, y - hex.y);
        const alpha =
          0.025 +
          Math.max(0, 1 - distance / radius) * 0.22 +
          (still
            ? 0
            : Math.sin(state.age * 0.9 + (hex.x + hex.y) * 0.005) * 0.012);
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i;
          const dx = hex.x + 26 * Math.cos(angle),
            dy = hex.y + 26 * Math.sin(angle);
          if (i === 0) ctx.moveTo(dx, dy);
          else ctx.lineTo(dx, dy);
        }
        ctx.closePath();
        ctx.strokeStyle = `rgba(${publicTheme === "midnight" ? "255,212,59" : publicTheme === "forest" ? "206,224,156" : "61,101,76"},${Math.max(0.01, alpha)})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      // Exposes the actual field centre for DOM-based verification, not input.
      canvas.dataset.beeX = String(x);
      canvas.dataset.beeY = String(y);
    };
    const paint = (time: number, dt: number) => {
      if (geometryDirty && time - lastMeasure > 150) measureObstacles();
      if (!state.initialized)
        advanceBeeFlight(state, 0, bounds, obstacles, calmFlight);
      const p = still
        ? restingBeePosition(state, bounds)
        : advanceBeeFlight(state, dt, bounds, obstacles, calmFlight);
      bee.style.transform = `translate3d(${p.x - beeWidth / 2}px,${p.y - beeHeight / 2}px,0)`;
      // The original bee artwork faces left. `state.facing` records the
      // horizontal travel direction, so mirror it to face right when moving
      // right and leave the original orientation when moving left.
      art.style.transform = `rotate(${state.bank}deg) scaleX(${-state.facing})`;
      bee.dataset.ready = "true";
      if (time - lastField > 1000 / 24 || still || dt === 0) {
        paintField(p.x, p.y);
        lastField = time;
      }
    };
    const measureViewport = () => {
      width = viewport?.width || window.innerWidth;
      height = viewport?.height || window.innerHeight;
      calmFlight = touch || width < 640 || height < 420;
      originX = viewport?.offsetLeft || 0;
      originY = viewport?.offsetTop || 0;
      layer.style.inset = `${originY}px auto auto ${originX}px`;
      layer.style.width = `${width}px`;
      layer.style.height = `${height}px`;
      const margin = Math.min(
        calmFlight ? 14 : 20,
        width * 0.045,
        height * 0.04,
      );
      const header = document.querySelector(".hz-nav")?.getBoundingClientRect();
      const top = Math.min(
        Math.max(margin, (header?.bottom || 0) - originY + 12),
        Math.max(margin, height - margin - 30),
      );
      const desiredWidth = calmFlight ? 128 : 208;
      const desiredHeight = (desiredWidth * 128) / 208;
      const angle = (8 * Math.PI) / 180;
      const envelopeWidth =
        desiredWidth * Math.cos(angle) + desiredHeight * Math.sin(angle);
      const envelopeHeight =
        desiredHeight * Math.cos(angle) + desiredWidth * Math.sin(angle);
      const scale = Math.max(
        0.01,
        Math.min(
          1,
          (width - margin * 2) / envelopeWidth,
          (height - top - margin) / envelopeHeight,
        ),
      );
      beeWidth = desiredWidth * scale;
      beeHeight = desiredHeight * scale;
      bee.style.width = `${beeWidth}px`;
      bee.style.height = `${beeHeight}px`;
      const rx = (envelopeWidth * scale) / 2,
        ry = (envelopeHeight * scale) / 2;
      bounds = {
        left: margin + rx,
        right: Math.max(margin + rx, width - margin - rx),
        top: top + ry,
        bottom: Math.max(top + ry, height - margin - ry),
      };
      const previousBounds = boundsRef.current;
      if (
        previousBounds &&
        (previousBounds.left !== bounds.left ||
          previousBounds.right !== bounds.right ||
          previousBounds.top !== bounds.top ||
          previousBounds.bottom !== bounds.bottom)
      ) {
        reframeBeeFlight(state, previousBounds, bounds);
      }
      boundsRef.current = bounds;
      canvas.width = Math.ceil(width);
      canvas.height = Math.ceil(height);
      hexes.length = 0;
      const rowHeight = 28 * Math.sqrt(3);
      for (let y = 0, row = 0; y < height + rowHeight; y += rowHeight, row++) {
        for (let x = 0; x < width + 84; x += 84)
          hexes.push({ x: x + (row % 2 ? 42 : 0), y });
      }
      measureObstacles();
      paint(performance.now(), 0);
    };
    const onGeometry = () => {
      geometryDirty = true;
      // Reduced motion has no running animation loop; still keep geometry fresh.
      if (still && !measureFrame)
        measureFrame = requestAnimationFrame(() => {
          measureFrame = 0;
          measureObstacles();
        });
    };
    const tick = (time: number) => {
      const dt = lastTime
        ? Math.min(0.05, Math.max(0, (time - lastTime) / 1000))
        : 0;
      lastTime = time;
      paint(time, dt);
      frame = requestAnimationFrame(tick);
    };
    measureViewport();
    if (visible && !still) frame = requestAnimationFrame(tick);
    const resizeObserver = new ResizeObserver(measureViewport);
    const nav = document.querySelector(".hz-nav");
    if (nav) resizeObserver.observe(nav);
    window.addEventListener("resize", measureViewport);
    window.addEventListener("scroll", onGeometry, { passive: true });
    viewport?.addEventListener("resize", measureViewport);
    viewport?.addEventListener("scroll", measureViewport);
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(measureFrame);
      resizeObserver.disconnect();
      window.removeEventListener("resize", measureViewport);
      window.removeEventListener("scroll", onGeometry);
      viewport?.removeEventListener("resize", measureViewport);
      viewport?.removeEventListener("scroll", measureViewport);
    };
  }, [still, publicTheme, visible, touch]);

  return (
    <div ref={layerRef} aria-hidden="true" className="hz-mascot-layer">
      <canvas ref={fieldRef} className="hz-honeycomb" />
      <div ref={beeRef} className="hz-bee-roamer" data-bee-roamer>
        <div ref={artRef} className="hz-bee-flight">
          <BeeChromaVideo animate={!still} active={visible} />
        </div>
      </div>
    </div>
  );
}
