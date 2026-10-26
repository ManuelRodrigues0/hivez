import { BeeMascot, type BeeMood } from "./BeeMascot";

/** One big, anchored character. Its original clips do the acting. */
export function AuthCompanion({
  mood,
  onGreet,
  onEnd,
}: {
  mood: BeeMood;
  onGreet: () => void;
  onEnd: () => void;
}) {
  return (
    <div
      className={`ha-companion ${mood === "shy" ? "ha-companion--privacy" : ""}`}
    >
      <BeeMascot
        mood={mood}
        size={380}
        onGreet={onGreet}
        onAnimationEnd={onEnd}
      />
      <span className="ha-companion-message">
        {mood === "shy"
          ? "No peeking."
          : mood === "wave"
            ? "Hey, neighbour!"
            : "Say hello. Our bee says it back."}
      </span>
    </div>
  );
}
