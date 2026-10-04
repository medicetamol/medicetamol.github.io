// When the user comes back after a long absence, checks /version.json and reloads the
// current page (same URL, no redirect) ONLY if a newer deploy exists. A tab/app left
// open for hours or days therefore picks up the latest build without a pointless
// full reload (and blank flash) when nothing changed.
// Pull-to-refresh is disabled app-wide, so this replaces it for stale sessions.
//
// Never reloads on screens with in-progress state (quiz, custom module, results,
// module builders, report form, shared-module link). If the return happened on one
// of those, the refresh is deferred until the user next lands on a safe page.

import { safeReload } from "./reloadGuard";

const STALE_AFTER_MS = 6 * 60 * 60 * 1000; // 6 hours

// Only plain browsing pages are safe to reload.
const SAFE_PATH = /^\/(about|pyqs(\/[^/]+){0,2}|progress|bookmarks|settings|modules\/history)?\/?$/;

export const isSafePath = (pathname: string): boolean => SAFE_PATH.test(pathname);

let hiddenAt: number | null = null;
let stale = false;

async function reloadIfNewDeploy(): Promise<void> {
  try {
    const res = await fetch(`/version.json?_=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return; // dev server / offline: stay put
    const data = (await res.json()) as { id?: string };
    if (!data.id || data.id === __BUILD_ID__) return; // already on the latest build
    // The user may have moved to a screen with live state while we were fetching.
    if (SAFE_PATH.test(window.location.pathname)) safeReload();
    else stale = true; // try again on the next safe page
  } catch {
    // network hiccup: not worth interrupting the user
  }
}

export function refreshIfStale(pathname: string): void {
  if (!stale || !SAFE_PATH.test(pathname)) return;
  stale = false;
  void reloadIfNewDeploy();
}

export function installAutoRefresh(): void {
  if (typeof document === "undefined") return;

  const onHidden = () => { if (hiddenAt === null) hiddenAt = Date.now(); };
  const onVisible = () => {
    if (hiddenAt !== null && Date.now() - hiddenAt >= STALE_AFTER_MS) stale = true;
    hiddenAt = null;
    refreshIfStale(window.location.pathname);
  };

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") onHidden();
    else onVisible();
  });
  // Back/forward-cache restores (iOS Safari) don't always fire visibilitychange.
  window.addEventListener("pagehide", onHidden);
  window.addEventListener("pageshow", (e) => { if ((e as PageTransitionEvent).persisted) onVisible(); });
}
