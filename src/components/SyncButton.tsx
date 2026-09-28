import { RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { manualSync, useSyncStatus } from "../lib/syncEngine";

function formatLastSync(at: number | null): string {
  if (!at) return "Not synced yet";
  const d = new Date(at);
  const today = new Date();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === today.toDateString()) return `Last synced today, ${time}`;
  return `Last synced ${d.toLocaleDateString([], { day: "numeric", month: "short" })}, ${time}`;
}

/**
 * Manual "Sync now". Enabled only when something changed AND 15 minutes have
 * passed since the last sync (manual or automatic). Tapping it while it's
 * disabled shows a short reassurance instead of doing anything.
 */
export default function SyncButton() {
  const sync = useSyncStatus();
  const [showCaption, setShowCaption] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  // Re-render when the 15-minute wait runs out (nothing else would trigger it).
  const [, tick] = useState(0);
  useEffect(() => {
    if (sync.waitMs <= 0) return;
    const t = window.setTimeout(() => tick((n) => n + 1), sync.waitMs + 50);
    return () => window.clearTimeout(t);
  }, [sync.waitMs, sync.lastSync]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const flashCaption = () => {
    setShowCaption(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setShowCaption(false), 3000);
  };

  const onClick = async () => {
    if (!sync.canSync) {
      flashCaption();
      return;
    }
    const result = await manualSync();
    if (result === "already-synced") flashCaption();
  };

  const syncing = sync.status === "syncing";

  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        aria-disabled={!sync.canSync}
        className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition ${
          sync.canSync
            ? "border-slate-600 text-slate-100 hover:bg-slate-800"
            : "cursor-default border-slate-800 text-slate-500"
        }`}
      >
        <RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
        {syncing ? "Syncing…" : "Sync now"}
      </button>
      <p className="mt-1.5 text-xs text-slate-500">
        {sync.status === "error" ? "Couldn't sync. Will retry later." : formatLastSync(sync.lastSync)}
      </p>
      {showCaption && (
        <p className="mt-1 text-xs text-emerald-400" role="status">
          Don&apos;t worry, your progress is already synced. Solve more PYQs.
        </p>
      )}
    </div>
  );
}
