import { Leaf, MoonStar, Sun } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

const names = {
  light: "Warm light",
  forest: "Forest",
  midnight: "Black & yellow",
};
const next = {
  light: "Forest",
  forest: "Black & yellow",
  midnight: "Warm light",
};

export default function PublicThemeToggle({
  className = "",
}: {
  className?: string;
}) {
  const { publicTheme, cyclePublicTheme } = useTheme();
  const Icon =
    publicTheme === "light" ? Sun : publicTheme === "forest" ? Leaf : MoonStar;
  return (
    <button
      type="button"
      className={className}
      onClick={cyclePublicTheme}
      data-public-theme-toggle
      aria-label={`Theme: ${names[publicTheme]}. Switch to ${next[publicTheme]}`}
      title={`${names[publicTheme]} · Click for ${next[publicTheme]} · 3 themes`}
    >
      <Icon size={18} aria-hidden="true" />
    </button>
  );
}
