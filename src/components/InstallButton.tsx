import { Download } from "lucide-react";
import { useState } from "react";
import { useInstall } from "../lib/pwa";

/**
 * "Install app" button for the Home hero.
 * Renders nothing when the app is already installed or the browser can't install it.
 */
export default function InstallButton() {
  const { canPrompt, installed, isIOS, promptInstall } = useInstall();
  const [showIosHint, setShowIosHint] = useState(false);

  if (installed || (!canPrompt && !isIOS)) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => (canPrompt ? void promptInstall() : setShowIosHint((v) => !v))}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800"
      >
        <Download size={17} /> Install app
      </button>

      {!canPrompt && showIosHint && (
        <p className="w-full text-xs leading-5 text-slate-500">
          On iPhone / iPad: tap the Share icon in your browser, then choose{" "}
          <span className="font-semibold text-slate-300">Add to Home Screen</span>.
        </p>
      )}
    </>
  );
}
