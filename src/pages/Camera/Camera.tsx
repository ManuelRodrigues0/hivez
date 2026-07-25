import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Image, Type, X } from "lucide-react";

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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  const timerRef = useRef<number | null>(null);
  const holdTimeoutRef = useRef<number | null>(null);
  const didRecordRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newPreviews = files.map((file) => URL.createObjectURL(file));
    setSelectedFiles((prev) => [...prev, ...files]);
    setPreviews((prev) => [...prev, ...newPreviews]);
  }

  function removeFile(index: number) {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  }

  function handleTextPost() {
    if (!textContent.trim()) return;
    navigate("/create", { state: { text: textContent.trim() } });
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

      {mode === "camera" && (
        <>
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

      {/* Mode Selection & Actions */}
      <div className="absolute bottom-0 left-0 right-0 border-t border-zinc-800 bg-black/95 p-4">
        {mode === "camera" ? (
          <div className="flex items-center justify-around">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-1 text-white"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800">
                <Image size={20} />
              </div>
              <span className="text-xs">Gallery</span>
            </button>

            <button
              onClick={() => setMode("text")}
              className="flex flex-col items-center gap-1 text-white"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800">
                <Type size={20} />
              </div>
              <span className="text-xs">Text</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        ) : (
          <div className="space-y-3">
            <textarea
              placeholder="What's on your mind?"
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              rows={4}
              className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-900 p-4 text-sm text-white outline-none focus:border-zinc-600"
              autoFocus
            />

            {previews.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {previews.map((preview, index) => (
                  <div key={index} className="relative flex-shrink-0">
                    <img src={preview} alt="" className="h-20 w-20 rounded-lg object-cover" />
                    <button
                      onClick={() => removeFile(index)}
                      className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 text-sm text-zinc-400"
              >
                <Image size={18} />
                Add photos
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setMode("camera");
                    setTextContent("");
                  }}
                  className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-white"
                >
                  Back
                </button>
                <button
                  onClick={handleTextPost}
                  disabled={!textContent.trim() && selectedFiles.length === 0}
                  className="rounded-full bg-white px-6 py-2 text-sm font-semibold text-black disabled:opacity-50"
                >
                  Post
                </button>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        )}
      </div>
    </main>
  );
}