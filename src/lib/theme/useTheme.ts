import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "pullz:theme";
const EVENT_NAME = "pullz:theme-change";
const DEFAULT_THEME: Theme = "light";

const readStoredTheme = (): Theme | null => {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : null;
};

const applyTheme = (theme: Theme) => {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
};

const getInitialTheme = (): Theme => {
  const stored = readStoredTheme();
  if (stored) return stored;
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return DEFAULT_THEME;
};

/**
 * Shared light/dark theme state. Any component that calls this hook stays in
 * sync with every other instance (e.g. the desktop header toggle and the
 * mobile header toggle) via a window event, and the choice persists across
 * visits in localStorage.
 */
export const useTheme = () => {
  const [theme, setThemeState] = useState<Theme>(() => getInitialTheme());

  useEffect(() => {
    applyTheme(theme);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleExternalChange = (event: Event) => {
      const detail = (event as CustomEvent<{ theme: Theme }>).detail;
      if (detail?.theme && detail.theme !== theme) {
        setThemeState(detail.theme);
      }
    };
    window.addEventListener(EVENT_NAME, handleExternalChange);
    return () => window.removeEventListener(EVENT_NAME, handleExternalChange);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyTheme(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { theme: next } }));
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [setTheme, theme]);

  return { theme, setTheme, toggleTheme };
};
