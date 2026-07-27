import { Check, RotateCcw, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Camera() {
  const navigate = useNavigate();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const holdTimeoutRef = useRef<number | null>(null);
  const didRecordRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [recording, setRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [captures, setCaptures] = useState<File[]>([]);

  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: true,
        });

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = async () => {
            try {
              await videoRef.current?.play();
            } catch (error) {
              console.error(error);
            }
            setLoading(false);
          };
        }
      } catch (error) {
        console.error(error);
        alert(error instanceof Error ? `${error.name}\n${error.message}` : String(error));
        navigate("/");
      }
    }

    startCamera();

    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [navigate, facingMode]);

  function switchCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    setLoading(true);
    setFacingMode((current) => (current === "environment" ? "user" : "environment"));
  }

  function beginRecording() {
    if (!streamRef.current || recording) return;

    chunksRef.current = [];
    const recorder = new MediaRecorder(streamRef.current);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const file = new File([blob], `hivez-${Date.now()}.webm`, { type: "video/webm" });
      setCaptures((current) => [...current, file]);
    };

    recorder.start();
    setRecording(true);
    setRecordTime(0);

    timerRef.current = window.setInterval(() => {
      setRecordTime((time) => time + 1);
    }, 1000);
  }

  function finishRecording() {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") return;
    mediaRecorderRef.current.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
  }

  function handlePressStart() {
    didRecordRef.current = false;
    holdTimeoutRef.current = window.setTimeout(() => {
      didRecordRef.current = true;
      beginRecording();
    }, 350);
  }

  function handlePressEnd() {
    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);

    if (recording) {
      finishRecording();
      return;
    }

    if (!didRecordRef.current) capturePhoto();
  }

  function capturePhoto() {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `hivez-${Date.now()}.jpg`, { type: "image/jpeg" });
        setCaptures((current) => [...current, file]);
      },
      "image/jpeg",
      0.95
    );
  }

  function removeCapture(index: number) {
    setCaptures((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function finishPost() {
    if (!captures.length) return;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    navigate("/create", { state: { media: captures } });
  }

  function cancel() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    navigate("/");
  }

  return (
    <main className="fixed inset-0 z-50 overflow-hidden bg-black">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`h-full w-full object-cover transition-transform duration-300 ${
          facingMode === "user" ? "scale-x-[-1]" : ""
        }`}
      />

      <canvas ref={canvasRef} className="hidden" />

      <div className="absolute left-1/2 top-6 -translate-x-1/2 rounded-full bg-black/50 px-5 py-2 text-sm font-medium text-white backdrop-blur">
        {recording ? `Recording ${recordTime}s` : `${captures.length} selected`}
      </div>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-lg text-white">
          Opening camera...
        </div>
      )}

      <button onClick={cancel} className="absolute left-5 top-5 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur">
        <X size={22} />
      </button>

      <button
        onClick={switchCamera}
        className="absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition active:rotate-180"
      >
        <RotateCcw size={21} />
      </button>

      {captures.length > 0 && (
        <div className="absolute inset-x-0 bottom-32 flex gap-2 overflow-x-auto px-5">
          {captures.map((file, index) => {
            const previewUrl = URL.createObjectURL(file);
            return (
              <div key={`${file.name}-${index}`} className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border border-white/30 bg-zinc-900">
                {file.type.startsWith("video") ? (
                  <video src={previewUrl} className="h-full w-full object-cover" muted playsInline />
                ) : (
                  <img src={previewUrl} alt="" className="h-full w-full object-cover" />
                )}
                <button
                  onClick={() => removeCapture(index)}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <button
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
        className={`absolute bottom-10 left-1/2 flex h-20 w-20 -translate-x-1/2 items-center justify-center rounded-full border-4 transition active:scale-90 ${
          recording ? "border-red-500 bg-red-500/30" : "border-white bg-white/20"
        }`}
      >
        <div className={`h-14 w-14 rounded-full ${recording ? "bg-red-500" : "bg-white"}`} />
      </button>

      <button
        onClick={finishPost}
        disabled={!captures.length || recording}
        className="absolute bottom-14 right-5 flex h-14 w-14 items-center justify-center rounded-full bg-white text-black shadow-lg transition disabled:opacity-40"
      >
        <Check size={24} />
      </button>
    </main>
  );
}
