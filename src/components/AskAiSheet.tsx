import { useState } from "react";
import { Atom, MessageCircle, MoreHorizontal, Search, Sparkles, X } from "lucide-react";
import { openAiApp, type AiApp } from "../lib/askAi";
import {
  buildAskAiText,
  getAiPromptSelection,
  setAiPromptSelection,
  type AiApproach,
  type AiPromptSelection,
  type AiStyle,
} from "../lib/aiPromptStyle";
import type { PYQQuestion } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
  /** The question being shared — text is built from this + the current prompt-style selection. */
  question: PYQQuestion | null;
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

const APPROACH_ROWS: { id: AiApproach; label: string; hasStyle: boolean }[] = [
  { id: "elimination", label: "Elimination", hasStyle: true },
  { id: "explanation", label: "Explanation", hasStyle: true },
  { id: "non-specific", label: "Non-specific", hasStyle: false },
];

export default function AskAiSheet({ open, onClose, question, shareTitle, onFeedback }: Props) {
  const [selection, setSelection] = useState<AiPromptSelection>(() => getAiPromptSelection());

  if (!open) return null;

  const updateSelection = (next: AiPromptSelection) => {
    setSelection(next);
    setAiPromptSelection(next);
  };

  const selectApproach = (approach: AiApproach) => {
    updateSelection({ approach, style: selection.style });
  };

  const selectStyle = (style: AiStyle) => {
    updateSelection({ approach: selection.approach, style });
  };

  const handlePick = async (app: AiApp) => {
    if (!question) return;
    const text = buildAskAiText(question, selection);
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

        <div className="flex justify-between gap-1 border-b border-slate-800 pb-4">
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

        <div className="pt-3">
          <p className="mb-1.5 px-0.5 text-xs text-slate-500">Prompt style</p>
          <div className="flex flex-col gap-1.5">
            {APPROACH_ROWS.map(({ id, label, hasStyle }) => {
              const active = selection.approach === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => selectApproach(id)}
                  className={`flex items-center justify-between rounded-lg border px-2.5 py-2 text-left ${
                    active
                      ? "border-sky-500/50 bg-sky-500/10"
                      : "border-slate-800 bg-transparent"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-full border-[1.5px] ${
                        active ? "border-sky-400" : "border-slate-600"
                      }`}
                    >
                      {active && <span className="h-2 w-2 rounded-full bg-sky-400" />}
                    </span>
                    <span className={`text-sm ${active ? "text-slate-100" : "text-slate-400"}`}>
                      {label}
                    </span>
                  </span>

                  {hasStyle ? (
                    <span
                      className="flex gap-0.5 rounded-md bg-slate-800 p-0.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {(["normal", "short"] as AiStyle[]).map((s) => {
                        const styleActive = active && selection.style === s;
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => {
                              if (!active) selectApproach(id);
                              selectStyle(s);
                            }}
                            className={`rounded px-2 py-1 text-[11px] ${
                              styleActive
                                ? "bg-slate-700 font-medium text-slate-100"
                                : "text-slate-500"
                            }`}
                          >
                            {s === "normal" ? "Normal" : "Short"}
                          </button>
                        );
                      })}
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-500">No prompt link</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
