import { ArrowLeft, Play, Trash2 } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { EXAMS, getSubject } from "../constants";
import { loadQuestions } from "../data/questions";
import EmptyState from "../components/EmptyState";
import { useEffect, useMemo, useState } from "react";
import { getAllQuestionProgress } from "../lib/db";

export default function Subject() {
  const { exam, subjectId } = useParams();
  const subject = getSubject(subjectId ?? "");
  const examId = exam as "NEET-PG" | "INI-CET" | "FMGE";

  // Serial order — no shuffle
  const questions = useMemo(
    () => loadQuestions(examId, subjectId ?? ""),
    [examId, subjectId]
  );

  const [selectedTopic, setSelectedTopic] = useState<string>("all");

  // Progress stats for this subject
  const [attemptedIds, setAttemptedIds] = useState<Set<string>>(new Set());
  const [correctCount, setCorrectCount] = useState(0);
  const [bookmarkCount, setBookmarkCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const subjectQids = new Set(questions.map((q) => q.id));
    getAllQuestionProgress().then((all) => {
      if (cancelled) return;
      const subjectRows = all.filter((p) => subjectQids.has(p.qid));
      const attempted = new Set(
        subjectRows.filter((p) => p.attempts > 0).map((p) => p.qid)
      );
      const correct = subjectRows.reduce((n, p) => n + p.correctAttempts, 0);
      const bookmarks = subjectRows.filter((p) => p.bookmarked).length;
      setAttemptedIds(attempted);
      setCorrectCount(correct);
      setBookmarkCount(bookmarks);
    });
    return () => { cancelled = true; };
  }, [questions]);

  if (!subject) return null;

  const topics = Array.from(
    new Map(questions.map((q) => [q.topicId, q.topicName ?? q.topicId])).entries()
  );

  const filtered = selectedTopic === "all"
    ? questions
    : questions.filter((q) => q.topicId === selectedTopic);

  // Overall subject progress
  const totalCount = questions.length;
  const attemptedCount = attemptedIds.size;
  const solvedPct = totalCount > 0 ? Math.round((attemptedCount / totalCount) * 100) : 0;
  const accuracyPct = attemptedCount > 0 ? Math.round((correctCount / attemptedCount) * 100) : 0;

  // Per-topic counts
  const topicStats = useMemo(() => {
    const map = new Map<string, { total: number; attempted: number }>();
    for (const q of questions) {
      const existing = map.get(q.topicId) ?? { total: 0, attempted: 0 };
      existing.total += 1;
      if (attemptedIds.has(q.id)) existing.attempted += 1;
      map.set(q.topicId, existing);
    }
    return map;
  }, [questions, attemptedIds]);

  // Donut SVG values
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const solvedArc = (solvedPct / 100) * circumference;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link
        to={`/pyqs/${exam}`}
        className="mb-6 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-200"
      >
        <ArrowLeft size={16} /> {EXAMS.find((e) => e.id === examId)?.name}
      </Link>

      {/* Header with inline progress bar */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{subject.name}</h1>
        <div
          className="mt-2 overflow-hidden rounded-full"
          style={{
            background: `linear-gradient(to right, rgba(255,255,255,0.18) ${solvedPct}%, rgba(255,255,255,0.05) ${solvedPct}%)`,
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <p className="px-3 py-1.5 text-xs text-slate-400">
            {totalCount} PYQ{totalCount === 1 ? "" : "s"}
            {attemptedCount > 0 && (
              <span className="ml-1.5 text-slate-500">· {solvedPct}% solved</span>
            )}
          </p>
        </div>
      </div>

      {questions.length === 0 ? (
        <EmptyState subject={subject.name} />
      ) : (
        <>
          {/* Topic filter */}
          <div className="rounded-2xl border border-slate-800 bg-transparent p-4">
            <div className="flex flex-wrap gap-2">
              {/* All topics pill */}
              <button
                onClick={() => setSelectedTopic("all")}
                className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                  selectedTopic === "all"
                    ? "bg-slate-100 text-slate-950"
                    : "bg-slate-800 text-slate-300"
                }`}
              >
                All topics
              </button>

              {topics.map(([id, name]) => {
                const stats = topicStats.get(id) ?? { total: 0, attempted: 0 };
                const topicPct = stats.total > 0
                  ? Math.round((stats.attempted / stats.total) * 100)
                  : 0;
                const isActive = selectedTopic === id;

                return (
                  <button
                    key={id}
                    onClick={() => setSelectedTopic(id)}
                    className={`relative overflow-hidden rounded-lg px-3 py-2 text-xs font-semibold ${
                      isActive
                        ? "bg-slate-100 text-slate-950"
                        : "text-slate-300"
                    }`}
                    style={
                      !isActive
                        ? {
                            background: `linear-gradient(to right, rgba(255,255,255,0.18) ${topicPct}%, rgba(255,255,255,0.05) ${topicPct}%)`,
                            border: "1px solid rgba(255,255,255,0.1)",
                          }
                        : undefined
                    }
                  >
                    {name}
                    <span
                      className={`ml-1.5 rounded px-1 text-[10px] font-normal ${
                        isActive ? "text-slate-600" : "text-slate-600"
                      }`}
                    >
                      {stats.total}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Start bar */}
          <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-4 py-3">
            <span className="text-sm text-slate-400">
              {filtered.length} question{filtered.length === 1 ? "" : "s"} selected
            </span>
            <Link
              to={`/quiz/${exam}/${subjectId}?source=direct&topic=${selectedTopic}`}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-xs font-bold text-slate-950"
            >
              <Play size={15} /> Start
            </Link>
          </div>

          {/* Progress section */}
          {attemptedCount > 0 && (
            <div className="mt-6 border-t border-slate-800/60 pt-5">
              <div className="flex items-center gap-5">
                {/* Donut */}
                <svg width="72" height="72" viewBox="0 0 72 72" className="shrink-0 -rotate-90">
                  {/* Track */}
                  <circle
                    cx="36" cy="36" r={radius}
                    fill="none"
                    stroke="rgba(148,163,184,0.1)"
                    strokeWidth="7"
                  />
                  {/* Solved arc */}
                  <circle
                    cx="36" cy="36" r={radius}
                    fill="none"
                    stroke="rgba(148,163,184,0.55)"
                    strokeWidth="7"
                    strokeDasharray={`${solvedArc} ${circumference}`}
                    strokeLinecap="round"
                  />
                </svg>

                {/* Text */}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-200">
                    {accuracyPct}% Accuracy
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {attemptedCount} Solved · {totalCount - attemptedCount} Remaining · {bookmarkCount} Bookmark{bookmarkCount === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Clear progress link */}
      <div className="mt-10 border-t border-slate-800/60 pt-5 text-center">
        <Link
          to="/progress"
          state={{ scrollToSubjects: true, highlightSubject: subjectId }}
          className="inline-flex items-center gap-1.5 text-xs text-slate-600 underline underline-offset-4 decoration-slate-700 hover:text-slate-400 transition-colors"
        >
          <Trash2 size={12} />
          Clear {subject.name} progress
        </Link>
      </div>
    </main>
  );
}