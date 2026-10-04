import { useSyncExternalStore } from "react";
import { isSafePath } from "./autoRefresh";

// After a cloud sync brings in new progress, pages that already read IndexedDB on
// mount would show stale numbers. Instead of reloading the whole site (blank flash,
// loader again), the current page is simply re-mounted so it re-reads local data.
let version = 0;
const listeners = new Set<() => void>();

/** Re-mount the current page, but only on plain browsing screens (never mid-quiz). */
export function refreshDataIfSafe(): void {
  if (!isSafePath(window.location.pathname)) return; // later pages mount fresh anyway
  version += 1;
  listeners.forEach((notify) => notify());
}

export function useDataVersion(): number {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => version,
    () => version
  );
}
