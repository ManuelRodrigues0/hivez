import { Check, RotateCcw, X, ChevronDown, Zap, Grid3x3, Timer, Monitor, Layers } from "lucide-react";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [gridEnabled, setGridEnabled] = useState(false);
  const [timerActive, setTimerActive] = useState(false);
  const [hdEnabled, setHdEnabled] = useState(false);
  const [multiSnapEnabled, setMultiSnapEnabled] = useState(false);

  useEffect(() => {
    async function startCamera() {
      try {
        const constraints: MediaStreamConstraints = {
          video: { 
            facingMode,
            ...(hdEnabled ? { width: { ideal: 1920 }, height: { ideal: 1080 } } : { width: { ideal: 1280 }, height: { ideal: 720 } }),
          },
          audio: true,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
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
  }, [navigate, facingMode, hdEnabled]);

  // Apply flash effect
  function triggerFlash() {
    if (!flashEnabled) return;
    const flash = document.createElement("div");
    flash.className = "fixed inset-0 z-50 bg-white animate-flash";
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 200);
  }

  function switchCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    setLoading(true);
    setFacingMode((current) => (current === "environment" ? "user" : "environment"));
    setMenuOpen(false);
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

    if (!didRecordRef.current) {
      if (timerActive) {
        // Show countdown before capture
        let count = 3;
        const countdownEl = document.createElement("div");
        countdownEl.className = "fixed inset-0 z-50 flex items-center justify-center bg-black/50";
        countdownEl.innerHTML = `<span class="text-7xl font-bold text-white animate-ping" id="countdown">${count}</span>`;
        document.body.appendChild(countdownEl);
        
        const countInterval = setInterval(() => {
          count--;
          const el = document.getElementById("countdown");
          if (el) el.textContent = String(count);
          if (count <= 0) {
            clearInterval(countInterval);
            countdownEl.remove();
            triggerFlash();
            capturePhoto();
          }
        }, 1000);
      } else {
        triggerFlash();
        capturePhoto();
      }
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

  const menuItems = [
    { icon: Zap, label: "Flash", active: flashEnabled, toggle: () => { setFlashEnabled(!flashEnabled); setMenuOpen(false); } },
    { icon: Grid3x3, label: "Grid", active: gridEnabled, toggle: () => { setGridEnabled(!gridEnabled); setMenuOpen(false); } },
    { icon: Timer, label: "Timer", active: timerActive, toggle: () => { setTimerActive(!timerActive); setMenuOpen(false); } },
    { icon: Monitor, label: "HD", active: hdEnabled, toggle: () => { setHdEnabled(!hdEnabled); setMenuOpen(false); } },
    { icon: Layers, label: "Multi Snap", active: multiSnapEnabled, toggle: () => { setMultiSnapEnabled(!multiSnapEnabled); setMenuOpen(false); } },
  ];

  return (
    <main className="fixed inset-0 z-50 overflow-hidden bg-black">
      {/* Video Feed */}
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

      {/* Grid Overlay */}
      {gridEnabled && (
        <div className="pointer-events-none absolute inset-0 z-10">
          <div className="h-full w-full" style={{
            backgroundImage: `
              linear-gradient(to right, rgba(255,255,255,0.2) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255,255,255,0.2) 1px, transparent 1px)
            `,
            backgroundSize: '33.33% 33.33%'
          }} />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            <p className="text-sm font-medium text-white/70">Opening camera...</p>
          </div>
        </div>
      )}

      {/* Top Bar - Snapchat style */}
      <div className="absolute left-0 right-0 top-0 z-30">
        {/* Gradient fade */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 to-transparent h-32" />
        
        <div className="relative flex items-center justify-between px-4 pt-12">
          {/* Left - Close */}
          <button 
            onClick={cancel} 
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition hover:bg-black/50 active:scale-90"
          >
            <X size={22} />
          </button>

          {/* Center - Recording indicator or status */}
          <div className="flex items-center gap-2">
            {recording && (
              <>
                <div className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
                <span className="text-sm font-semibold text-white drop-shadow-lg">
                  {recordTime}s
                </span>
              </>
            )}
            {!recording && captures.length > 0 && (
              <span className="rounded-full bg-black/40 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                {captures.length} captured
              </span>
            )}
          </div>

          {/* Right - Menu trigger */}
          <div className="relative">
            <button 
              onClick={() => setMenuOpen(!menuOpen)} 
              className="flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition hover:bg-black/50 active:scale-90"
            >
              <ChevronDown size={22} className={`transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Slide-down Menu */}
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-14 z-50 w-48 overflow-hidden rounded-2xl border border-white/10 bg-black/80 backdrop-blur-2xl">
                  <div className="py-1">
                    {menuItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.label}
                          onClick={item.toggle}
                          className={`flex w-full items-center gap-3 px-5 py-3.5 text-sm font-medium transition ${
                            item.active
                              ? "text-white bg-white/10"
                              : "text-white/70 hover:text-white hover:bg-white/5"
                          }`}
                        >
                          <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                            item.active ? "bg-white/20" : "bg-white/5"
                          }`}>
                            <Icon size={18} />
                          </div>
                          <span className="flex-1 text-left">{item.label}</span>
                          {item.active && (
                            <div className="h-2 w-2 rounded-full bg-white" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Camera Switch Button */}
      <button
        onClick={switchCamera}
        className="absolute right-5 top-1/2 z-30 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/60 active:scale-90"
      >
        <RotateCcw size={22} />
      </button>

      {/* Captures Preview */}
      {captures.length > 0 && (
        <div className="absolute inset-x-0 bottom-36 z-30 flex justify-center gap-2 px-5">
          {captures.map((file, index) => {
            const previewUrl = URL.createObjectURL(file);
            return (
              <div key={`${file.name}-${index}`} className="group relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl border-2 border-white/30 bg-zinc-900 shadow-lg transition hover:scale-105">
                {file.type.startsWith("video") ? (
                  <video src={previewUrl} className="h-full w-full object-cover" muted playsInline />
                ) : (
                  <img src={previewUrl} alt="" className="h-full w-full object-cover" />
                )}
                <button
                  onClick={() => removeCapture(index)}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition group-hover:opacity-100"
                >
                  <X size={10} />
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1.5">
                  <p className="text-[10px] font-medium text-white">{index + 1}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 z-30">
        {/* Gradient fade */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent h-48" />
        
        <div className="relative flex items-center justify-center pb-8 pt-16">
          {/* Capture Button - Snapchat style */}
          <div className="relative">
            {/* Outer ring */}
            <div className={`absolute -inset-1.5 rounded-full transition-all duration-300 ${
              recording ? "border-4 border-red-500 animate-pulse" : "border-4 border-white/30"
            }`} />
            
            {/* Main button */}
            <button
              onMouseDown={handlePressStart}
              onMouseUp={handlePressEnd}
              onMouseLeave={handlePressEnd}
              onTouchStart={handlePressStart}
              onTouchEnd={handlePressEnd}
              className={`relative flex h-20 w-20 items-center justify-center rounded-full transition-all active:scale-90 ${
                recording ? "bg-red-500 scale-90" : "bg-white/20"
              }`}
            >
              <div className={`h-16 w-16 rounded-full transition-all duration-200 ${
                recording ? "bg-red-500 rounded-lg scale-75" : "bg-white"
              }`} />
            </button>
          </div>
        </div>
      </div>

      {/* Next Button - shown when captures exist */}
      {captures.length > 0 && (
        <button
          onClick={finishPost}
          disabled={recording}
          className="absolute bottom-12 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-white text-black shadow-2xl transition hover:scale-105 active:scale-95 disabled:opacity-40"
        >
          <Check size={24} />
        </button>
      )}
    </main>
  );
}