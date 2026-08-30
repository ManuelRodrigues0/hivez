import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Bell,
  Bot,
  Camera,
  CheckCircle2,
  ChevronRight,
  Layers,
  MapPin,
  MessageCircle,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  ThumbsUp,
  Users,
  Zap,
} from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import heroStreet from "@/assets/hero-street.jpg";

gsap.registerPlugin(ScrollTrigger);

const heroStats = [
  { val: "14,280+", label: "Issues Fixed" },
  { val: "420+", label: "Active Wards" },
  { val: "94.2%", label: "AI Verification" },
];

const features = [
  {
    icon: Camera,
    tag: "Instant Capture",
    title: "1-Click Visual Reporting",
    text: "Snap a photo or drop high-res video. Auto-GPS geometry tags exact ward and municipal boundaries in seconds.",
    stat: "< 30s submission",
  },
  {
    icon: ThumbsUp,
    tag: "Civic Signal",
    title: "Community Upvote Gravity",
    text: "Neighbourhood verification drives high-urgency road hazards, leaks, and outages straight to the top of civic queues.",
    stat: "4.8x faster triage",
  },
  {
    icon: Users,
    tag: "Local Circles",
    title: "Neighbourhood Task Forces",
    text: "Rally local volunteers, discuss fixes, add contextual proof, and organize joint neighborhood action.",
    stat: "100% community run",
  },
  {
    icon: Bell,
    tag: "Live Radar",
    title: "Real-Time Verification Radar",
    text: "Automated status feeds ping you when municipal agencies or volunteers verify completion on-site.",
    stat: "Instant alerts",
  },
];

const horizontalSteps = [
  {
    n: "01",
    phase: "Detection",
    title: "Spot, Snap & Geo-Lock",
    desc: "A broken streetlight, leaking main line, or road hazard? Snap proof directly via app. Sub-meter GIS pinning locks the exact jurisdiction and authority without manual paperwork.",
    badge: "Auto GPS Pinning",
    accent: "#3d654c",
  },
  {
    n: "02",
    phase: "Amplification",
    title: "Neighbourhood Consensus",
    desc: "Your report appears on the local ward feed. Nearby residents confirm the issue, upvote severity, and merge duplicate sightings to build undeniable civic weight.",
    badge: "Zero Duplicate Spam",
    accent: "#d97706",
  },
  {
    n: "03",
    phase: "Execution",
    title: "Action & Multi-Channel Dispatch",
    desc: "Issues automatically route to local ward authorities and citizen action groups with full metadata, priority scores, and verified resident impact counts.",
    badge: "Ward-Level Routing",
    accent: "#2563eb",
  },
  {
    n: "04",
    phase: "Verification",
    title: "AI-Verified Proof of Fix",
    desc: "No fake completions. Before-and-after image analysis and mandatory community sign-offs verify that the problem was genuinely solved before the ticket closes.",
    badge: "Vision AI Verified",
    accent: "#059669",
  },
];

const intelligenceItems = [
  {
    title: "Sub-Meter Issue Clustering",
    desc: "AI clusters identical issues filed across the same block into a unified action ticket.",
  },
  {
    title: "Computer-Vision Hazard Scoring",
    desc: "Visual algorithms assess depth, scale, and hazard risks to assign instant urgency scores.",
  },
  {
    title: "Before & After Image Verification",
    desc: "Mandatory spatial match ensures resolution photos correspond to original incident coordinates.",
  },
  {
    title: "Ward Authority Auto-Routing",
    desc: "Direct integration matches coordinates to the exact municipal division responsible.",
  },
];

// Clean Chroma-Key Video Renderer with Canvas Reset & Flood-Fill Matte
function BeeChromaVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const offCanvas = document.createElement("canvas");
    const offCtx = offCanvas.getContext("2d", { willReadFrequently: true });
    if (!offCtx) return;

    let animId: number;

    const processFrame = () => {
      if (video.readyState >= 2 && !video.paused && !video.ended) {
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
        offCtx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH);
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
            if (!visited[n]) { visited[n] = 1; queue[tail++] = n; }
          }
          if (px < targetW - 1) {
            const n = pixelIdx + 1;
            if (!visited[n]) { visited[n] = 1; queue[tail++] = n; }
          }
          if (py > 0) {
            const n = pixelIdx - targetW;
            if (!visited[n]) { visited[n] = 1; queue[tail++] = n; }
          }
          if (py < targetH - 1) {
            const n = pixelIdx + targetW;
            if (!visited[n]) { visited[n] = 1; queue[tail++] = n; }
          }
        }

        ctx.clearRect(0, 0, targetW, targetH);
        ctx.putImageData(frame, 0, 0);
      }
      animId = requestAnimationFrame(processFrame);
    };

    video.play().catch(() => {});
    animId = requestAnimationFrame(processFrame);

    return () => cancelAnimationFrame(animId);
  }, []);

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
        className="hidden"
      />
      <canvas
        ref={canvasRef}
        className="w-full h-full object-contain pointer-events-none drop-shadow-[0_12px_24px_rgba(0,0,0,0.18)]"
      />
    </>
  );
}

export default function Landing() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const beeContainerRef = useRef<HTMLDivElement>(null);
  const card3DRef = useRef<HTMLDivElement>(null);
  const horizontalSectionRef = useRef<HTMLDivElement>(null);
  const horizontalTrackRef = useRef<HTMLDivElement>(null);

  // 1. Honeycomb Canvas Matrix Background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    const hexSize = window.innerWidth < 768 ? 22 : 28;
    const hexHeight = hexSize * Math.sqrt(3);
    let mouse = { x: -1000, y: -1000 };

    const handleCanvasMouse = (e: MouseEvent | TouchEvent) => {
      if ("touches" in e && e.touches.length > 0) {
        mouse.x = e.touches[0].clientX;
        mouse.y = e.touches[0].clientY;
      } else if ("clientX" in e) {
        mouse.x = (e as MouseEvent).clientX;
        mouse.y = (e as MouseEvent).clientY;
      }
    };

    window.addEventListener("mousemove", handleCanvasMouse);
    window.addEventListener("touchmove", handleCanvasMouse, { passive: true });

    function drawHexagon(cx: number, cy: number, r: number, alpha: number) {
      if (!ctx) return;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = `rgba(61, 101, 76, ${alpha})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    let time = 0;
    const render = () => {
      time += 0.015;
      ctx.clearRect(0, 0, width, height);

      for (let y = 0; y < height + hexHeight; y += hexHeight) {
        for (let x = 0; x < width + hexSize * 3; x += hexSize * 3) {
          const row = Math.floor(y / hexHeight);
          const xOffset = row % 2 === 0 ? 0 : hexSize * 1.5;
          const px = x + xOffset;
          const py = y;

          const dist = Math.hypot(mouse.x - px, mouse.y - py);
          const maxDist = window.innerWidth < 768 ? 140 : 180;
          let alpha = 0.04;

          if (dist < maxDist) {
            alpha = 0.04 + (1 - dist / maxDist) * 0.22;
          }

          const wave = Math.sin(time + (px + py) * 0.005) * 0.02;
          drawHexagon(px, py, hexSize - 2, Math.max(0.01, alpha + wave));
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleCanvasMouse);
      window.removeEventListener("touchmove", handleCanvasMouse);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // 2. Master GSAP Engine
  useEffect(() => {
    const ctx = gsap.context(() => {
      const isMobile = window.matchMedia("(max-width: 768px)").matches;

      // Hero Entrance Timeline
      const heroTl = gsap.timeline({ defaults: { ease: "power4.out" } });

      heroTl
        .from(".gsap-hero-badge", { y: -30, opacity: 0, duration: 0.8 })
        .from(".gsap-title-word", { y: 60, opacity: 0, stagger: 0.08, duration: 0.9 }, "-=0.5")
        .from(".gsap-hero-desc", { y: 30, opacity: 0, duration: 0.8 }, "-=0.6")
        .from(".gsap-hero-btn", { scale: 0.9, opacity: 0, stagger: 0.1, duration: 0.6 }, "-=0.5")
        .from(".gsap-hero-stat", { y: 25, opacity: 0, stagger: 0.08, duration: 0.6 }, "-=0.4")
        .from(".gsap-hero-card-wrap", { scale: 0.92, opacity: 0, duration: 1.2, ease: "power3.out" }, "-=0.9");

      // Bee Behavior
      const bee = beeContainerRef.current;
      if (bee) {
        if (!isMobile) {
          // --- DESKTOP (100% ORIGINAL & UNTOUCHED) ---
          gsap.set(bee, { x: window.innerWidth * 0.65, y: 160 });

          let lastX = window.innerWidth * 0.65;
          let lastY = 160;

          const onMouseMove = (e: MouseEvent) => {
            const deltaX = e.clientX - lastX;
            const deltaY = e.clientY - lastY;
            lastX = e.clientX;
            lastY = e.clientY;

            const tilt = Math.max(-20, Math.min(20, deltaX * 1.2));
            const direction = deltaX < 0 ? -1 : 1;

            gsap.to(bee, {
              x: e.clientX - 100,
              y: e.clientY - 60,
              rotation: tilt,
              scaleX: direction,
              duration: 0.7,
              ease: "power2.out",
            });
          };

          window.addEventListener("mousemove", onMouseMove);
        } else {
          // --- MOBILE: SMOOTH 0° FIXED-UPRIGHT PROCEDURAL ROAM & GENTLE TOUCH FOLLOW ---
          let currentPos = {
            x: window.innerWidth * 0.5 - 60,
            y: 130,
          };
          let isUserGuiding = false;
          let resumeTimer: NodeJS.Timeout;
          let activeTween: gsap.core.Tween | null = null;

          // Lock orientation permanently to 0 deg on mobile
          gsap.set(bee, { x: currentPos.x, y: currentPos.y, rotation: 0, scaleX: 1, scaleY: 1 });

          // Ambient hovering breath (vertical sine motion only)
          gsap.to(bee, {
            y: "+=12",
            duration: 1.5,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
          });

          // Constant multi-waypoint roaming loop
          const startAutonomousRoam = () => {
            if (isUserGuiding) return;

            const padding = 16;
            const targetX = padding + Math.random() * (window.innerWidth - 145);
            const targetY = 70 + Math.random() * (window.innerHeight - 170);

            const dist = Math.hypot(targetX - currentPos.x, targetY - currentPos.y);
            const duration = Math.max(2.8, dist / 90);

            activeTween = gsap.to(bee, {
              x: targetX,
              y: targetY,
              rotation: 0,
              duration,
              ease: "sine.inOut",
              onUpdate: () => {
                currentPos.x = Number(gsap.getProperty(bee, "x"));
                currentPos.y = Number(gsap.getProperty(bee, "y"));
              },
              onComplete: () => {
                if (!isUserGuiding) {
                  startAutonomousRoam();
                }
              },
            });
          };

          startAutonomousRoam();

          // Smooth touch guidance (Slowly navigates to touched spot without snapping/teleporting)
          const handleTouchGlide = (e: TouchEvent) => {
            if (e.touches.length === 0) return;
            isUserGuiding = true;
            clearTimeout(resumeTimer);
            if (activeTween) activeTween.kill();

            const touch = e.touches[0];
            const destX = Math.max(10, Math.min(window.innerWidth - 135, touch.clientX - 60));
            const destY = Math.max(50, Math.min(window.innerHeight - 110, touch.clientY - 45));

            gsap.to(bee, {
              x: destX,
              y: destY,
              rotation: 0,
              duration: 1.5,
              ease: "power1.out",
              overwrite: "auto",
              onUpdate: () => {
                currentPos.x = Number(gsap.getProperty(bee, "x"));
                currentPos.y = Number(gsap.getProperty(bee, "y"));
              },
            });

            resumeTimer = setTimeout(() => {
              isUserGuiding = false;
              startAutonomousRoam();
            }, 3000);
          };

          window.addEventListener("touchstart", handleTouchGlide, { passive: true });
          window.addEventListener("touchmove", handleTouchGlide, { passive: true });

          return () => {
            clearTimeout(resumeTimer);
            if (activeTween) activeTween.kill();
            window.removeEventListener("touchstart", handleTouchGlide);
            window.removeEventListener("touchmove", handleTouchGlide);
          };
        }
      }

      // 3D Card Hover & Scroll Levitation
      const card = card3DRef.current;
      if (card) {
        if (!isMobile) {
          const onCardMove = (e: MouseEvent) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            gsap.to(card, {
              rotationY: x * 0.045,
              rotationX: -y * 0.045,
              transformPerspective: 1200,
              ease: "power1.out",
              duration: 0.35,
            });
          };

          const onCardLeave = () => {
            gsap.to(card, { rotationY: 0, rotationX: 0, duration: 0.8, ease: "power2.out" });
          };

          card.addEventListener("mousemove", onCardMove);
          card.addEventListener("mouseleave", onCardLeave);

          gsap.to(card, {
            scrollTrigger: {
              trigger: card,
              start: "top 60%",
              end: "bottom top",
              scrub: 1.5,
            },
            y: -80,
            rotationZ: -2,
            scale: 0.98,
          });
        } else {
          // Mobile: Kinetic Tilt Fade on Scroll
          gsap.from(card, {
            scrollTrigger: {
              trigger: card,
              start: "top 85%",
            },
            y: 45,
            opacity: 0,
            scale: 0.95,
            duration: 0.8,
            ease: "power3.out",
          });
        }
      }

      // Interactive Magnetic Buttons (Desktop only)
      if (!isMobile) {
        const magnetics = gsap.utils.toArray<HTMLElement>(".gsap-magnetic");
        magnetics.forEach((btn) => {
          btn.addEventListener("mousemove", (e) => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            gsap.to(btn, { x: x * 0.35, y: y * 0.35, duration: 0.25, ease: "power2.out" });
          });
          btn.addEventListener("mouseleave", () => {
            gsap.to(btn, { x: 0, y: 0, duration: 0.6, ease: "elastic.out(1, 0.35)" });
          });
        });
      }

      // Horizontal Scroll Pipeline (Pinned Stage on Desktop, stacked on Mobile)
      const track = horizontalTrackRef.current;
      const section = horizontalSectionRef.current;
      if (track && section && !isMobile) {
        const totalScroll = track.scrollWidth - window.innerWidth;
        gsap.to(track, {
          x: () => -totalScroll - 96,
          ease: "none",
          scrollTrigger: {
            trigger: section,
            pin: true,
            scrub: 1,
            start: "top top",
            end: () => `+=${totalScroll * 1.3}`,
            invalidateOnRefresh: true,
          },
        });
      }

      // Mobile Specific Scroll Staggers
      if (isMobile) {
        gsap.from(".gsap-mobile-stat-box", {
          scrollTrigger: {
            trigger: ".gsap-hero-stat",
            start: "top 90%",
          },
          scale: 0.85,
          opacity: 0,
          stagger: 0.1,
          duration: 0.6,
          ease: "back.out(1.5)",
        });

        gsap.from(".gsap-mobile-feature-card", {
          scrollTrigger: {
            trigger: "#features",
            start: "top 85%",
          },
          x: -25,
          opacity: 0,
          stagger: 0.12,
          duration: 0.7,
          ease: "power2.out",
        });

        gsap.from(".gsap-mobile-step-card", {
          scrollTrigger: {
            trigger: "#how",
            start: "top 80%",
          },
          y: 35,
          opacity: 0,
          stagger: 0.15,
          duration: 0.7,
          ease: "power2.out",
        });
      } else {
        // Desktop Features Reveal
        gsap.from(".gsap-feature-card", {
          scrollTrigger: {
            trigger: "#features",
            start: "top 75%",
          },
          y: 60,
          opacity: 0,
          stagger: 0.12,
          duration: 0.9,
          ease: "power3.out",
        });

        // Desktop Intelligence Section Cards
        gsap.from(".gsap-intel-card", {
          scrollTrigger: {
            trigger: "#intelligence",
            start: "top 80%",
          },
          y: 40,
          opacity: 0,
          stagger: 0.1,
          duration: 0.8,
          ease: "power3.out",
        });
      }

      // Velocity Marquee
      let marqueeSpeed = 1;
      const marqueeTween = gsap.to(".gsap-marquee-content", {
        xPercent: -50,
        repeat: -1,
        duration: 22,
        ease: "none",
      });

      ScrollTrigger.create({
        onUpdate: (self) => {
          const velocity = Math.abs(self.getVelocity() / 300);
          marqueeSpeed = Math.max(1, velocity);
          gsap.to(marqueeTween, { timeScale: marqueeSpeed, duration: 0.3, overwrite: "auto" });
          gsap.delayedCall(0.4, () => {
            gsap.to(marqueeTween, { timeScale: 1, duration: 0.8 });
          });
        },
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative min-h-screen bg-[#f7f7f2] font-sans text-[#1c1d1a] selection:bg-[#3d654c]/20 selection:text-[#2d4d38] overflow-x-hidden"
    >
      {/* Dynamic Honeycomb Matrix Canvas */}
      <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-0 h-full w-full opacity-60" />

      {/* Floating Animated Bee Video Companion */}
      <div
        ref={beeContainerRef}
        className="pointer-events-none fixed top-0 left-0 z-50 w-32 h-20 md:w-52 md:h-32 touch-none select-none"
        style={{ willChange: "transform" }}
      >
        <BeeChromaVideo />
      </div>

      {/* Top Navbar */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-[#1c1d1a]/10 bg-[#f7f7f2]/85 px-4 py-3.5 backdrop-blur-xl md:px-12 md:py-4">
        <Link to="/" className="flex items-center gap-2 text-xl font-black tracking-tight text-[#1c1d1a] md:text-2xl">
          <span className="flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-xl bg-[#3d654c] text-white text-sm md:text-base">H</span>
          <span>Hivez</span>
        </Link>
        <nav className="hidden items-center gap-8 text-xs font-extrabold uppercase tracking-[0.16em] text-[#1c1d1a]/70 md:flex">
          <a href="#features" className="transition hover:text-[#3d654c]">Features</a>
          <a href="#how" className="transition hover:text-[#3d654c]">How It Works</a>
          <a href="#intelligence" className="transition hover:text-[#3d654c]">Intelligence</a>
          <a href="#community" className="transition hover:text-[#3d654c]">Community</a>
        </nav>
        <div className="flex items-center gap-2 md:gap-3">
          <Link
            to="/signup"
            className="hidden text-xs font-bold uppercase tracking-wider text-[#1c1d1a]/80 hover:text-[#1c1d1a] sm:inline-block px-3 py-2"
          >
            Log in
          </Link>
          <Link
            to="/signup"
            className="gsap-magnetic inline-flex items-center rounded-full bg-[#3d654c] px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm transition hover:bg-[#32533e] md:px-6 md:py-2.5 md:text-xs"
          >
            Join Hivez
          </Link>
        </div>
      </header>

      <main className="relative z-10">
        {/* HERO SECTION */}
        <section className="relative mx-auto grid max-w-7xl items-center gap-8 px-4 pt-6 pb-12 md:grid-cols-[1.1fr_0.9fr] md:gap-12 md:px-12 md:pt-20 md:pb-28">
          <div>
            <div className="gsap-hero-badge inline-flex items-center gap-2 rounded-full border border-[#3d654c]/20 bg-[#3d654c]/10 px-3.5 py-1 text-[11px] font-bold tracking-wider text-[#3d654c] uppercase md:px-4 md:py-1.5 md:text-xs">
              <Sparkles size={13} /> The Civic Action Network
            </div>

            <h1 className="mt-4 text-3xl font-black tracking-tight text-[#1c1d1a] sm:text-5xl md:text-7xl leading-[1.05]">
              <span className="gsap-title-word block">Report the flaws.</span>
              <span className="gsap-title-word block text-[#3d654c]">Rally the street.</span>
              <span className="gsap-title-word block">See real fixes.</span>
            </h1>

            <p className="gsap-hero-desc mt-4 max-w-xl text-sm leading-relaxed text-[#1c1d1a]/70 sm:text-base md:mt-6 md:text-lg font-medium">
              Transform every broken streetlight, road hazard, and water burst into an actionable, community-backed ticket with AI verified resolution tracking.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3 md:mt-10 md:gap-4">
              <Link
                to="/signup"
                className="gsap-hero-btn gsap-magnetic inline-flex items-center gap-2 rounded-full bg-[#3d654c] px-6 py-3 text-xs font-bold text-white shadow-lg shadow-[#3d654c]/25 transition hover:bg-[#32533e] md:px-8 md:py-4 md:text-sm"
              >
                Start Reporting Now <ArrowUpRight size={16} />
              </Link>
              <a
                href="#how"
                className="gsap-hero-btn gsap-magnetic inline-flex items-center gap-2 rounded-full border border-[#1c1d1a]/15 bg-white px-5 py-3 text-xs font-bold text-[#1c1d1a] shadow-sm transition hover:bg-[#ecece5] md:px-7 md:py-4 md:text-sm"
              >
                Watch Workflow
              </a>
            </div>

            <div className="mt-8 grid grid-cols-3 gap-2 border-t border-[#1c1d1a]/10 pt-4 md:mt-14 md:gap-6 md:pt-6">
              {heroStats.map((stat) => (
                <div key={stat.label} className="gsap-hero-stat gsap-mobile-stat-box">
                  <p className="text-lg font-black text-[#1c1d1a] sm:text-2xl md:text-3xl tracking-tight">{stat.val}</p>
                  <p className="mt-0.5 text-[10px] font-bold tracking-wider text-[#1c1d1a]/60 uppercase md:text-[11px]">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 3D Glass Incident Preview Card */}
          <div className="gsap-hero-card-wrap relative flex justify-center mt-2 md:mt-0">
            <div
              ref={card3DRef}
              className="w-full max-w-md rounded-2xl border border-[#1c1d1a]/10 bg-white p-4 shadow-xl backdrop-blur-xl transition-shadow duration-500 hover:shadow-2xl md:rounded-3xl md:p-6"
              style={{ transformStyle: "preserve-3d" }}
            >
              <div className="flex items-center justify-between border-b border-[#1c1d1a]/10 pb-3 md:pb-4">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5 md:h-3 md:w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#3d654c] opacity-75"></span>
                    <span className="relative inline-flex h-2.5 w-2.5 md:h-3 md:w-3 rounded-full bg-[#3d654c]"></span>
                  </span>
                  <div>
                    <h4 className="font-extrabold text-[#1c1d1a] text-xs uppercase tracking-wider md:text-sm">Live Ward Signal</h4>
                    <p className="text-[10px] text-[#1c1d1a]/60 font-semibold md:text-[11px]">Ward 112 • Indiranagar</p>
                  </div>
                </div>
                <span className="rounded-full bg-[#3d654c]/10 px-2.5 py-0.5 text-[11px] font-bold text-[#3d654c] md:px-3 md:py-1 md:text-xs">
                  Urgent
                </span>
              </div>

              <div className="mt-3 overflow-hidden rounded-xl border border-[#1c1d1a]/10 bg-[#f7f7f2] md:mt-4 md:rounded-2xl">
                <div className="relative h-36 w-full overflow-hidden sm:h-44 md:h-48">
                  <img
                    src={heroStreet}
                    alt="Active street issue"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-md md:bottom-3 md:left-3 md:gap-1.5 md:px-3 md:py-1 md:text-xs">
                    <MapPin size={11} className="text-emerald-400" /> 8th Main Road • 0.3 km
                  </span>
                </div>

                <div className="p-3.5 bg-white md:p-4">
                  <span className="inline-block rounded-full bg-[#f3f4ee] px-2 py-0.5 text-[10px] font-extrabold text-[#3d654c] uppercase tracking-wider md:px-2.5 md:text-[11px]">
                    Infrastructure & Water
                  </span>
                  <h5 className="mt-1.5 font-black text-[#1c1d1a] text-sm leading-snug md:mt-2 md:text-base">
                    Severe Main Pipe Burst Flooding Roadway
                  </h5>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#1c1d1a]/70 md:text-xs">
                    High pressure leak eroding subgrade asphalt for 3+ hours near bus interchange.
                  </p>

                  <div className="mt-3 flex items-center justify-between border-t border-[#1c1d1a]/10 pt-2.5 text-[11px] font-bold text-[#1c1d1a]/80 md:mt-4 md:pt-3 md:text-xs">
                    <span className="flex items-center gap-1 text-[#3d654c] md:gap-1.5">
                      <ThumbsUp size={13} /> 312 Backed
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle size={13} /> 48
                    </span>
                    <span className="flex items-center gap-1 text-[#1c1d1a]/60 hover:text-[#1c1d1a] cursor-pointer">
                      <Share2 size={13} /> Share
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-2.5 flex items-center justify-between rounded-xl bg-[#f3f4ee] p-2.5 text-[11px] font-bold text-[#1c1d1a] md:mt-3.5 md:p-3 md:text-xs">
                <div className="flex items-center gap-1.5 md:gap-2">
                  <Zap size={13} className="text-amber-600" />
                  <span>AI Urgency: 88/100 (Critical)</span>
                </div>
                <ChevronRight size={13} className="text-[#1c1d1a]/40" />
              </div>
            </div>
          </div>
        </section>

        {/* INFINITE SCROLLING VELOCITY MARQUEE */}
        <section className="border-y border-[#1c1d1a]/10 bg-[#f3f4ee] py-3.5 md:py-5 overflow-hidden whitespace-nowrap">
          <div className="gsap-marquee-content inline-flex gap-6 md:gap-8 text-xs md:text-sm font-black uppercase tracking-[0.2em] text-[#1c1d1a]/60">
            {Array.from({ length: 4 }).flatMap(() => [
              "Pothole Repair",
              "•",
              "Water Main Outages",
              "•",
              "Streetlight Blackouts",
              "•",
              "Illegal Dumping",
              "•",
              "Encroachment Clearances",
              "•",
              "Tree Hazard Removal",
              "•",
            ]).map((item, idx) => (
              <span key={idx} className={item === "•" ? "text-[#3d654c]" : "hover:text-[#1c1d1a]"}>
                {item}
              </span>
            ))}
          </div>
        </section>

        {/* WORKFLOW SECTION */}
        <section ref={horizontalSectionRef} id="how" className="relative bg-[#1c1d1a] text-[#f7f7f2] flex flex-col justify-center py-14 md:py-0 md:h-screen overflow-hidden">
          <div className="px-4 md:px-16 mb-6 md:mb-8 max-w-7xl w-full">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.24em] text-[#9bc59f] md:text-xs">
              <Layers size={13} /> Pinned Architecture
            </div>
            <h2 className="mt-1.5 text-2xl md:text-5xl font-black text-white">How An Issue Gets Fixed</h2>
          </div>

          <div ref={horizontalTrackRef} className="flex flex-col md:flex-row gap-4 px-4 md:px-0 md:gap-8 md:pl-16 w-full md:w-max">
            {horizontalSteps.map((step) => (
              <div
                key={step.n}
                className="gsap-mobile-step-card w-full md:w-[460px] shrink-0 rounded-2xl md:rounded-3xl border border-white/10 bg-white/5 p-5 md:p-10 backdrop-blur-xl flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-3xl md:text-5xl font-black text-white/20">{step.n}</span>
                    <span className="rounded-full bg-white/10 px-3 py-0.5 text-[10px] md:text-xs font-bold uppercase tracking-wider text-[#9bc59f]">
                      {step.phase}
                    </span>
                  </div>
                  <h3 className="mt-3.5 md:mt-6 text-lg md:text-2xl font-black text-white leading-tight">{step.title}</h3>
                  <p className="mt-2 md:mt-4 text-xs md:text-base leading-relaxed text-white/70">{step.desc}</p>
                </div>
                <div className="mt-5 pt-3 md:mt-8 md:pt-4 border-t border-white/10 flex items-center justify-between text-[11px] md:text-xs font-bold text-[#9bc59f]">
                  <span>{step.badge}</span>
                  <CheckCircle2 size={15} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* HIGH-IMPACT FEATURES GRID */}
        <section id="features" className="mx-auto max-w-7xl px-4 py-14 md:px-12 md:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#3d654c] md:text-xs">Engineered for Impact</p>
            <h2 className="mt-1.5 text-2xl font-black tracking-tight text-[#1c1d1a] md:text-5xl">
              Tools that turn complaints into coordination.
            </h2>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 md:mt-16 md:gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="gsap-feature-card gsap-mobile-feature-card group rounded-2xl border border-[#1c1d1a]/10 bg-white p-5 md:p-8 transition-all duration-300 hover:-translate-y-2 hover:shadow-xl hover:border-[#3d654c]/40 md:rounded-3xl"
              >
                <div className="flex items-center justify-between">
                  <div className="inline-flex rounded-xl bg-[#f3f4ee] p-2.5 text-[#3d654c] transition group-hover:bg-[#3d654c] group-hover:text-white md:rounded-2xl md:p-3.5">
                    <f.icon size={20} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#1c1d1a]/50 md:text-[11px]">{f.tag}</span>
                </div>
                <h3 className="mt-4 text-base md:text-xl font-bold text-[#1c1d1a] leading-tight md:mt-6">{f.title}</h3>
                <p className="mt-2 text-xs md:text-sm leading-relaxed text-[#1c1d1a]/70 md:mt-3">{f.text}</p>
                <div className="mt-4 pt-3 border-t border-[#1c1d1a]/10 text-[11px] md:text-xs font-bold text-[#3d654c] md:mt-6 md:pt-4">
                  {f.stat}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* BUILT-IN AI INTELLIGENCE */}
        <section id="intelligence" className="border-t border-[#1c1d1a]/10 bg-[#f3f4ee] px-4 py-14 md:px-12 md:py-28">
          <div className="mx-auto max-w-7xl grid items-center gap-8 md:gap-12 lg:grid-cols-2">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.22em] text-[#3d654c] md:text-xs">
                <Bot size={15} /> Autonomous Verification
              </div>
              <h2 className="mt-2 text-2xl md:text-5xl font-black text-[#1c1d1a] leading-tight">
                Computer vision that prevents fake closures.
              </h2>
              <p className="mt-3 text-xs md:text-base text-[#1c1d1a]/70 leading-relaxed">
                Civic authorities can no longer mark an issue "Resolved" without verifiable digital evidence. Hivez matches landmark geometry, perspective angles, and GPS metadata against the initial submission.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 md:mt-8 md:gap-4">
                {intelligenceItems.map((item) => (
                  <div key={item.title} className="gsap-intel-card rounded-xl bg-white p-4 border border-[#1c1d1a]/10 shadow-sm md:rounded-2xl">
                    <CheckCircle2 size={16} className="text-[#3d654c] mb-1.5" />
                    <h4 className="font-bold text-xs md:text-sm text-[#1c1d1a]">{item.title}</h4>
                    <p className="mt-1 text-[11px] md:text-xs text-[#1c1d1a]/65 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-[#1c1d1a]/10 bg-white p-5 shadow-xl md:rounded-3xl">
              <div className="flex items-center justify-between border-b border-[#1c1d1a]/10 pb-3 md:pb-4">
                <div className="flex items-center gap-2.5 md:gap-3">
                  <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-xl bg-[#3d654c] text-white md:rounded-2xl">
                    <ShieldCheck size={18} />
                  </div>
                  <div>
                    <h4 className="font-black text-xs md:text-sm text-[#1c1d1a]">AI Resolution Gate</h4>
                    <p className="text-[10px] md:text-xs text-[#1c1d1a]/60">Verification Status: Verified Complete</p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] md:text-xs font-bold text-emerald-800">
                  99.4% Match
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 md:mt-6 md:gap-4">
                <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3 md:rounded-2xl md:p-4">
                  <span className="text-[10px] md:text-[11px] font-bold uppercase tracking-wider text-rose-700">Before (Incident)</span>
                  <div className="mt-2 h-20 md:h-28 rounded-lg md:rounded-xl bg-neutral-300 flex items-center justify-center text-[10px] md:text-xs font-bold text-neutral-600">
                    Depth Defect: 18cm
                  </div>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 md:rounded-2xl md:p-4">
                  <span className="text-[10px] md:text-[11px] font-bold uppercase tracking-wider text-emerald-700">After (Repaved)</span>
                  <div className="mt-2 h-20 md:h-28 rounded-lg md:rounded-xl bg-[#3d654c]/20 flex items-center justify-center text-xs font-bold text-[#3d654c]">
                    Surface Restored
                  </div>
                </div>
              </div>

              <p className="mt-4 text-[11px] md:text-xs text-[#1c1d1a]/70 leading-relaxed font-medium md:mt-5">
                Both photos matched at latitude coordinates 12.9783° N, 77.6408° E with timestamped digital certificates signed by 12 neighbourhood witnesses.
              </p>
            </div>
          </div>
        </section>

        {/* FINAL CALL TO ACTION */}
        <section className="relative px-4 py-16 text-center bg-white border-t border-[#1c1d1a]/10 md:px-12 md:py-28">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-3xl font-black text-[#1c1d1a] sm:text-5xl md:text-6xl tracking-tight leading-tight">
              Start reporting what your community needs.
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-xs md:text-base text-[#1c1d1a]/70 font-medium md:mt-4">
              Join your local neighbourhood network in under a minute and start making a visible difference.
            </p>
            <div className="mt-6 flex justify-center md:mt-8">
              <Link
                to="/signup"
                className="gsap-magnetic inline-flex items-center gap-2 rounded-full bg-[#3d654c] px-7 py-3.5 text-xs md:text-base font-bold text-white shadow-xl shadow-[#3d654c]/25 transition hover:bg-[#32533e] md:px-9 md:py-4"
              >
                Create your account <ArrowUpRight size={17} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="flex flex-col items-center justify-between gap-4 border-t border-[#1c1d1a]/10 bg-[#f7f7f2] px-5 py-8 text-xs text-[#1c1d1a]/60 md:flex-row md:px-12 md:py-10">
        <span className="font-extrabold tracking-wider text-[#1c1d1a] text-sm">HIVEZ CIVIC NETWORK</span>
        <div className="flex flex-wrap justify-center gap-4 md:gap-6 font-bold">
          <a href="#features" className="hover:text-[#1c1d1a]">Features</a>
          <a href="#how" className="hover:text-[#1c1d1a]">Architecture</a>
          <a href="#intelligence" className="hover:text-[#1c1d1a]">AI Intelligence</a>
        </div>
        <span>© 2026 Hivez. All rights reserved.</span>
      </footer>
    </div>
  );
}