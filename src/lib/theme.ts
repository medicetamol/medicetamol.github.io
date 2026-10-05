import { useSyncExternalStore } from "react";

export type Theme = "dark" | "light";

// Must match the key read by the inline script in index.html (applies the saved
// theme before first paint so there is no dark → light flash on load).
export const THEME_STORAGE_KEY = "medicetamol-theme";

export type Accent = "turquoise" | "lime" | "orange" | "indigo" | "rose" | "amber";

// Must match the key read by the inline script in index.html.
export const ACCENT_STORAGE_KEY = "medicetamol-accent";

type Preview = { bg: string; card: string; accent: string; ink: string };

/** Colours used only for the little previews in Settings (the real tokens live in theme.css). */
export const ACCENTS: Array<{ id: Accent; label: string; dark: Preview; light: Preview }> = [
  { id: "turquoise", label: "Turquoise", dark: { bg: "#0b0f14", card: "#121923", accent: "#2dd4bf", ink: "#04201e" }, light: { bg: "#f1f5f9", card: "#ffffff", accent: "#2dd4bf", ink: "#042f2e" } },
  { id: "lime", label: "Lime", dark: { bg: "#0b0f14", card: "#121923", accent: "#c6f432", ink: "#0b0f14" }, light: { bg: "#f1f5f9", card: "#ffffff", accent: "#a3e635", ink: "#1a2e05" } },
  { id: "orange", label: "Orange", dark: { bg: "#17110d", card: "#241a14", accent: "#ff8a4c", ink: "#1a0f08" }, light: { bg: "#f1f5f9", card: "#ffffff", accent: "#ff8a4c", ink: "#431407" } },
  { id: "indigo", label: "Indigo", dark: { bg: "#0d0f1c", card: "#151833", accent: "#818cf8", ink: "#0f112d" }, light: { bg: "#f1f5f9", card: "#ffffff", accent: "#4f46e5", ink: "#ffffff" } },
  { id: "rose", label: "Rose", dark: { bg: "#140c10", card: "#201219", accent: "#fb7185", ink: "#280810" }, light: { bg: "#f1f5f9", card: "#ffffff", accent: "#e11d48", ink: "#ffffff" } },
  { id: "amber", label: "Amber", dark: { bg: "#130f09", card: "#1f1810", accent: "#fbbf24", ink: "#261802" }, light: { bg: "#f1f5f9", card: "#ffffff", accent: "#f59e0b", ink: "#451a03" } }
];

/** Keep the browser chrome (status bar / address bar) matching the current page colour. */
function syncThemeColor() {
  const channels = getComputedStyle(document.documentElement).getPropertyValue("--page").trim().split(/\s+/).map(Number);
  if (channels.length !== 3 || channels.some((n) => Number.isNaN(n))) return;
  const hex = "#" + channels.map((n) => n.toString(16).padStart(2, "0")).join("");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", hex);
}

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

  syncThemeColor();

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

function currentAccent(): Accent {
  const value = document.documentElement.getAttribute("data-accent");
  return ACCENTS.some((a) => a.id === value) ? (value as Accent) : "turquoise";
}

/** Switch the accent colour theme and remember it on this device. */
export function setAccent(accent: Accent) {
  const root = document.documentElement;
  if (accent === "turquoise") root.removeAttribute("data-accent");
  else root.setAttribute("data-accent", accent);

  syncThemeColor();

  try {
    localStorage.setItem(ACCENT_STORAGE_KEY, accent);
  } catch {
    // storage unavailable — the accent still applies for this session
  }

  listeners.forEach((notify) => notify());
}

export function useAccent(): Accent {
  return useSyncExternalStore(subscribe, currentAccent, () => "turquoise");
}
