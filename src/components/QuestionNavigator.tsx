import { ClipboardCheck, HelpCircle, X } from "lucide-react";

// ─── Per-question status for the navigator grid ──────────────────────────────
// "review" and "answered-review" only ever occur where markForReview is used
// (Quiz.tsx sessions). BookmarkQuiz only ever produces the other three.
export type NavStatus =
  | "not-visited"
  | "not-answered"
  | "answered"
  | "review"
  | "answered-review";

const STATUS_STYLE: Record<NavStatus, string> = {
  "not-visited": "border border-slate-700 bg-slate-900 text-slate-500",
  "not-answered": "bg-red-900/70 text-red-100",
  answered: "bg-emerald-800/80 text-emerald-100",
  review: "bg-violet-700/80 text-violet-100",
  "answered-review": "bg-emerald-800/80 text-emerald-100",
};

const LEGEND_ITEMS: { status: NavStatus; label: string; dot?: boolean }[] = [
  { status: "not-visited", label: "Not visited" },
  { status: "not-answered", label: "Not answered" },
  { status: "answered", label: "Answered" },
  { status: "review", label: "Review" },
  { status: "answered-review", label: "Answered + review", dot: true },
];

export default function QuestionNavigator({
  open,
  onClose,
  total,
  currentIndex,
  statuses,
  onJump,
  showReviewLegend = true,
  guessedIndices,
  onFinalSubmit,
  finalSubmitLabel = "FINAL SUBMIT",
}: {
  open: boolean;
  onClose: () => void;
  total: number;
  currentIndex: number;
  statuses: NavStatus[]; // length === total
  onJump: (index: number) => void;
  showReviewLegend?: boolean;
  // Positions marked as a guessing answer — independent of `statuses` so it
  // can overlay any status (answered, review, etc.) rather than needing a
  // combinatorial NavStatus variant per pairing. Omit entirely for sessions
  // that don't support guess-tagging (e.g. BookmarkQuiz).
  guessedIndices?: Set<number>;
  // When provided, renders a Final Submit button at the bottom of the sheet —
  // same handler as the bottom bar's button, just reachable from here too.
  onFinalSubmit?: () => void;
  finalSubmitLabel?: string;
}) {
  if (!open) return null;

  const legend = showReviewLegend
    ? LEGEND_ITEMS
    : LEGEND_ITEMS.filter((l) => l.status === "not-visited" || l.status === "not-answered" || l.status === "answered");

  const counts = statuses.reduce(
    (acc, s) => {
      if (s === "answered" || s === "answered-review") acc.answered += 1;
      else if (s === "review") acc.review += 1;
      else if (s === "not-answered") acc.skipped += 1;
      else acc.notVisited += 1;
      return acc;
    },
    { answered: 0, review: 0, skipped: 0, notVisited: 0 }
  );
  const guessCount = guessedIndices?.size ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Question navigator"
      onClick={onClose}
    >
      <div
        className="max-h-[75vh] w-full max-w-4xl overflow-y-auto rounded-t-2xl border-t border-slate-700 bg-slate-900 px-4 pb-6 pt-3 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-slate-700" />

        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-100">Question navigator</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-200"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-x-3 gap-y-2 text-xs text-slate-400">
          {legend.map(({ status, label, dot }) => (
            <span key={status} className="flex items-center gap-1.5">
              <span className={`relative inline-block h-2.5 w-2.5 rounded-sm ${STATUS_STYLE[status]}`}>
                {dot && (
                  <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-violet-400" />
                )}
              </span>
              {label}
            </span>
          ))}
          {guessedIndices !== undefined && (
            <span className="flex items-center gap-1.5">
              <HelpCircle size={12} className="text-amber-400" /> Guessing
            </span>
          )}
        </div>

        <div className="grid grid-cols-7 gap-2 sm:grid-cols-8">
          {Array.from({ length: total }).map((_, i) => {
            const status = statuses[i] ?? "not-visited";
            const isCurrent = i === currentIndex;
            return (
              <button
                key={i}
                type="button"
                onClick={() => onJump(i)}
                className={`relative aspect-square rounded-lg text-sm font-semibold transition-colors ${STATUS_STYLE[status]} ${
                  isCurrent ? "ring-2 ring-sky-400" : ""
                }`}
                aria-label={`Go to question ${i + 1}`}
                aria-current={isCurrent ? "true" : undefined}
              >
                {i + 1}
                {status === "answered-review" && (
                  <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-violet-400" />
                )}
                {guessedIndices?.has(i) && (
                  <HelpCircle size={10} className="absolute bottom-0.5 left-0.5 text-amber-300" strokeWidth={2.5} />
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-800 pt-3 text-xs text-slate-400">
          <span>Answered: {counts.answered}</span>
          {showReviewLegend && <span>Review: {counts.review}</span>}
          {guessedIndices !== undefined && <span>Guessing: {guessCount}</span>}
          <span>Skipped: {counts.skipped}</span>
          <span>Not visited: {counts.notVisited}</span>
        </div>

        {onFinalSubmit && (
          <button
            type="button"
            onClick={onFinalSubmit}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-750"
          >
            <ClipboardCheck size={18} strokeWidth={2.1} />
            {finalSubmitLabel}
          </button>
        )}
      </div>
    </div>
  );
}