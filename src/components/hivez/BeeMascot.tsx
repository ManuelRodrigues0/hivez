import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/context/ThemeContext";
import stillUrl from "@/assets/auth/newbee2.png";
import waveUrl from "@/assets/auth/bee-wave.webm";
import flyUrl from "@/assets/auth/bee-fly.webm";
import shyUrl from "@/assets/auth/bee-shy.webm";
export type BeeMood =
  | "idle"
  | "excited"
  | "shy"
  | "happy"
  | "sad"
  | "confused"
  | "wave"
  | "fly";
type Clip = "still" | "wave" | "fly" | "shy";
const clips = { wave: waveUrl, fly: flyUrl, shy: shyUrl };
type Props = {
  mood?: BeeMood;
  size?: number;
  className?: string;
  onAnimationEnd?: () => void;
  onGreet?: () => void;
};

/** Original auth artwork and clips. Reactions play once, without reshaping art. */
export function BeeMascot({
  mood = "idle",
  size = 260,
  className = "",
  onAnimationEnd,
  onGreet,
}: Props) {
  const [systemReduced, setSystemReduced] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const { reducedMotion } = useTheme();
  const reduce = systemReduced || reducedMotion;
  const videoRef = useRef<HTMLVideoElement>(null);
  const privacyHeld = useRef(false);
  const [wave, setWave] = useState(0);
  const [finishedWave, setFinishedWave] = useState(0);
  const [ready, setReady] = useState(false);
  const [finished, setFinished] = useState(false);
  const [visible, setVisible] = useState(() => !document.hidden);
  const requested: Clip =
    mood === "shy"
      ? "shy"
      : wave > finishedWave
        ? "wave"
        : mood === "fly"
          ? "fly"
          : ["wave", "happy", "excited"].includes(mood)
            ? "wave"
            : "still";
  const clip = reduce ? "still" : requested;
  const src = clip === "still" ? "" : clips[clip];
  useEffect(() => {
    const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
    const handleMotion = () => setSystemReduced(motionQuery.matches);
    const handleVisibility = () => setVisible(!document.hidden);
    motionQuery.addEventListener("change", handleMotion);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      motionQuery.removeEventListener("change", handleMotion);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);
  useEffect(() => {
    // Reset playback only for a new reaction, never on form keystrokes.
    /* eslint-disable react-hooks/set-state-in-effect */
    setReady(false);
    setFinished(false);
    privacyHeld.current = false;
    // Password privacy takes priority over an earlier greeting. Cancel that
    // greeting so it cannot resume later after the field has lost focus.
    if (src === shyUrl) setFinishedWave(wave);
    /* eslint-enable react-hooks/set-state-in-effect */
    const video = videoRef.current;
    if (!video || !src) return;
    video.currentTime = 0;
  }, [src, wave]);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (visible && !reduce && !finished && !privacyHeld.current)
      void video.play().catch(() => {});
    else video.pause();
    return () => video.pause();
  }, [visible, reduce, src, wave, finished]);
  const showVideo = ready && (!finished || clip === "shy");
  return (
    <div
      className={`ha-bee ${className}`}
      style={{ width: size, height: size * 0.87 }}
      data-bee-clip={clip}
    >
      <img
        src={stillUrl}
        alt="Hivez bee mascot"
        width="320"
        height="278"
        draggable={false}
        style={{ opacity: showVideo ? 0 : 1 }}
      />
      {src && (
        <video
          key={`${src}-${wave}`}
          ref={videoRef}
          src={src}
          muted
          playsInline
          preload="auto"
          aria-hidden="true"
          disablePictureInPicture
          style={{ opacity: showVideo ? 1 : 0 }}
          onLoadedData={() => setReady(true)}
          onTimeUpdate={(event) => {
            const video = event.currentTarget;
            // The original shy clip closes its eyes before opening them again.
            // Hold its real closed-eye pose while a password field is active.
            if (
              clip === "shy" &&
              !privacyHeld.current &&
              video.currentTime >= 1.6
            ) {
              privacyHeld.current = true;
              video.pause();
              video.currentTime = 1.7;
              video.dataset.privacyHeld = "true";
            }
          }}
          onEnded={() => {
            setFinished(true);
            setFinishedWave(wave);
            if (clip !== "shy") onAnimationEnd?.();
          }}
        />
      )}
      <button
        type="button"
        className="ha-bee-button"
        aria-label="Say hi to the Hivez bee"
        onClick={() => {
          if (!reduce && !(clip === "wave" && !finished)) {
            setWave((n) => n + 1);
            onGreet?.();
          }
        }}
      />
    </div>
  );
}
