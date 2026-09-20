import { useSyncExternalStore } from "react";

// Chrome / Edge / Android fire `beforeinstallprompt` when the app is installable.
// We hold on to the event and trigger it from our own "Install app" buttons.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

type InstallState = {
  /** Browser has offered the install prompt and we can trigger it. */
  canPrompt: boolean;
  /** Already running as an installed app (or just got installed). */
  installed: boolean;
  /** iPhone / iPad — no install prompt exists, user must use Share → Add to Home Screen. */
  isIOS: boolean;
};

function detectStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function detectIOS(): boolean {
  const ua = navigator.userAgent;
  // iPadOS 13+ reports itself as a Mac, so also check for a touch screen.
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

let deferred: BeforeInstallPromptEvent | null = null;
let state: InstallState = {
  canPrompt: false,
  installed: detectStandalone(),
  isIOS: detectIOS()
};

const listeners = new Set<() => void>();

function update(patch: Partial<InstallState>) {
  state = { ...state, ...patch };
  listeners.forEach((notify) => notify());
}

// Registered at import time (main.tsx imports this file first) so the event is
// never missed, even if it fires before any component has mounted.
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault(); // use our own button instead of the browser's mini-infobar
  deferred = event as BeforeInstallPromptEvent;
  update({ canPrompt: true });
});

window.addEventListener("appinstalled", () => {
  deferred = null;
  update({ canPrompt: false, installed: true });
});

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** Must be called from a click handler (browsers require a user gesture). */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferred) return "unavailable";
  const event = deferred;
  deferred = null; // the event can only be used once
  update({ canPrompt: false });

  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === "accepted") update({ installed: true });
    return outcome;
  } catch {
    return "unavailable";
  }
}

export function useInstall() {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => state);
  return { ...snapshot, promptInstall };
}
