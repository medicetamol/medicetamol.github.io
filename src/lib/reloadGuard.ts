// Safety net: never reload the page twice within a minute. If anything ever goes
// wrong in a way that makes a reload condition stay true (e.g. a sync that keeps
// reporting "changed"), this turns an endless reload loop into a single reload.
const KEY = "medicetamol:last-reload";

export function safeReload(minGapMs = 60_000): void {
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < minGapMs) return;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // storage unavailable: fall through and reload once
  }
  window.location.reload();
}
