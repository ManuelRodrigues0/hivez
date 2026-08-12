import { useRef, useEffect, type ReactNode, type ElementType } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * SplitText animations — inspired by Léo Parpeix's editorial motion.
 * Splits a heading into words and reveals them with a scroll-triggered,
 * staggered upward motion. Each variant has a distinct character.
 */

export type SplitVariant =
  | "rise" // words rise up with opacity
  | "mask" // words reveal through a clipping mask
  | "slideLeft" // words slide in from the left
  | "slideRight" // words slide in from the right
  | "scale" // words scale up from smaller
  | "rotate" // words rotate into place
  | "blur" // words blur in sharp
  | "drop" // words drop from above
  | "charRise" // individual characters rise
  | "charWave" // characters wave up sequentially
  | "stagger"; // words stagger upward with a slight over-rotation

interface SplitHeadingProps {
  text: string;
  variant?: SplitVariant;
  as?: ElementType;
  className?: string;
  sectionClassName?: string;
  children?: ReactNode;
}

const EASE = "power3.out";
const DURATION = 1;
const STAGGER = 0.06;

const WORD_CLASS = "split-word";

const variantFrom = (variant: SplitVariant) => {
  switch (variant) {
    case "rise":
      return { yPercent: 110, opacity: 0, rotate: 0, scale: 1, filter: "none" };
    case "mask":
      return { yPercent: 120, opacity: 0, rotate: 0, scale: 1, filter: "none" };
    case "slideLeft":
      return { xPercent: -80, opacity: 0, y: 0, rotate: 0, scale: 1, filter: "none" };
    case "slideRight":
      return { xPercent: 80, opacity: 0, y: 0, rotate: 0, scale: 1, filter: "none" };
    case "scale":
      return { scale: 0.6, opacity: 0, y: 20, rotate: 0, filter: "none" };
    case "rotate":
      return { rotate: 12, yPercent: 40, opacity: 0, scale: 1, filter: "none" };
    case "blur":
      return { filter: "blur(12px)", opacity: 0, y: 16, scale: 1, rotate: 0 };
    case "drop":
      return { yPercent: -120, opacity: 0, rotate: 0, scale: 1, filter: "none" };
    case "charRise":
      return { yPercent: 110, opacity: 0, rotate: 0, scale: 1, filter: "none" };
    case "charWave":
      return { y: 22, opacity: 0, rotate: 3, scale: 1, filter: "none" };
    default:
      return { yPercent: 100, opacity: 0, rotate: 6, scale: 1, filter: "none" };
  }
};

const variantTo = {
  yPercent: 0,
  xPercent: 0,
  y: 0,
  rotate: 0,
  scale: 1,
  opacity: 1,
  filter: "blur(0px)",
};

export default function SplitHeading({
  text,
  variant = "rise",
  as: Tag = "h2",
  className,
  children,
}: SplitHeadingProps) {
  const ref = useRef<any>(null);
  const reduced = useReducedMotion();

  const isChar = variant === "charRise" || variant === "charWave";
  const words = text.split(" ");

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;

    const targets = el.querySelectorAll(`.${WORD_CLASS}`);
    if (targets.length === 0) return;

    const from = variantFrom(variant);
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: el,
        start: "top 85%",
        toggleActions: "play none none reverse",
        once: false,
      },
    });

    tl.set(targets, from).to(targets, {
      ...variantTo,
      duration: DURATION,
      stagger: isChar ? 0.02 : STAGGER,
      ease: EASE,
    });

    return () => {
      tl.kill();
      ScrollTrigger.getAll().forEach((st) => st.kill());
    };
  }, [text, variant, reduced, isChar]);

  return (
    <Tag ref={ref} className={className} aria-label={text} role="heading" aria-level={2}>
      {isChar ? (
        words.map((word, wi) => (
          <span
            key={wi}
            className="split-word-group"
            aria-hidden="true"
            style={{ display: "inline-block", overflow: "hidden", paddingBottom: "0.08em", marginBottom: "-0.08em" }}
          >
            {word.split("").map((ch, ci) => (
              <span
                key={ci}
                className={WORD_CLASS}
                style={{ display: "inline-block", whiteSpace: "pre" }}
              >
                {ch}
              </span>
            ))}
            {wi < words.length - 1 ? <span className={WORD_CLASS} style={{ display: "inline-block" }}>&nbsp;</span> : null}
          </span>
        ))
      ) : (
        words.map((word, wi) => (
          <span
            key={wi}
            className="split-word-group"
            aria-hidden="true"
            style={{ display: "inline-block", overflow: "hidden", paddingBottom: "0.08em", marginBottom: "-0.08em" }}
          >
            <span className={WORD_CLASS} style={{ display: "inline-block" }}>
              {word}
            </span>
            {wi < words.length - 1 ? <span className={WORD_CLASS} style={{ display: "inline-block" }}>&nbsp;</span> : null}
          </span>
        ))
      )}
      {children}
    </Tag>
  );
}