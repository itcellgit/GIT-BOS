import { useSyncExternalStore } from "react";

// Colour theme: "light", "dark" or "system" (follows the operating system). The choice is kept in
// localStorage; public/theme-init.js applies it before the first paint.
const KEY = "acp-theme";
const media = typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)") : null;
const listeners = new Set();

function read() {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

function apply(theme) {
  const dark = theme === "dark" || (theme === "system" && media?.matches);
  document.documentElement.classList.toggle("dark", Boolean(dark));
}

media?.addEventListener("change", () => {
  if (read() === "system") apply("system");
  listeners.forEach((l) => l());
});

export function setTheme(theme) {
  try {
    if (theme === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    /* storage blocked: applies for this page view only */
  }
  apply(theme);
  listeners.forEach((l) => l());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The chosen theme ("light" | "dark" | "system") and the one in effect ("light" | "dark"). */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, read, () => "system");
  const resolved = theme === "system" ? (media?.matches ? "dark" : "light") : theme;
  return { theme, resolved, setTheme };
}
