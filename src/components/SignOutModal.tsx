import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { signOutUser } from "../lib/auth";
import { auth } from "../lib/auth";
import { flushForSignOut, wipeLocalAfterSignOut } from "../lib/syncEngine";

type Phase = "saving" | "ready" | "error" | "signingOut";

/**
 * Opens the moment the user taps Sign out. The final sync starts immediately;
 * "Yes" stays disabled until the cloud copy is confirmed saved, so signing out
 * (which wipes this device) can never lose progress.
 */
export default function SignOutModal({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>("saving");

  const save = useCallback(async () => {
    setPhase("saving");
    try {
      await flushForSignOut();
      setPhase("ready");
    } catch (err) {
      console.error(err);
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    void save();
  }, [save]);

  const confirm = async () => {
    const uid = auth.currentUser?.uid;
    setPhase("signingOut");
    try {
      await wipeLocalAfterSignOut();
      if (uid) localStorage.removeItem(`medicetamol:reconciled:${uid}`);
      await signOutUser();
      // Any open page still holds the wiped data in memory.
      window.location.assign("/");
    } catch (err) {
      console.error(err);
      setPhase("error");
    }
  };

  const busy = phase === "saving" || phase === "signingOut";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="signout-title"
    >
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h2 id="signout-title" className="text-base font-bold text-slate-100">
          Sign out?
        </h2>

        <div className="mt-4 flex items-center gap-3 text-sm">
          {phase === "saving" && (
            <>
              <Loader2 size={18} className="shrink-0 animate-spin text-slate-400" />
              <span className="text-slate-300">Saving your progress…</span>
            </>
          )}
          {phase === "ready" && (
            <>
              <CheckCircle2 size={18} className="shrink-0 text-emerald-400" />
              <span className="text-emerald-300">Progress saved. Progress on this device will be cleared.</span>
            </>
          )}
          {phase === "signingOut" && (
            <>
              <Loader2 size={18} className="shrink-0 animate-spin text-slate-400" />
              <span className="text-slate-300">Signing out…</span>
            </>
          )}
          {phase === "error" && (
            <>
              <AlertTriangle size={18} className="shrink-0 text-red-400" />
              <span className="text-red-300">Couldn&apos;t save your progress. Check your connection.</span>
            </>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={phase === "signingOut"}
            className="flex-1 rounded-xl border border-slate-700 px-4 py-3 text-sm font-bold text-slate-100 hover:bg-slate-800 disabled:opacity-50"
          >
            Go Back
          </button>
          {phase === "error" ? (
            <button
              type="button"
              onClick={save}
              className="flex-1 rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-slate-50"
            >
              Retry
            </button>
          ) : (
            <button
              type="button"
              onClick={confirm}
              disabled={phase !== "ready"}
              className="flex-1 rounded-xl bg-red-500 px-4 py-3 text-sm font-bold text-white hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Yes
            </button>
          )}
        </div>

        {busy && <span className="sr-only">Please wait</span>}
      </div>
    </div>
  );
}
