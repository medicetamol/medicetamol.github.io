import { useSyncExternalStore } from "react";

export type Theme = "dark" | "light";

// Must match the key read by the inline script in index.html (applies the saved
// theme before first paint so there is no dark → light flash on load).
export const THEME_STORAGE_KEY = "medicetamol-theme";

const THEME_COLOR: Record<Theme, string> = {
  dark: "#0b0f14",
  light: "#f1f5f9"
};

const listeners = new Set<() => void>();

function currentTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** Switch theme, remember it on this device, and update the browser chrome colour. */
export function setTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "light") root.setAttribute("data-theme", "light");
  else root.removeAttribute("data-theme");

  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLOR[theme]);

  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // storage unavailable (private mode etc.) — theme still applies for this session
  }

  listeners.forEach((notify) => notify());
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, currentTheme, () => "dark");
}
