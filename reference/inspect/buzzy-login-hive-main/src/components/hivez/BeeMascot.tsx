import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import stillAsset from "@/assets/bee-still.png.asset.json";
import waveAsset from "@/assets/bee-wave.webp.asset.json";
import flyAsset from "@/assets/bee-fly.webp.asset.json";
import shyAsset from "@/assets/bee-shy.webp.asset.json";

export type BeeMood = "idle" | "excited" | "shy" | "happy" | "sad" | "confused" | "wave" | "fly";

type Props = {
  mood?: BeeMood;
  size?: number;
  className?: string;
  jump?: number;
};

const WAVE_MS = 5600;

/** Frames are pre-keyed to transparency, so every clip shares the exact artwork. */
export function BeeMascot({ mood = "idle", size = 320, className, jump = 0 }: Props) {
  const reduce = useReducedMotion();
  const [waving, setWaving] = useState(false);
  const waveTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (waveTimer.current) window.clearTimeout(waveTimer.current);
  }, []);

  function playWave() {
    setWaving(false);
    if (waveTimer.current) window.clearTimeout(waveTimer.current);
    // restart the clip from its first frame
    window.setTimeout(() => setWaving(true), 20);
    waveTimer.current = window.setTimeout(() => setWaving(false), WAVE_MS + 20);
  }

  // clip choice is content, not decoration — it plays even with reduced motion
  const clip: "still" | "wave" | "fly" | "shy" =
    mood === "shy"
      ? "shy"
      : waving || mood === "wave"
        ? "wave"
        : mood === "fly"
          ? "fly"
          : "still";

  const src =
    clip === "wave"
      ? waveAsset.url
      : clip === "fly"
        ? flyAsset.url
        : clip === "shy"
          ? shyAsset.url
          : stillAsset.url;

  // layered swap: keep the visible frame until the next clip is decoded
  const [shown, setShown] = useState(stillAsset.url);
  const [pending, setPending] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // warm every clip once so a swap never waits on the network
  useEffect(() => {
    for (const url of [stillAsset.url, waveAsset.url, flyAsset.url, shyAsset.url]) {
      const img = new Image();
      img.src = url;
    }
  }, []);

  useEffect(() => {
    if (src === shown) {
      setPending(null);
      setReady(false);
      return;
    }
    setReady(false);
    setPending(src);
  }, [src, shown]);

  const float = reduce
    ? {}
    : { y: [0, -14, 0], transition: { duration: 4.5, repeat: Infinity, ease: "easeInOut" as const } };

  const moodMotion = reduce
    ? {}
    : mood === "excited"
      ? { scale: [1, 1.06, 1.02], rotate: [0, -2, 2, 0] }
      : mood === "happy"
        ? { scale: [1, 1.12, 1], rotate: [0, 360] }
        : mood === "sad"
          ? { rotate: [0, -8, -6, -8], y: 10 }
          : mood === "confused"
            ? { rotate: [0, 6, -6, 0] }
            : { scale: 1, rotate: 0 };

  return (
    <div className={className} style={{ width: size, height: size * 0.87 }}>
      <motion.div
        className="relative h-full w-full will-change-transform"
        animate={{ ...float, ...(jump ? { y: [-0, -70, 0] } : {}) }}
        key={jump}
        transition={
          jump
            ? { duration: 0.75, times: [0, 0.4, 1], ease: [0.34, 1.56, 0.64, 1] }
            : { duration: 4.5, repeat: Infinity, ease: "easeInOut" }
        }
      >
        <motion.div
          className="relative h-full w-full"
          animate={moodMotion}
          transition={{
            duration: mood === "happy" ? 1.1 : 0.9,
            repeat: mood === "idle" || mood === "fly" ? 0 : Infinity,
            repeatDelay: mood === "happy" ? 0.6 : 0.4,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <div className="pointer-events-none absolute -bottom-4 left-1/2 h-8 w-1/2 -translate-x-1/2 rounded-[50%] bg-accent/40 blur-2xl" />

          <button
            type="button"
            onClick={playWave}
            aria-label="Say hi to the Hivez bee"
            className="block h-full w-full cursor-pointer bg-transparent p-0"
          >
            {/* the outgoing clip stays put until the incoming one has decoded, so the bee never blinks out */}
            <img
              src={shown}
              alt="Hivez bee mascot"
              className="absolute inset-0 h-full w-full select-none object-contain"
              style={{ WebkitUserSelect: "none" }}
              draggable={false}
            />
            {pending && (
              <motion.img
                key={pending}
                src={pending}
                alt=""
                aria-hidden="true"
                initial={{ opacity: 0 }}
                animate={{ opacity: ready ? 1 : 0 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
                onLoad={() => setReady(true)}
                onAnimationComplete={() => {
                  if (ready) {
                    setShown(pending);
                    setPending(null);
                  }
                }}
                className="absolute inset-0 h-full w-full select-none object-contain"
                style={{ WebkitUserSelect: "none" }}
                draggable={false}
              />
            )}
          </button>

          {mood === "confused" && (
            <motion.span
              className="pointer-events-none absolute -top-2 left-[52%] text-3xl font-black text-accent"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: [-2, -10, -2] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            >
              ?
            </motion.span>
          )}

          {(mood === "happy" || mood === "excited") && !reduce && (
            <div className="pointer-events-none absolute inset-0">
              {[0, 1, 2, 3, 4].map((i) => (
                <motion.span
                  key={i}
                  className="absolute h-1.5 w-1.5 rounded-full bg-accent"
                  style={{ left: `${20 + i * 15}%`, top: "60%" }}
                  animate={{ y: [-4, -46], opacity: [0.9, 0], scale: [1, 0.4] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.16 }}
                />
              ))}
            </div>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
