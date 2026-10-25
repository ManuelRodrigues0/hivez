import { useEffect, useRef } from "react";

// Original landing video renderer, including its border-connected matte.
// The source animation, crop, dimensions and colour thresholds are preserved.
export default function BeeChromaVideo({
  animate,
  active = true,
}: {
  animate: boolean;
  active?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    // A hidden tab must not restart playback while its rAF queue is suspended.
    if (!active) {
      video.pause();
      return;
    }

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const offCanvas = document.createElement("canvas");
    const offCtx = offCanvas.getContext("2d", { willReadFrequently: true });
    if (!offCtx) return;

    let animId: number;

    const processFrame = () => {
      if (video.readyState >= 2) {
        const nativeW = video.videoWidth || 320;
        const nativeH = video.videoHeight || 180;

        const cropX = nativeW * 0.05;
        const cropY = nativeH * 0.05;
        const cropW = nativeW * 0.9;
        const cropH = nativeH * 0.9;

        const targetW = 320;
        const targetH = 180;

        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
          offCanvas.width = targetW;
          offCanvas.height = targetH;
        }

        offCtx.clearRect(0, 0, targetW, targetH);
        offCtx.drawImage(
          video,
          cropX,
          cropY,
          cropW,
          cropH,
          0,
          0,
          targetW,
          targetH,
        );
        const frame = offCtx.getImageData(0, 0, targetW, targetH);
        const data = frame.data;

        const visited = new Uint8Array(targetW * targetH);
        const queue = new Int32Array(targetW * targetH);
        let head = 0;
        let tail = 0;

        for (let x = 0; x < targetW; x++) {
          const idxTop = x;
          const idxBottom = (targetH - 1) * targetW + x;
          queue[tail++] = idxTop;
          visited[idxTop] = 1;
          queue[tail++] = idxBottom;
          visited[idxBottom] = 1;
        }

        for (let y = 0; y < targetH; y++) {
          const idxLeft = y * targetW;
          const idxRight = y * targetW + (targetW - 1);
          if (!visited[idxLeft]) {
            queue[tail++] = idxLeft;
            visited[idxLeft] = 1;
          }
          if (!visited[idxRight]) {
            queue[tail++] = idxRight;
            visited[idxRight] = 1;
          }
        }

        while (head < tail) {
          const pixelIdx = queue[head++];
          const dataIdx = pixelIdx * 4;

          const r = data[dataIdx];
          const g = data[dataIdx + 1];
          const b = data[dataIdx + 2];
          const maxVal = Math.max(r, g, b);

          if (maxVal < 25) {
            data[dataIdx + 3] = 0;
          } else if (maxVal < 55) {
            data[dataIdx + 3] = ((maxVal - 25) / 30) * 255;
          } else {
            continue;
          }

          const px = pixelIdx % targetW;
          const py = (pixelIdx / targetW) | 0;

          if (px > 0) {
            const n = pixelIdx - 1;
            if (!visited[n]) {
              visited[n] = 1;
              queue[tail++] = n;
            }
          }
          if (px < targetW - 1) {
            const n = pixelIdx + 1;
            if (!visited[n]) {
              visited[n] = 1;
              queue[tail++] = n;
            }
          }
          if (py > 0) {
            const n = pixelIdx - targetW;
            if (!visited[n]) {
              visited[n] = 1;
              queue[tail++] = n;
            }
          }
          if (py < targetH - 1) {
            const n = pixelIdx + targetW;
            if (!visited[n]) {
              visited[n] = 1;
              queue[tail++] = n;
            }
          }
        }

        ctx.clearRect(0, 0, targetW, targetH);
        ctx.putImageData(frame, 0, 0);
        if (!animate) {
          video.pause();
          return;
        }
      }
      animId = requestAnimationFrame(processFrame);
    };

    video.play().catch(() => {});
    animId = requestAnimationFrame(processFrame);

    return () => {
      cancelAnimationFrame(animId);
      video.pause();
    };
  }, [animate, active]);

  return (
    <>
      <video
        ref={videoRef}
        src="/assets/bee-fly.webm"
        autoPlay
        loop
        muted
        playsInline
        crossOrigin="anonymous"
        className="hz-bee-video"
      />
      <canvas ref={canvasRef} className="hz-bee-art" />
    </>
  );
}
