import { useState, useMemo } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import type { PYQQuestion, QuizAnswer } from "../types";
import { loadExplanations } from "../data/questions";

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
    { value: skipped, color: "#475569" },   // slate
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
        stroke={color}
        strokeWidth={16}
        strokeDasharray={`${dash} ${gap}`}
        strokeDashoffset={-offset}
        strokeLinecap="butt"
        style={{ transform: "rotate(-90deg)", transformOrigin: `${cx}px ${cy}px` }}
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
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="#1e293b" strokeWidth={16} />
        {arcs}
      </svg>
      <div className="absolute flex flex-col items-center leading-none text-center">
        <span className="text-base font-bold text-slate-100">{pct}%</span>
        <span className="mt-0.5 text-[10px] text-slate-500">Correct</span>
      </div>
    </div>
  );
}

// ─── Read-only question review card ─────────────────────
function ReviewCard({
  question,
  answer,
  examId,
}: {
  question: PYQQuestion;
  answer: QuizAnswer | undefined;
  examId: string;
}) {
  const explanations = useMemo(
    () => loadExplanations(examId as Parameters<typeof loadExplanations>[0], question.subjectId),
    [examId, question.subjectId]
  );
  const explanation = explanations.find((x) => x.id === question.id);

  const selectedIdx = answer?.selected ?? null;
  const skipped = answer === undefined || selectedIdx === null;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-4 sm:px-5">
      {/* question text */}
      <p className="text-sm font-semibold leading-6 text-slate-100">{question.question}</p>

      {/* options */}
      <div className="mt-3 space-y-2">
        {question.options.map((opt, idx) => {
          const isCorrect = idx === question.answer;
          const isSelected = idx === selectedIdx;
          const isWrong = isSelected && !isCorrect;

          let cls =
            "flex w-full items-start gap-3 rounded-xl border p-3 text-left text-sm ";
          if (isCorrect && !skipped)
            cls += "border-emerald-500/70 bg-emerald-500/10 text-emerald-100";
          else if (isCorrect && skipped)
            cls += "border-sky-700/50 bg-sky-950/30 text-sky-200";
          else if (isWrong)
            cls += "border-red-500/70 bg-red-500/10 text-red-100";
          else
            cls += "border-slate-800 bg-slate-950/50 text-slate-400";

          return (
            <div key={idx} className={cls}>
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold ${
                  isCorrect && !skipped
                    ? "bg-emerald-500/20 text-emerald-300"
                    : isWrong
                    ? "bg-red-500/20 text-red-300"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {String.fromCharCode(65 + idx)}
              </span>
              <span className="min-w-0 flex-1 pt-1">{opt}</span>
            </div>
          );
        })}
      </div>

      {/* status badge */}
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
        <span>{question.id}</span>
        <span>•</span>
        <span>{question.year}</span>
        {question.topicName && (
          <>
            <span>•</span>
            <span>{question.topicName}</span>
          </>
        )}
        <span>•</span>
        <span
          className={
            skipped
              ? "text-slate-400"
              : answer?.correct
              ? "text-emerald-400"
              : "text-red-400"
          }
        >
          {skipped ? "Skipped" : answer?.correct ? "Correct" : "Incorrect"}
        </span>
      </div>

      {/* explanation */}
      <div className="mt-3 border-t border-slate-800 pt-3">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Explanation
        </p>
        {explanation ? (
          <p className="text-sm leading-6 text-slate-300">{explanation.e}</p>
        ) : (
          <p className="text-sm leading-6 text-slate-500">Explanation not available yet.</p>
        )}
      </div>
    </div>
  );
}

// ─── Main Summary page ───────────────────────────────
type SummaryFilter = "all" | "correct" | "incorrect" | "skipped";

interface ResultState {
  total: number;
  answers: QuizAnswer[];
  questions: PYQQuestion[];
  custom: boolean;
}

export default function Result() {
  const { exam } = useParams();
  const location = useLocation();
  const state = location.state as ResultState | null;

  const [filter, setFilter] = useState<SummaryFilter>("all");

  const total = state?.total ?? 0;
  const answers = state?.answers ?? [];
  const questions = state?.questions ?? [];

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

  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      const a = answerMap.get(q.id);
      if (filter === "all") return true;
      if (filter === "correct") return a?.correct === true;
      if (filter === "incorrect") return a !== undefined && !a.correct && a.selected !== null;
      if (filter === "skipped") return a === undefined || a.selected === null;
      return true;
    });
  }, [questions, answerMap, filter]);

  const tabs: Array<{ key: SummaryFilter; label: string; count: number }> = [
    { key: "all", label: "All", count: total },
    { key: "correct", label: "Correct", count: correct },
    { key: "incorrect", label: "Incorrect", count: incorrect },
    { key: "skipped", label: "Skipped", count: skipped },
  ];

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      {/* ── Top card ── */}
      <div className="relative rounded-3xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8">
        <p className="text-xs uppercase tracking-wider text-slate-500">Summary</p>

        {/* Donut — absolute top-right inside the card */}
        <div className="absolute right-6 top-6 sm:right-8 sm:top-8">
          <DonutChart correct={correct} incorrect={incorrect} skipped={skipped} />
        </div>

        {/* Headline — sits left, donut floats top-right via absolute */}
        <div className="mt-3 pr-36">
          <h1 className="text-3xl font-bold">{correct}/{total}</h1>
          <p className="mt-1 text-sm text-slate-500">{accuracy}% accuracy</p>
        </div>

        {/* C / I / S boxes — full width, below headline, not affected by donut */}
        <div className="mt-7 grid grid-cols-3 gap-2">
          <StatBox label="Correct" value={correct} color="text-emerald-400" />
          <StatBox label="Incorrect" value={incorrect} color="text-red-400" />
          <StatBox label="Skipped" value={skipped} color="text-slate-400" />
        </div>

        {/* Actions */}
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

      {/* ── View Summary section ── */}
      {questions.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-base font-bold text-slate-100">View Summary</h2>

          {/* Filter tabs */}
          <div className="flex overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-1">
            {tabs.map(({ key, label, count }) => {
              const active = filter === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={`min-w-fit flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                    active
                      ? "bg-slate-800 text-white"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {label}
                  <span
                    className={`ml-1 ${active ? "text-slate-300" : "text-slate-600"}`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Question review cards */}
          <div className="mt-3 space-y-4">
            {filteredQuestions.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">
                No questions in this category.
              </p>
            ) : (
              filteredQuestions.map((q) => (
                <ReviewCard
                  key={q.id}
                  question={q}
                  answer={answerMap.get(q.id)}
                  examId={exam ?? "NEET-PG"}
                />
              ))
            )}
          </div>
        </section>
      )}
    </main>
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
