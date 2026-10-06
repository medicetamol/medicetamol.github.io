import { Check, MessageSquareWarning, Share, X } from "lucide-react";
import React, { lazy, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PYQQuestion } from "../types";
import ImageZoomModal from "./ImageZoomModal";
import { formatQuestionForShare, getSiteUrl, shareOrCopy } from "../lib/sharing";
import { buildShareCardFile } from "../lib/shareCard";

interface Props {
  question: PYQQuestion;
  submitted: boolean;
  selected: number | null;
  timedOut?: boolean;
  bookmarked: boolean;
  onSelect: (index: number) => void;
  onBookmark: () => void;
  hasDetailedExplanation?: boolean;
  onShareFeedback?: (message: string) => void;
  // When true, suppress ALL option coloring (correct/incorrect/selected) —
  // a "blind re-attempt" view. The explanation section is unaffected; it's
  // driven by `submitted` alone, not by this prop.
  hideMarking?: boolean;
}

export default function QuestionCard({
  question,
  selected,
  submitted,
  timedOut = false,
  onSelect,
  hasDetailedExplanation = false,
  onShareFeedback,
  hideMarking = false,
}: Props) {
  const [imgModal, setImgModal] = useState(false);
  const navigate = useNavigate();

  const solveUrl = getSiteUrl(`/solve/${question.id}`);

  // Lock body scroll + handle back + Escape when modal open
  useEffect(() => {
    if (!imgModal) return;
    document.body.style.overflow = "hidden";
    window.history.pushState({ imgModal: true }, "");
    const onPop = () => setImgModal(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setImgModal(false); };
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKey);
    };
  }, [imgModal]);

  const shareQuestion = async () => {
    // Every question (image-based or not) shares as the branded card image,
    // captioned with just the direct solve link. Falls back to the old
    // plain-text share if the canvas render fails for any reason.
    const cardFile = await buildShareCardFile(question);
    const result = cardFile
      ? await shareOrCopy({
          title: "Share PYQ • mediceTaMol",
          text: `✨ Directly Solve here:\n${solveUrl}`,
          files: [cardFile],
        })
      : await shareOrCopy({
          title: "Share PYQ • mediceTaMol",
          text: formatQuestionForShare(question),
          url: solveUrl,
        });
    onShareFeedback?.(
      result === "copied" ? "Question copied to clipboard" :
      result === "shared" ? "Share sheet opened" : "Unable to share"
    );
  };


  return (
    <>
    <section className="w-full rounded-2xl border border-slate-800 bg-slate-900/70 px-2.5 py-3 sm:px-4 sm:py-5">
      <h2 className="text-base font-semibold leading-7 text-slate-100 sm:text-lg">
        {question.question}
      </h2>

      {question.image && (
        <button
          type="button"
          onClick={() => setImgModal(true)}
          className="mt-3 w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-950"
          aria-label="View image fullscreen"
        >
          <img
            src={question.image}
            alt="Question"
            loading="lazy"
            className="max-h-64 w-full object-contain"
          />

        </button>
      )}
      
      <div className="mt-4 space-y-2 pb-3">
        {question.options.map((option, index) => {
          const isCorrect = !hideMarking && submitted && index === question.answer;
          const isWrong = !hideMarking && submitted && selected === index && index !== question.answer;
          const isSelected = !hideMarking && selected === index;

          const correctClass =
            timedOut && selected === null
              ? "border-sky-700/70 bg-sky-950/40 text-sky-200"
              : "border-emerald-500/70 bg-emerald-500/10 text-emerald-100";
          const wrongClass = "border-red-500/70 bg-red-500/10 text-red-100";

          return (
            <button
              key={index}
              type="button"
              disabled={submitted}
              onClick={() => onSelect(index)}
              className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-left text-sm transition ${
                isCorrect ? correctClass : isWrong ? wrongClass : isSelected
                  ? "border-accent bg-accent-soft text-slate-100"
                  : "border-slate-800 bg-slate-950/50 text-slate-100 hover:border-slate-600"
              }`}
            >
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold ${
                isCorrect && !(timedOut && selected === null)
                  ? "bg-emerald-500/20 text-emerald-300"
                  : isWrong ? "bg-red-500/20 text-red-300" : isSelected ? "bg-accent text-accent-ink" : "bg-slate-800 text-slate-300"
              }`}>
                {String.fromCharCode(65 + index)}
              </span>
              <span className="min-w-0 flex-1 pt-1">{option}</span>
              {isCorrect && <Check size={17} className="mt-1 shrink-0" />}
              {isWrong && <X size={17} className="mt-1 shrink-0 text-red-400" />}
            </button>
          );
        })}
      </div>

      {submitted && (
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-800 pt-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5 text-slate-400">
              <span>{question.id}</span>
              <span>•</span>
              <span>{question.year}</span>
              {question.topicName && (
                <>
                  <span>•</span>
                  <span>{question.topicName}</span>
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate(`/report/${question.id}`)}
            className="shrink-0 self-center rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            aria-label="Report an error"
            title="Report an error"
          >
            <MessageSquareWarning size={19} strokeWidth={1.9} />
          </button>

          <button
            type="button"
            onClick={shareQuestion}
            className="shrink-0 self-center rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            aria-label="Share question"
            title="Share question"
          >
            <Share size={20} strokeWidth={1.9} />
          </button>
        </div>
      )}
    </section>

    {/* Full screen image modal (own pinch / double-tap zoom; page zoom is locked app-wide) */}
    {imgModal && question.image && (
      <ImageZoomModal src={question.image} onClose={() => setImgModal(false)} />
    )}
    </>
  );
}