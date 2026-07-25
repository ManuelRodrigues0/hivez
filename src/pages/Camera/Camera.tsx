import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Type } from "lucide-react";

export default function Camera() {
  const navigate = useNavigate();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [loading, setLoading] = useState(true);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [recording, setRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [mode, setMode] = useState<"camera" | "text">("camera");
  const [textContent, setTextContent] = useState("");

  const timerRef = useRef<number | null>(null);
  const holdTimeoutRef = useRef<number | null>(null);
  const didRecordRef = useRef(false);

  useEffect(() => {
    if (mode !== "camera") return;
    
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: false,
        });

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = async () => {
            try {
              await videoRef.current?.play();
            } catch (e) {
              console.error(e);
            }
            setLoading(false);
          };
        }
      } catch (error) {
        console.error(error);
        if (error instanceof Error) {
          alert(`${error.name}\n${error.message}`);
        } else {
          alert(String(error));
        }
        navigate("/");
      }
    }

    startCamera();

    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [navigate, facingMode, mode]);

  function switchCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    setLoading(true);
    setFacingMode((current) => (current === "environment" ? "user" : "environment"));
  }

  function beginRecording() {
    if (!streamRef.current) return;

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
      streamRef.current?.getTracks().forEach((track) => track.stop());
      navigate("/create", { state: { media: file } });
    };

    recorder.start();
    setRecording(true);
    setRecordTime(0);

    timerRef.current = window.setInterval(() => {
      setRecordTime((time) => time + 1);
    }, 1000);
  }

  function finishRecording() {
    if (!mediaRecorderRef.current) return;
    mediaRecorderRef.current.stop();
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
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
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
    }

    if (recording) {
      finishRecording();
      return;
    }

    if (!didRecordRef.current) {
      capturePhoto();
    }
  }

  function capturePhoto() {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `hivez-${Date.now()}.jpg`, { type: "image/jpeg" });
        streamRef.current?.getTracks().forEach((track) => track.stop());
        navigate("/create", { state: { media: file } });
      },
      "image/jpeg",
      1
    );
  }

  function handleTextPost() {
    if (!textContent.trim()) return;
    navigate("/create", { state: { text: textContent.trim() } });
  }

  return (
    <main className="fixed inset-0 z-50 overflow-hidden bg-black">
      {/* Camera View */}
      {mode === "camera" && (
        <>
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
            {facingMode === "environment" ? "📷 Back Camera" : "🤳 Front Camera"}
          </div>

          {recording && (
            <div className="absolute left-1/2 top-20 -translate-x-1/2 rounded-full bg-red-600 px-5 py-2 font-semibold text-white">
              🔴 {recordTime}s
            </div>
          )}

          {loading && (
            <div className="absolute inset-0 flex items-center justify-center text-white text-lg">
              Opening Camera...
            </div>
          )}

          <button
            onClick={() => {
              streamRef.current?.getTracks().forEach((track) => track.stop());
              navigate("/");
            }}
            className="absolute left-5 top-5 rounded-full bg-black/60 px-4 py-2 text-white"
          >
            Cancel
          </button>

          <button
            onClick={switchCamera}
            className="absolute right-5 top-5 flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-2xl text-white backdrop-blur transition active:rotate-180"
          >
            🔄
          </button>

          <button
            onMouseDown={handlePressStart}
            onMouseUp={handlePressEnd}
            onMouseLeave={handlePressEnd}
            onTouchStart={handlePressStart}
            onTouchEnd={handlePressEnd}
            className="absolute bottom-10 left-1/2 flex h-20 w-20 -translate-x-1/2 items-center justify-center rounded-full border-4 border-white bg-white/20 transition active:scale-90"
          >
            <div className="h-14 w-14 rounded-full bg-white" />
          </button>
        </>
      )}

      {/* Text Mode - Full Screen Overlay */}
      {mode === "text" && (
        <div className="flex h-full flex-col bg-black p-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <button
              onClick={() => {
                setMode("camera");
                setTextContent("");
              }}
              className="text-sm text-zinc-400"
            >
              Cancel
            </button>
            <h1 className="text-base font-semibold text-white">New Post</h1>
            <button
              onClick={handleTextPost}
              disabled={!textContent.trim()}
              className="text-sm font-semibold text-white disabled:opacity-50"
            >
              Post
            </button>
          </div>

          <textarea
            placeholder="What's on your mind?"
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            rows={12}
            className="mt-4 flex-1 resize-none bg-transparent text-lg text-white outline-none placeholder:text-zinc-500"
            autoFocus
          />
        </div>
      )}

      {/* Bottom Actions - Only show in camera mode */}
      {mode === "camera" && (
        <div className="absolute bottom-0 left-0 right-0 border-t border-zinc-800 bg-black/95 p-4">
          <div className="flex items-center justify-around">
            <button
              onClick={() => setMode("text")}
              className="flex flex-col items-center gap-1 text-white"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800">
                <Type size={20} />
              </div>
              <span className="text-xs">Text</span>
            </button>
          </div>
        </div>
      )}
    </main>
  );
}