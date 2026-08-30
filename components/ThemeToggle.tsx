import React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../src/lib/theme/useTheme";

type ThemeToggleProps = {
  className?: string;
  iconClassName?: string;
};

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className, iconClassName }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={className}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <Sun className={iconClassName ?? "h-4 w-4"} aria-hidden="true" />
      ) : (
        <Moon className={iconClassName ?? "h-4 w-4"} aria-hidden="true" />
      )}
    </button>
  );
};
