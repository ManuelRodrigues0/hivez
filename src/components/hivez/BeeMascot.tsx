import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import stillUrl from "@/assets/auth/stationary-bee.jpg";
import waveUrl from "@/assets/auth/bee-wave.webm";
import flyUrl from "@/assets/auth/bee-fly.webm";
import shyUrl from "@/assets/auth/bee-shy.webm";

export type BeeMood = "idle" | "excited" | "shy" | "happy" | "sad" | "confused" | "wave" | "fly";

type Props = {
  mood?: BeeMood;
  size?: number;
  className?: string;
  jump?: number;
};

type Clip = "still" | "wave" | "fly" | "shy";

function getClip(mood: BeeMood, waving: boolean): Clip {
  if (mood === "shy") return "shy";
  if (mood === "fly") return "fly";
  if (waving || mood === "wave") return "wave";
  return "still";
}

function getClipSrc(clip: Clip) {
  if (clip === "wave") return waveUrl;
  if (clip === "fly") return flyUrl;
  if (clip === "shy") return shyUrl;
  return "";
}

export function BeeMascot({ mood = "idle", size = 320, className, jump = 0 }: Props) {
  const reduce = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [waving, setWaving] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const clip = getClip(mood, waving);
  const clipSrc = getClipSrc(clip);

  useEffect(() => {
    for (const src of [waveUrl, flyUrl, shyUrl]) {
      const video = document.createElement("video");
      video.src = src;
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      video.load();
    }

    const img = new Image();
    img.src = stillUrl;
  }, []);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const video = videoRef.current;
    setVideoReady(clip === "still");
    if (!video || clip === "still") return;

    video.currentTime = 0;
    const play = video.play();
    if (play) {
      void play.catch(() => {});
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [clip, clipSrc]);

  function playWave() {
    setVideoReady(false);
    setWaving(false);
    window.setTimeout(() => setWaving(true), 20);
  }

  const float = reduce || clip === "still"
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
        animate={{ ...float, ...(jump ? { y: [0, -70, 0] } : {}) }}
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
            repeat: mood === "idle" || mood === "fly" || mood === "shy" ? 0 : Infinity,
            repeatDelay: mood === "happy" ? 0.6 : 0.4,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <button
            type="button"
            onClick={playWave}
            aria-label="Say hi to the Hivez bee"
            className="block h-full w-full cursor-pointer bg-transparent p-0"
          >
            <img
              src={stillUrl}
              alt="Hivez bee mascot"
              className={[
                "absolute inset-0 h-full w-full select-none object-contain transition-opacity duration-150 ease-out",
                clip === "still" || !videoReady ? "opacity-100" : "opacity-0",
              ].join(" ")}
              style={{ WebkitUserSelect: "none" }}
              draggable={false}
            />

            {clip !== "still" && (
              <video
                ref={videoRef}
                key={clipSrc}
                src={clipSrc}
                aria-label="Hivez bee mascot animation"
                className={[
                  "absolute inset-0 h-full w-full select-none object-contain transition-opacity duration-150 ease-out",
                  videoReady ? "opacity-100" : "opacity-0",
                ].join(" ")}
                muted
                playsInline
                preload="auto"
                loop={clip !== "wave"}
                disablePictureInPicture
                onCanPlay={() => setVideoReady(true)}
                onEnded={() => {
                  if (clip === "wave") {
                    setWaving(false);
                    setVideoReady(false);
                  }
                }}
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
