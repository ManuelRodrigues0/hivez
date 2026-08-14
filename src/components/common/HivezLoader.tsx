import type { CSSProperties } from "react";

type HivezLoaderProps = {
  progress?: number;
  size?: "sm" | "md" | "lg";
  fullScreen?: boolean;
  label?: string;
};

const mascotSrc = "/assets/hivez-honeycomb-loader.webm";

function clampProgress(progress: number) {
  if (Number.isNaN(progress)) return 0;
  return Math.min(100, Math.max(0, progress));
}

export default function HivezLoader({
  progress = 66,
  size = "md",
  fullScreen = false,
  label = "Loading",
}: HivezLoaderProps) {
  const loader = (
    <div
      className={`hivez-loader hivez-loader-${size}`}
      style={{ "--hivez-loader-progress": `${clampProgress(progress)}%` } as CSSProperties}
      role="status"
      aria-label={label}
    >
      <span className="sr-only">{label}</span>
      <div className="hivez-loader-mascot" aria-hidden="true">
        <video
          src={mascotSrc}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          disablePictureInPicture
        />
      </div>
    </div>
  );

  if (!fullScreen) return loader;

  return (
    <div className="hivez-loader-screen">
      {loader}
    </div>
  );
}
