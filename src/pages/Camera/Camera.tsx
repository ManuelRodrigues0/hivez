import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Camera() {
  const navigate = useNavigate();

  const videoRef = useRef<HTMLVideoElement>(null);

  const streamRef = useRef<MediaStream | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function startCamera() {
      try {
        const stream =
          await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: {
                ideal: "environment",
              },
            },
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
      streamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });
    };
  }, [navigate]);

  return (
    <main className="fixed inset-0 z-50 bg-black">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="h-full w-full object-cover"
      />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-white text-lg">
          Opening Camera...
        </div>
      )}

      <button
        onClick={() => navigate("/")}
        className="absolute left-5 top-5 rounded-full bg-black/60 px-4 py-2 text-white"
      >
        Cancel
      </button>

      <button
        className="absolute bottom-10 left-1/2 h-20 w-20 -translate-x-1/2 rounded-full border-4 border-white bg-white/20"
      />
    </main>
  );
}