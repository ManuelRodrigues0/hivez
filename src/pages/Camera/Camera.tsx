import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Camera() {
const navigate = useNavigate();

const videoRef = useRef<HTMLVideoElement>(null);

const canvasRef = useRef<HTMLCanvasElement>(null);

const streamRef = useRef<MediaStream | null>(null);

const [loading, setLoading] = useState(true);

const [facingMode, setFacingMode] = useState<
  "user" | "environment"
>("environment");

useEffect(() => {
async function startCamera() {
try {
const stream =
await navigator.mediaDevices.getUserMedia({
video: {
  facingMode,
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

}, [navigate, facingMode]);

async function switchCamera() {
  streamRef.current
    ?.getTracks()
    .forEach((track) => track.stop());

  setLoading(true);

  setFacingMode((current) =>
    current === "environment"
      ? "user"
      : "environment"
  );
}

function capturePhoto() {
if (
!videoRef.current ||
!canvasRef.current
)
return;

const video = videoRef.current;  

const canvas = canvasRef.current;  

canvas.width = video.videoWidth;  

canvas.height = video.videoHeight;  

const ctx = canvas.getContext("2d");  

if (!ctx) return;  

ctx.drawImage(  
  video,  
  0,  
  0,  
  canvas.width,  
  canvas.height  
);  

canvas.toBlob(  
  (blob) => {  
    if (!blob) return;  

    const file = new File(  
      [blob],  
      `hivez-${Date.now()}.jpg`,  
      {  
        type: "image/jpeg",  
      }  
    );  

    streamRef.current  
      ?.getTracks()  
      .forEach((track) => track.stop());  

    navigate("/create", {  
      state: {  
        media: file,  
      },  
    });  
  },  
  "image/jpeg",  
  1  
);

}

return (
<main className="fixed inset-0 z-50 bg-black">
<video  
ref={videoRef}  
autoPlay  
playsInline  
muted  
className="h-full w-full object-cover"  
/>

<canvas  
    ref={canvasRef}  
    className="hidden"  
  />  

  {loading && (  
    <div className="absolute inset-0 flex items-center justify-center text-white text-lg">  
      Opening Camera...  
    </div>  
  )}  

  <button  
    onClick={() => {  
      streamRef.current  
        ?.getTracks()  
        .forEach((track) => track.stop());  

      navigate("/");  
    }}  
    className="absolute left-5 top-5 rounded-full bg-black/60 px-4 py-2 text-white"  
  >  
    Cancel  
  </button>  

  <button
  onClick={switchCamera}
  className="absolute right-5 top-5 rounded-full bg-black/60 px-4 py-2 text-white"
>
  🔄
</button>

  <button  
    onClick={capturePhoto}  
    className="absolute bottom-10 left-1/2 h-20 w-20 -translate-x-1/2 rounded-full border-4 border-white bg-white/20 active:scale-95 transition"  
  />  
</main>

);
}