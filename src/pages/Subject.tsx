import { ArrowLeft, Play, Trash2 } from "lucide-react";
import { Link, useParams } from 'react-router-dom';
import { EXAMS, getSubject } from "../constants";
import { loadQuestions } from "../data/questions";
import manifest from "../data/manifest.json";
import EmptyState from "../components/EmptyState";
import React, { useEffect, useMemo, useState } from 'react';
import { getAllQuestionProgress } from "../lib/db";
import type { PYQQuestion } from "../types";

type SubjectManifest = { total: number; topics: Record<string, number> };
type Manifest = Record<string, Record<string, SubjectManifest>>;
const manifestCounts = manifest as Manifest;

export default function Subject() {
  const { exam, subjectId } = useParams();
  const subject = getSubject(subjectId ?? "");
  const examId = exam as "NEET-PG" | "INI-CET" | "FMGE";

  const manifestEntry = manifestCounts[examId]?.[subjectId ?? ""];

  // Serial order — no shuffle
  const [questions, setQuestions] = useState<PYQQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadQuestions(examId, subjectId ?? "").then((result) => {
      if (cancelled) return;
      setQuestions(result);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [examId, subjectId]);

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

  // Topic pills: use loaded question data once available, otherwise fall back to the
  // manifest's topic counts + subject.topics names so pills render instantly on mount.
  const topics: Array<[string, string]> = questions.length > 0
    ? Array.from(
        new Map(questions.map((q): [string, string] => [q.topicId, q.topicName ?? q.topicId])).entries()
      )
    : Object.keys(manifestEntry?.topics ?? {}).map((code): [string, string] => [
        code,
        subject.topics.find((t) => t.id === code)?.name ?? code
      ]);

  const filtered = selectedTopic === "all"
    ? questions
    : questions.filter((q) => q.topicId === selectedTopic);

  // Overall subject progress — manifest total is available instantly; question-derived
  // total (once loaded) is used as the source of truth once available for consistency.
  const totalCount = questions.length > 0 ? questions.length : (manifestEntry?.total ?? 0);
  const attemptedCount = attemptedIds.size;
  const solvedPct = totalCount > 0 ? Math.round((attemptedCount / totalCount) * 100) : 0;
  const accuracyPct = attemptedCount > 0 ? Math.round((correctCount / attemptedCount) * 100) : 0;

  // Per-topic counts — from loaded questions once available, else manifest counts
  const topicStats = useMemo(() => {
    const map = new Map<string, { total: number; attempted: number }>();
    if (questions.length > 0) {
      for (const q of questions) {
        const existing = map.get(q.topicId) ?? { total: 0, attempted: 0 };
        existing.total += 1;
        if (attemptedIds.has(q.id)) existing.attempted += 1;
        map.set(q.topicId, existing);
      }
    } else if (manifestEntry) {
      for (const [code, count] of Object.entries(manifestEntry.topics)) {
        map.set(code, { total: count, attempted: 0 });
      }
    }
    return map;
  }, [questions, attemptedIds, manifestEntry]);

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
            background: `linear-gradient(to right, rgba(148,163,184,0.15) ${solvedPct}%, rgba(148,163,184,0.06) ${solvedPct}%)`,
            border: "1px solid rgba(148,163,184,0.1)",
          }}
        >
          <p className="px-3 py-1.5 text-xs text-slate-400">
            {totalCount} PYQ{totalCount === 1 ? "" : "s"}
            {attemptedCount > 0 && (
              <span className="ml-1.5">· {solvedPct}% solved</span>
            )}
          </p>
        </div>
      </div>

      {!loading && questions.length === 0 ? (
        <EmptyState subject={subject.name} />
      ) : (
        <>
          {/* Topic filter */}
          <div className="rounded-2xl border border-slate-800 bg-transparent p-4">
            <div className="flex flex-wrap gap-2">
              {/* All topics pill */}
              <button
                onClick={() => setSelectedTopic("all")}
                className="relative overflow-hidden rounded-lg px-3 py-2 text-xs font-semibold"
                style={
                  selectedTopic === "all"
                    ? { background: "rgba(241,245,249,1)", color: "#0f172a", border: "1px solid transparent" }
                    : { background: "rgba(148,163,184,0.06)", color: "rgb(203,213,225)", border: "1px solid rgba(148,163,184,0.1)" }
                }
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
                    className="relative overflow-hidden rounded-lg px-3 py-2 text-xs font-semibold"
                    style={
                      isActive
                        ? { background: "rgba(241,245,249,1)", color: "#0f172a", border: "1px solid transparent" }
                        : {
                            background: `linear-gradient(to right, rgba(148,163,184,0.15) ${topicPct}%, rgba(148,163,184,0.06) ${topicPct}%)`,
                            border: "1px solid rgba(148,163,184,0.1)",
                            color: "rgb(203,213,225)",
                          }
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