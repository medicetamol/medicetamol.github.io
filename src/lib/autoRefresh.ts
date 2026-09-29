// Reloads the current page (same URL, no redirect) when the user comes back after a
// long absence, so a tab/app left open for hours or days picks up the latest deploy.
// Pull-to-refresh is disabled app-wide, so this replaces it for stale sessions.
//
// Never reloads on screens with in-progress state (quiz, custom module, results,
// module builders, report form, shared-module link). If the return happened on one
// of those, the refresh is deferred until the user next lands on a safe page.

const STALE_AFTER_MS = 6 * 60 * 60 * 1000; // 6 hours

// Only plain browsing pages are safe to reload.
const SAFE_PATH = /^\/(about|pyqs(\/[^/]+){0,2}|progress|bookmarks|settings|modules\/history)?\/?$/;

let hiddenAt: number | null = null;
let stale = false;

export function refreshIfStale(pathname: string): void {
  if (!stale || !SAFE_PATH.test(pathname)) return;
  stale = false;
  window.location.reload();
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
