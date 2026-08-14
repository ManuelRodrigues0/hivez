import { motion, useReducedMotion } from "motion/react";
import { useState, type ReactNode } from "react";

export function AuthBackdrop({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const [particles] = useState(() =>
    Array.from({ length: 26 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: 2 + Math.random() * 4,
      delay: Math.random() * 6,
      duration: 9 + Math.random() * 10,
    })),
  );

  return (
    <div className="hivez-auth-page relative min-h-dvh overflow-hidden bg-background font-sans text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 top-[-15%] h-[36rem] w-[36rem] rounded-full bg-primary/15 blur-[140px]" />
        <div className="absolute -right-32 bottom-[-20%] h-[34rem] w-[34rem] rounded-full bg-secondary/12 blur-[150px]" />
        <div className="absolute left-1/2 top-1/3 h-[22rem] w-[22rem] -translate-x-1/2 rounded-full bg-accent/12 blur-[130px]" />
      </div>

      {!reduce && particles.length > 0 && (
        <div className="pointer-events-none absolute inset-0">
          {particles.map((p) => (
            <motion.span
              key={p.id}
              className="absolute rounded-full bg-accent/50"
              style={{
                left: `${p.left}%`,
                top: `${p.top}%`,
                width: p.size,
                height: p.size,
              }}
              animate={{ y: [0, -60, 0], opacity: [0, 0.8, 0] }}
              transition={{
                duration: p.duration,
                delay: p.delay,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
      )}

      <div className="relative z-10">{children}</div>
    </div>
  );
}
