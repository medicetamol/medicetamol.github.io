import { useState, useMemo, useEffect } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import type { PYQQuestion, QuizAnswer } from "../types";
import { getAllBookmarks } from "../lib/db";
import { SUBJECTS } from "../constants";

// ─── Donut chart ───
function DonutChart({
  correct,
  incorrect,
  skipped,
}: {
  correct: number;
  incorrect: number;
  skipped: number;
}) {
  const total = correct + incorrect + skipped;
  if (total === 0) return null;

  const R = 44;
  const cx = 56;
  const cy = 56;
  const circumference = 2 * Math.PI * R;

  const segments = [
    { value: correct, color: "#22c55e" },   // green
    { value: incorrect, color: "#ef4444" }, // red
    { value: skipped, color: "rgb(var(--slate-600))" }, // slate (themed)
  ];

  let offset = 0;
  const arcs = segments.map(({ value, color }) => {
    const fraction = value / total;
    const dash = fraction * circumference;
    const gap = circumference - dash;
    const arc = (
      <circle
        key={color}
        cx={cx}
        cy={cy}
        r={R}
        fill="none"
        strokeWidth={16}
        strokeDasharray={`${dash} ${gap}`}
        strokeDashoffset={-offset}
        strokeLinecap="butt"
        style={{ stroke: color, transform: "rotate(-90deg)", transformOrigin: `${cx}px ${cy}px` }}
      />
    );
    offset += dash;
    return arc;
  });

  const pct = total ? Math.round((correct / total) * 100) : 0;

  return (
    <div className="relative flex shrink-0 items-center justify-center">
      <svg width={112} height={112} viewBox="0 0 112 112">
        {/* track */}
        <circle cx={cx} cy={cy} r={R} fill="none" className="stroke-slate-800" strokeWidth={16} />
        {arcs}
      </svg>
      <div className="absolute flex flex-col items-center leading-none text-center">
        <span className="text-base font-bold text-slate-100">{pct}%</span>
        <span className="mt-0.5 text-[10px] text-slate-500">Correct</span>
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}

// ─── Main Summary page ───────────────────────────────

interface ResultState {
  total: number;
  answers: QuizAnswer[];
  questions: PYQQuestion[];
  custom: boolean;
  reviewedQids?: string[];
  guessedQids?: string[];
}

export default function Result() {
  const { exam } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as ResultState | null;

  const [bookmarkedQids, setBookmarkedQids] = useState<Set<string>>(new Set());

  useEffect(() => {
    getAllBookmarks().then((rows) => setBookmarkedQids(new Set(rows.map((b) => b.qid))));
  }, []);

  const total = state?.total ?? 0;
  const answers = Array.isArray(state?.answers) ? state!.answers : [];
  const questions = Array.isArray(state?.questions) ? state!.questions : [];
  const reviewedQids = state?.reviewedQids ?? [];
  const guessedQids = state?.guessedQids ?? [];

  const correct = answers.filter((a) => a.correct).length;
  const incorrect = answers.filter((a) => !a.correct && a.selected !== null).length;
  const skipped = total - correct - incorrect;
  const accuracy = (correct + incorrect) > 0
    ? Math.round((correct / (correct + incorrect)) * 100)
    : 0;

  // Build a map for fast lookup
  const answerMap = useMemo(
    () => new Map(answers.map((a) => [a.qid, a])),
    [answers]
  );

  // ── Analysis grouping: subject-wise (multi-subject) or topic-wise (single) ──
  const subjectIds = useMemo(
    () => new Set(questions.map((q) => q.subjectId)),
    [questions]
  );
  const isMultiSubject = subjectIds.size > 1;

  type AnalysisGroup = { key: string; label: string; total: number; correct: number; questions: PYQQuestion[] };

  const analysisGroups = useMemo<AnalysisGroup[]>(() => {
    const groups = new Map<string, AnalysisGroup>();
    for (const q of questions) {
      const key = isMultiSubject ? q.subjectId : (q.topicId || "misc");
      const label = isMultiSubject
        ? SUBJECTS.find((s) => s.id === q.subjectId)?.name ?? q.subjectId
        : (q.topicName || "Miscellaneous");
      if (!groups.has(key)) {
        groups.set(key, { key, label, total: 0, correct: 0, questions: [] });
      }
      const g = groups.get(key)!;
      g.total += 1;
      g.questions.push(q);
      const a = answerMap.get(q.id);
      if (a?.correct) g.correct += 1;
    }
    return Array.from(groups.values()).sort((a, b) => b.total - a.total);
  }, [questions, isMultiSubject, answerMap]);

  // ── Opening the Quiz in attempted/read-only state ──
  // Filtering (Correct/Incorrect/Skipped/Reviewed/Guessing/Bookmark) and the
  // Hide-Option toggle both live INSIDE that read-only view now (its own
  // hybrid legend+filter sheet) — Result always hands off the full subset
  // and lets the reader narrow it down from there.
  const openAttempted = (subset: PYQQuestion[]) => {
    if (subset.length === 0) return;
    const ids = subset.map((q) => q.id);
    const selections = subset.map((q) => answerMap.get(q.id)?.selected ?? null);
    const subsetReviewed = subset.filter((q) => reviewedQids.includes(q.id)).map((q) => q.id);
    const subsetGuessed = subset.filter((q) => guessedQids.includes(q.id)).map((q) => q.id);
    navigate(`/quiz/${exam}/custom?source=custom&readonly=1&ids=${ids.join(",")}`, {
      state: {
        answers: selections,
        reviewedQids: subsetReviewed,
        guessedQids: subsetGuessed,
        bookmarkedQids: subset.filter((q) => bookmarkedQids.has(q.id)).map((q) => q.id),
      },
    });
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      {/* ── Top card (unchanged) ── */}
      <div className="relative rounded-3xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8">
        <p className="text-xs uppercase tracking-wider text-slate-500">Summary</p>

        <div className="absolute right-6 top-6 sm:right-8 sm:top-8">
          <DonutChart correct={correct} incorrect={incorrect} skipped={skipped} />
        </div>

        <div className="mt-3 pr-36">
          <h1 className="text-3xl font-bold">{correct}/{total}</h1>
          <p className="mt-1 text-sm text-slate-500">{accuracy}% accuracy</p>
        </div>

        <div className="mt-7 grid grid-cols-3 gap-2">
          <StatBox label="Correct" value={correct} color="text-emerald-400" />
          <StatBox label="Incorrect" value={incorrect} color="text-red-400" />
          <StatBox label="Skipped" value={skipped} color="text-slate-400" />
        </div>

        <div className="mt-7 flex gap-2">
          <Link
            to={`/pyqs/${exam}`}
            className="flex-1 rounded-xl bg-slate-100 px-4 py-3 text-center text-sm font-bold text-slate-950"
          >
            Back to PYQs
          </Link>
          <Link
            to="/progress"
            className="flex-1 rounded-xl border border-slate-700 px-4 py-3 text-center text-sm font-semibold"
          >
            Progress
          </Link>
        </div>
      </div>

      {questions.length > 0 && (
        <>
          {/* ── See Explanations card ── */}
          <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <h2 className="text-base font-bold text-slate-100">All questions</h2>
            <p className="mt-1 text-sm text-slate-500">
              {questions.length} question{questions.length === 1 ? "" : "s"}
            </p>
            <button
              type="button"
              onClick={() => openAttempted(questions)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-950"
            >
              See Explanations
              <ChevronRight size={16} />
            </button>
          </section>

          {/* ── Analysis section ── */}
          <section className="mt-6">
            <h2 className="mb-3 text-base font-bold text-slate-100">
              {isMultiSubject ? "Subject-wise analysis" : "Topic-wise analysis"}
            </h2>
            <div className="space-y-2">
              {analysisGroups.map((g) => {
                const pct = g.total > 0 ? Math.round((g.correct / g.total) * 100) : 0;
                return (
                  <button
                    key={g.key}
                    type="button"
                    onClick={() => openAttempted(g.questions)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3.5 text-left hover:border-slate-700"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-100">{g.label}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {g.correct}/{g.total} correct &middot; {pct}%
                      </p>
                    </div>
                    <ChevronRight size={18} className="shrink-0 text-slate-600" />
                  </button>
                );
              })}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
