import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { signInWithGoogle } from "../lib/auth";

interface Props {
  /** "hard": sign-in is required to proceed (e.g. report error) — dismiss just cancels the action, no soft warning shown.
   *  "soft": milestone-triggered nudge — dismissing shows a brief "you might lose progress" note, then closes normally. */
  variant: "hard" | "soft";
  reason?: string; // short context line, e.g. "Sign in to report this error"
  onSignedIn: () => void;
  onDismiss: () => void;
}

export default function AuthPromptModal({ variant, reason, onSignedIn, onDismiss }: Props) {
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLossWarning, setShowLossWarning] = useState(false);

  const handleSignIn = async () => {
    setError(null);
    setSigningIn(true);
    try {
      await signInWithGoogle();
      onSignedIn();
    } catch (err) {
      setError("Sign-in was cancelled or failed. Please try again.");
      console.error(err);
    } finally {
      setSigningIn(false);
    }
  };

  const handleDismiss = () => {
    if (variant === "soft" && !showLossWarning) {
      setShowLossWarning(true);
      return;
    }
    onDismiss();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4" onClick={handleDismiss}>
      <div
        className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {showLossWarning ? (
          <>
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/10 text-amber-400">
              <AlertTriangle size={22} />
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              You might lose your progress. Sign in for a better experience — your streak, solved
              questions, and bookmarks stay safe across devices.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={onDismiss}
                className="flex-1 rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800"
              >
                Continue anyway
              </button>
              <button
                type="button"
                onClick={handleSignIn}
                disabled={signingIn}
                className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink hover:brightness-110 disabled:opacity-60"
              >
                {signingIn ? "Signing in…" : "Sign in"}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-base font-semibold text-slate-100">
              {reason ?? "Sign in to continue"}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Sign in with Google — it only takes a moment.
            </p>

            <button
              type="button"
              onClick={handleSignIn}
              disabled={signingIn}
              className="mt-5 flex w-full items-center justify-center gap-3 rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm font-medium text-slate-100 hover:bg-slate-800 disabled:opacity-60"
            >
              <GoogleIcon />
              {signingIn ? "Signing in…" : "Continue with Google"}
            </button>

            {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

            <button
              type="button"
              onClick={handleDismiss}
              className="mt-4 text-xs text-slate-500 hover:text-slate-300"
            >
              {variant === "hard" ? "Cancel" : "Not now"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.96 10.71a5.41 5.41 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l3-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}
