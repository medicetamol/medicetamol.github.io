import { Check, Download, LogOut, Moon, Share, Smartphone, Sun, User } from "lucide-react";
import { useState } from "react";
import { useInstall } from "../lib/pwa";
import { ACCENTS, setAccent, setTheme, useAccent, useTheme } from "../lib/theme";
import type { Theme } from "../lib/theme";
import { setFontScale, useFontScale } from "../lib/fontScale";
import type { FontScale } from "../lib/fontScale";
import { useAuth } from "../lib/AuthContext";
import { signInWithGoogle } from "../lib/auth";
import SignOutModal from "../components/SignOutModal";
import SyncButton from "../components/SyncButton";

const THEMES: Array<{ id: Theme; label: string; icon: typeof Sun }> = [
  { id: "dark", label: "Dark", icon: Moon },
  { id: "light", label: "Light", icon: Sun }
];

const FONT_SCALES: Array<{ id: FontScale; label: string; sample: string }> = [
  { id: "small", label: "Small", sample: "13px" },
  { id: "default", label: "Default", sample: "15px" },
  { id: "large", label: "Large", sample: "17px" }
];

export default function Settings() {
  const theme = useTheme();
  const accent = useAccent();
  const fontScale = useFontScale();
  const { canPrompt, installed, isIOS, promptInstall } = useInstall();
  const { user } = useAuth();
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showSignOut, setShowSignOut] = useState(false);

  const handleSignIn = async () => {
    setAuthError(null);
    setAuthBusy(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setAuthError("Sign-in was cancelled or failed. Please try again.");
      console.error(err);
    } finally {
      setAuthBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-7">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-slate-400">Preferences are saved on this device.</p>
      </div>

      {/* Account */}
      <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex items-start gap-3">
          <User size={18} className="mt-0.5 shrink-0 text-slate-400" />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-slate-200">Account</h2>

            {user ? (
              <>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-300">
                  <Check size={14} /> Signed in as {user.displayName ?? user.email}
                </p>
                <div className="mt-3">
                  <SyncButton />
                </div>
                <button
                  type="button"
                  onClick={() => setShowSignOut(true)}
                  disabled={authBusy}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-700 px-5 py-3 text-sm font-bold text-slate-100 hover:bg-slate-800 disabled:opacity-60"
                >
                  <LogOut size={16} /> Sign out
                </button>
              </>
            ) : (
              <>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  Sign in with Google to report errors and keep your progress safe.
                </p>
                <button
                  type="button"
                  onClick={handleSignIn}
                  disabled={authBusy}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-bold text-accent-ink hover:brightness-110 disabled:opacity-60"
                >
                  {authBusy ? "Signing in…" : "Sign in with Google"}
                </button>
                {authError && <p className="mt-2 text-xs text-red-400">{authError}</p>}
              </>
            )}
          </div>
        </div>
      </section>

      {/* Appearance */}
      <section className="mt-4 rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="text-sm font-bold text-slate-200">Appearance</h2>
        <p className="mt-1 text-xs text-slate-400">Choose how mediCetamol looks.</p>

        <div
          role="radiogroup"
          aria-label="Theme"
          className="mt-4 flex gap-1 rounded-xl border border-slate-800 bg-slate-950 p-1"
        >
          {THEMES.map(({ id, label, icon: Icon }) => {
            const active = theme === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setTheme(id)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition ${
                  active ? "bg-accent-soft text-accent-text" : "text-slate-400 hover:text-slate-300"
                }`}
              >
                <Icon size={15} />
                {label}
              </button>
            );
          })}
        </div>

        <p className="mt-5 text-xs font-medium text-slate-400">Choose theme</p>
        <div role="radiogroup" aria-label="Colour theme" className="mt-2 grid grid-cols-3 gap-3">
          {ACCENTS.map((a) => {
            const active = accent === a.id;
            const p = theme === "light" ? a.light : a.dark;
            return (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={a.label}
                onClick={() => setAccent(a.id)}
                className="text-center"
              >
                <span
                  className="relative block h-[62px] rounded-2xl p-2"
                  style={{
                    background: p.bg,
                    border: active ? `1.5px solid ${p.accent}` : "1px solid rgb(var(--slate-700))",
                  }}
                >
                  <span className="block h-4 rounded-md" style={{ background: p.card }} />
                  <span className="mt-1.5 flex items-center gap-1">
                    <span className="h-2 w-6 rounded-full" style={{ background: p.accent }} />
                    <span className="h-2 w-2 rounded-full opacity-50" style={{ background: p.accent }} />
                  </span>
                  {active && (
                    <span
                      className="absolute -right-1 -top-1 grid h-[18px] w-[18px] place-items-center rounded-full"
                      style={{ background: p.accent, color: p.ink }}
                    >
                      <Check size={12} strokeWidth={3} />
                    </span>
                  )}
                </span>
                <span className={`mt-1.5 block text-[11px] ${active ? "font-semibold text-slate-100" : "text-slate-400"}`}>
                  {a.label}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Text size */}
      <section className="mt-4 rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="text-sm font-bold text-slate-200">Text size</h2>
        <p className="mt-1 text-xs text-slate-400">Adjust the font size across the app.</p>

        <div
          role="radiogroup"
          aria-label="Text size"
          className="mt-4 flex gap-1 rounded-xl border border-slate-800 bg-slate-950 p-1"
        >
          {FONT_SCALES.map(({ id, label, sample }) => {
            const active = fontScale === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setFontScale(id)}
                className={`flex flex-1 flex-col items-center justify-center gap-1 rounded-lg px-3 py-2.5 transition ${
                  active ? "bg-accent-soft text-accent-text" : "text-slate-400 hover:text-slate-300"
                }`}
              >
                <span className="font-bold" style={{ fontSize: sample }}>
                  A
                </span>
                <span className="text-[11px] font-semibold">{label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Install */}
      <section className="mt-4 rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex items-start gap-3">
          <Smartphone size={18} className="mt-0.5 shrink-0 text-slate-400" />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-slate-200">Install app</h2>

            {installed ? (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-emerald-300">
                <Check size={14} /> mediCetamol is installed on this device.
              </p>
            ) : canPrompt ? (
              <>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  Add mediCetamol to your home screen — it opens full screen, like an app.
                </p>
                <button
                  type="button"
                  onClick={() => void promptInstall()}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-bold text-accent-ink hover:brightness-110"
                >
                  <Download size={16} /> Install app
                </button>
              </>
            ) : isIOS ? (
              <>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  On iPhone / iPad, install from your browser:
                </p>
                <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs leading-5 text-slate-400">
                  <li>
                    Tap the <Share size={13} className="mx-0.5 inline align-[-2px]" /> Share icon
                  </li>
                  <li>
                    Choose <span className="font-semibold text-slate-300">Add to Home Screen</span>
                  </li>
                </ol>
              </>
            ) : (
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Your browser isn't offering install right now. In Chrome, open the ⋮ menu and choose{" "}
                <span className="font-semibold text-slate-300">Install app</span>. If you've already
                installed mediCetamol, open it from your home screen.
              </p>
            )}
          </div>
        </div>
      </section>
      {showSignOut && <SignOutModal onClose={() => setShowSignOut(false)} />}
    </main>
  );
}
