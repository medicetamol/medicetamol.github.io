import { useSyncExternalStore } from "react";

export type FontScale = "small" | "default" | "large";

// Must match the key read by the inline script in index.html (applies the saved
// font scale before first paint so there is no size jump on load).
export const FONT_SCALE_STORAGE_KEY = "medicetamol-font-scale";

const FONT_SCALE_PERCENT: Record<FontScale, string> = {
  small: "87.5%",
  default: "100%",
  large: "112.5%"
};

const listeners = new Set<() => void>();

function currentFontScale(): FontScale {
  const attr = document.documentElement.getAttribute("data-font-scale");
  return attr === "small" || attr === "large" ? attr : "default";
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** Switch the app-wide text size, remember it on this device, and resize the rem base. */
export function setFontScale(scale: FontScale) {
  const root = document.documentElement;
  if (scale === "default") root.removeAttribute("data-font-scale");
  else root.setAttribute("data-font-scale", scale);

  root.style.fontSize = FONT_SCALE_PERCENT[scale];

  try {
    localStorage.setItem(FONT_SCALE_STORAGE_KEY, scale);
  } catch {
    // storage unavailable (private mode etc.) — scale still applies for this session
  }

  listeners.forEach((notify) => notify());
}

export function useFontScale(): FontScale {
  return useSyncExternalStore(subscribe, currentFontScale, () => "default");
}
