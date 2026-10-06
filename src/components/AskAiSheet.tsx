import { useState, type ElementType } from "react";
import { MoreHorizontal, X } from "lucide-react";
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

// Real brand marks for the Ask-AI app row (Bootstrap Icons' Brand set /
// Google's Gemini spark, all single-path so they drop into the same
// tinted-circle + currentColor treatment the row already uses).
type BrandIconProps = { size?: number };

function OpenAIIcon({ size = 22 }: BrandIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M14.949 6.547a3.94 3.94 0 0 0-.348-3.273 4.11 4.11 0 0 0-4.4-1.934A4.1 4.1 0 0 0 8.423.2 4.15 4.15 0 0 0 6.305.086a4.1 4.1 0 0 0-1.891.948 4.04 4.04 0 0 0-1.158 1.753 4.1 4.1 0 0 0-1.563.679A4 4 0 0 0 .554 4.72a3.99 3.99 0 0 0 .502 4.731 3.94 3.94 0 0 0 .346 3.274 4.11 4.11 0 0 0 4.402 1.933c.382.425.852.764 1.377.995.526.231 1.095.35 1.67.346 1.78.002 3.358-1.132 3.901-2.804a4.1 4.1 0 0 0 1.563-.68 4 4 0 0 0 1.14-1.253 3.99 3.99 0 0 0-.506-4.716m-6.097 8.406a3.05 3.05 0 0 1-1.945-.694l.096-.054 3.23-1.838a.53.53 0 0 0 .265-.455v-4.49l1.366.778q.02.011.025.035v3.722c-.003 1.653-1.361 2.992-3.037 2.996m-6.53-2.75a2.95 2.95 0 0 1-.36-2.01l.095.057L5.29 12.09a.53.53 0 0 0 .527 0l3.949-2.246v1.555a.05.05 0 0 1-.022.041L6.473 13.3c-1.454.826-3.311.335-4.15-1.098m-.85-6.94A3.02 3.02 0 0 1 3.07 3.949v3.785a.51.51 0 0 0 .262.451l3.93 2.237-1.366.779a.05.05 0 0 1-.048 0L2.585 9.342a2.98 2.98 0 0 1-1.113-4.094zm11.216 2.571L8.747 5.576l1.362-.776a.05.05 0 0 1 .048 0l3.265 1.86a3 3 0 0 1 1.173 1.207 2.96 2.96 0 0 1-.27 3.2 3.05 3.05 0 0 1-1.36.997V8.279a.52.52 0 0 0-.276-.445m1.36-2.015-.097-.057-3.226-1.855a.53.53 0 0 0-.53 0L6.249 6.153V4.598a.04.04 0 0 1 .019-.04L9.533 2.7a3.07 3.07 0 0 1 3.257.139c.474.325.843.778 1.066 1.303.223.526.289 1.103.191 1.664zM5.503 8.575 4.139 7.8a.05.05 0 0 1-.026-.037V4.049c0-.57.166-1.127.476-1.607s.752-.864 1.275-1.105a3.08 3.08 0 0 1 3.234.41l-.096.054-3.23 1.838a.53.53 0 0 0-.265.455zm.742-1.577 1.758-1 1.762 1v2l-1.755 1-1.762-1z" />
    </svg>
  );
}

function ClaudeIcon({ size = 22 }: BrandIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="m3.127 10.604 3.135-1.76.053-.153-.053-.085H6.11l-.525-.032-1.791-.048-1.554-.065-1.505-.08-.38-.081L0 7.832l.036-.234.32-.214.455.04 1.009.069 1.513.105 1.097.064 1.626.17h.259l.036-.105-.089-.065-.068-.064-1.566-1.062-1.695-1.121-.887-.646-.48-.327-.243-.306-.104-.67.435-.48.585.04.15.04.593.456 1.267.981 1.654 1.218.242.202.097-.068.012-.049-.109-.181-.9-1.626-.96-1.655-.428-.686-.113-.411a2 2 0 0 1-.068-.484l.496-.674L4.446 0l.662.089.279.242.411.94.666 1.48 1.033 2.014.302.597.162.553.06.17h.105v-.097l.085-1.134.157-1.392.154-1.792.052-.504.25-.605.497-.327.387.186.319.456-.045.294-.19 1.23-.37 1.93-.243 1.29h.142l.161-.16.654-.868 1.097-1.372.484-.545.565-.601.363-.287h.686l.505.751-.226.775-.707.895-.585.759-.839 1.13-.524.904.048.072.125-.012 1.897-.403 1.024-.186 1.223-.21.553.258.06.263-.218.536-1.307.323-1.533.307-2.284.54-.028.02.032.04 1.029.098.44.024h1.077l2.005.15.525.346.315.424-.053.323-.807.411-3.631-.863-.872-.218h-.12v.073l.726.71 1.331 1.202 1.667 1.55.084.383-.214.302-.226-.032-1.464-1.101-.565-.497-1.28-1.077h-.084v.113l.295.432 1.557 2.34.08.718-.112.234-.404.141-.444-.08-.911-1.28-.94-1.44-.759-1.291-.093.053-.448 4.821-.21.246-.484.186-.403-.307-.214-.496.214-.98.258-1.28.21-1.016.19-1.263.112-.42-.008-.028-.092.012-.953 1.307-1.448 1.957-1.146 1.227-.274.109-.477-.247.045-.44.266-.39 1.586-2.018.956-1.25.617-.723-.004-.105h-.036l-4.212 2.736-.75.096-.324-.302.04-.496.154-.162 1.267-.871z" />
    </svg>
  );
}

function GoogleIcon({ size = 22 }: BrandIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M15.545 6.558a9.4 9.4 0 0 1 .139 1.626c0 2.434-.87 4.492-2.384 5.885h.002C11.978 15.292 10.158 16 8 16A8 8 0 1 1 8 0a7.7 7.7 0 0 1 5.352 2.082l-2.284 2.284A4.35 4.35 0 0 0 8 3.166c-2.087 0-3.86 1.408-4.492 3.304a4.8 4.8 0 0 0 0 3.063h.003c.635 1.893 2.405 3.301 4.492 3.301 1.078 0 2.004-.276 2.722-.764h-.003a3.7 3.7 0 0 0 1.599-2.431H8v-3.08z" />
    </svg>
  );
}

function GeminiIcon({ size = 22 }: BrandIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M3 11.25C7.55635 11.25 11.25 7.55635 11.25 3H12.75C12.75 7.55635 16.4437 11.25 21 11.25V12.75C16.4437 12.75 12.75 16.4437 12.75 21H11.25C11.25 16.4437 7.55635 12.75 3 12.75V11.25Z" />
    </svg>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** The question being shared — text is built from this + the current prompt-style selection. */
  question: PYQQuestion | null;
  /** Title used only for the "Others" native share sheet fallback. */
  shareTitle: string;
  onFeedback: (message: string) => void;
  /**
   * Pre-fetched image file for image-based questions (question.image set),
   * fetched once when the sheet opens. Undefined/null for text-only questions.
   */
  imageFile?: File | null;
}

const APPS: {
  id: AiApp;
  label: string;
  icon: ElementType;
  tint: string;
}[] = [
  { id: "chatgpt", label: "ChatGPT", icon: OpenAIIcon, tint: "bg-teal-500/15 text-teal-300" },
  { id: "gemini", label: "Gemini", icon: GeminiIcon, tint: "bg-sky-500/15 text-sky-300" },
  { id: "claude", label: "Claude", icon: ClaudeIcon, tint: "bg-orange-500/15 text-orange-300" },
  { id: "google", label: "Google", icon: GoogleIcon, tint: "bg-amber-500/15 text-amber-300" },
  { id: "others", label: "Others", icon: MoreHorizontal, tint: "bg-slate-700/60 text-slate-300" },
];

const APPROACH_ROWS: { id: AiApproach; label: string; hasStyle: boolean }[] = [
  { id: "elimination", label: "Elimination", hasStyle: true },
  { id: "explanation", label: "Explanation", hasStyle: true },
  { id: "non-specific", label: "Non-specific", hasStyle: false },
];

export default function AskAiSheet({ open, onClose, question, shareTitle, onFeedback, imageFile }: Props) {
  const [selection, setSelection] = useState<AiPromptSelection>(() => getAiPromptSelection());

  if (!open) return null;

  const isImageQuestion = Boolean(question?.image);

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
    const result = await openAiApp(app, { text, shareTitle, imageFile });
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

        {isImageQuestion && (
          <p className="mb-3 text-xs font-medium text-red-400">
            Paste the image to the AI, if not sent automatically. Use Others to function smoothly.
          </p>
        )}

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
          <p className="mb-1.5 px-0.5 text-xs text-slate-500">Explanation Response Style</p>
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
                    <span className="text-[11px] text-slate-500">Normal Response</span>
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