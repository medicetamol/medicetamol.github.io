import { Atom, MessageCircle, MoreHorizontal, Search, Sparkles, X } from "lucide-react";
import { openAiApp, type AiApp } from "../lib/askAi";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Full prompt text to send to whichever app the user taps. */
  text: string;
  /** Title used only for the "Others" native share sheet fallback. */
  shareTitle: string;
  onFeedback: (message: string) => void;
}

const APPS: {
  id: AiApp;
  label: string;
  icon: typeof MessageCircle;
  tint: string;
}[] = [
  { id: "chatgpt", label: "ChatGPT", icon: MessageCircle, tint: "bg-teal-500/15 text-teal-300" },
  { id: "gemini", label: "Gemini", icon: Sparkles, tint: "bg-sky-500/15 text-sky-300" },
  { id: "claude", label: "Claude", icon: Atom, tint: "bg-orange-500/15 text-orange-300" },
  { id: "google", label: "Google", icon: Search, tint: "bg-amber-500/15 text-amber-300" },
  { id: "others", label: "Others", icon: MoreHorizontal, tint: "bg-slate-700/60 text-slate-300" },
];

export default function AskAiSheet({ open, onClose, text, shareTitle, onFeedback }: Props) {
  if (!open) return null;

  const handlePick = async (app: AiApp) => {
    onClose();
    const result = await openAiApp(app, { text, shareTitle });
    onFeedback(result.message);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Ask AI"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl border-t border-slate-700 bg-slate-900 px-4 pb-6 pt-3 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-slate-700" />

        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-100">Ask AI</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-200"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex justify-between gap-1">
          {APPS.map(({ id, label, icon: Icon, tint }) => (
            <button
              key={id}
              type="button"
              onClick={() => handlePick(id)}
              className="flex flex-1 flex-col items-center gap-1.5 rounded-lg py-1.5 active:bg-slate-800"
              aria-label={label}
            >
              <span className={`flex h-12 w-12 items-center justify-center rounded-full ${tint}`}>
                <Icon size={22} strokeWidth={1.9} />
              </span>
              <span className="text-xs text-slate-400">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
