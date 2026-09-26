import { LayoutGrid, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCustomModuleHistory, saveCustomModuleHistory, RESUME_WINDOW_MS } from "../lib/db";
import { findQuestion } from "../data/questions";
import { readModuleDraft } from "../lib/moduleDraft";
import type { CustomModuleHistoryEntry, PYQQuestion, QuizAnswer } from "../types";

// ─── Score donut: correct/incorrect/skipped ring with center %. Pure SVG,
// renders instantly from the entry's stored counts — no async fetch, no
// separate "compute" pass, so it never flashes in after the card mounts. ──
function ScoreDonut({ entry }: { entry: CustomModuleHistoryEntry }) {
  const total = entry.correctCount + entry.incorrectCount + entry.skippedCount;
  const r = 22;
  const circumference = 2 * Math.PI * r;
  const pct = total > 0 ? Math.round((entry.correctCount / total) * 100) : 0;

  if (total === 0) {
    return (
      <svg width="54" height="54" viewBox="0 0 54 54" className="shrink-0">
        <circle cx="27" cy="27" r={r} fill="none" stroke="currentColor" className="text-slate-800" strokeWidth="7" />
      </svg>
    );
  }

  const correctLen = (entry.correctCount / total) * circumference;
  const incorrectLen = (entry.incorrectCount / total) * circumference;
  const skippedLen = (entry.skippedCount / total) * circumference;

  return (
    <svg width="54" height="54" viewBox="0 0 54 54" className="shrink-0">
      <circle cx="27" cy="27" r={r} fill="none" stroke="currentColor" className="text-slate-800" strokeWidth="7" />
      {/* C/I/S draw order, matching Result.tsx's DonutChart */}
      {entry.correctCount > 0 && (
        <circle
          cx="27" cy="27" r={r} fill="none" stroke="#22c55e" strokeWidth="7"
          strokeDasharray={`${correctLen} ${circumference}`}
          strokeDashoffset="0"
          transform="rotate(-90 27 27)"
        />
      )}
      {entry.incorrectCount > 0 && (
        <circle
          cx="27" cy="27" r={r} fill="none" stroke="#ef4444" strokeWidth="7"
          strokeDasharray={`${incorrectLen} ${circumference}`}
          strokeDashoffset={-correctLen}
          transform="rotate(-90 27 27)"
        />
      )}
      {entry.skippedCount > 0 && (
        <circle
          cx="27" cy="27" r={r} fill="none" stroke="rgb(var(--slate-600))" strokeWidth="7"
          strokeDasharray={`${skippedLen} ${circumference}`}
          strokeDashoffset={-(correctLen + incorrectLen)}
          transform="rotate(-90 27 27)"
        />
      )}
      <text x="27" y="31" textAnchor="middle" fontSize="13" fontWeight="500" fill="currentColor" className="text-slate-100">
        {pct}%
      </text>
    </svg>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true, // force 12hr AM/PM regardless of device locale (was defaulting to the OS locale, 24hr on some Android builds)
  });
}

// Exam mode only — Guide mode has no resume time limit (see resumableId).
function formatTimeLeft(startedAt: string, now: number): string {
  const elapsed = now - new Date(startedAt).getTime();
  const remainingMs = Math.max(0, RESUME_WINDOW_MS - elapsed);
  const totalSeconds = Math.floor(remainingMs / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s left`;
  if (m > 0) return `${m}m ${s}s left`;
  return `${s}s left`;
}

export default function SolvedModules() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<CustomModuleHistoryEntry[] | null>(null);
  const [opening, setOpening] = useState<string | null>(null); // entry id currently loading questions for view
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    getCustomModuleHistory().then(async (rows) => {
      // The newest entry may have aged out of its resume window without
      // ever being reopened (so Quiz.tsx's own expiry auto-submit never got
      // a chance to run) — close it out here too, using its draft's last
      // checkpoint, so it doesn't sit frozen at 0% forever. Only the newest
      // row can ever have a matching draft (see moduleDraft.ts — single slot).
      const [latest] = rows;
      if (latest && latest.finishedAt === null) {
        const expired = latest.mode === "quiz"
          && Date.now() - new Date(latest.startedAt).getTime() >= RESUME_WINDOW_MS;
        if (expired) {
          const draft = readModuleDraft(latest.id);
          if (draft) {
            try {
              const closed: CustomModuleHistoryEntry = {
                ...latest,
                finishedAt: new Date().toISOString(),
                answers: draft.answers,
                reviewedQids: draft.reviewedQids ?? latest.reviewedQids,
                guessedQids: draft.guessedQids ?? latest.guessedQids,
                correctCount: draft.correctCount ?? latest.correctCount,
                incorrectCount: draft.incorrectCount ?? latest.incorrectCount,
                skippedCount: draft.skippedCount ?? latest.skippedCount,
              };
              await saveCustomModuleHistory(closed);
              rows = [closed, ...rows.slice(1)];
            } catch (err) {
              console.error("Could not close out the expired module", err);
            }
          }
        }
      }
      setEntries(rows);
    });
  }, []);

  // Tick every second while there's a live Exam-mode countdown to show —
  // keeps the resume window actually counting down instead of a static
  // number that only changes on page refresh, and lets resumability itself
  // flip off the moment the window expires without needing a reload.
  useEffect(() => {
    if (!entries || entries.length === 0) return;
    const [latest] = entries;
    if (latest.finishedAt !== null || latest.mode !== "quiz") return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [entries]);

  // Only the single most-recent entry can ever be resumable, and only while
  // unfinished. The 2hr window is Exam mode only — Guide mode has no resume
  // time limit.
  const resumableId = useMemo(() => {
    if (!entries || entries.length === 0) return null;
    const [latest] = entries; // getCustomModuleHistory returns newest-first
    if (latest.finishedAt !== null) return null;
    const withinWindow = latest.mode === "quiz"
      ? now - new Date(latest.startedAt).getTime() < RESUME_WINDOW_MS
      : true;
    return withinWindow ? latest.id : null;
  }, [entries, now]);

  const openEntry = async (entry: CustomModuleHistoryEntry) => {
    if (entry.id === resumableId) {
      const params = new URLSearchParams();
      params.set("source", "custom");
      params.set("mode", entry.mode);
      params.set("ids", entry.questionIds.join(","));
      params.set("moduleId", entry.id);
      navigate(`/quiz/${entry.exam}/custom?${params.toString()}`);
      return;
    }
    // Completed/expired: Result needs full question objects, not just IDs.
    if (opening) return;
    setOpening(entry.id);
    try {
      const resolved = await Promise.all(entry.questionIds.map((qid) => findQuestion(qid)));
      const questions = resolved.filter((q): q is PYQQuestion => Boolean(q));
      const answers: QuizAnswer[] = questions.map((q, i) => {
        const selected = entry.answers[i];
        return { qid: q.id, selected, correct: selected !== null && selected === q.answer };
      });
      navigate(`/result/${entry.exam}`, {
        state: {
          total: questions.length,
          answers,
          questions,
          custom: true,
          // Carry the entry's Reviewed/Guessing tags through so "See
          // Explanations" shows the same R dot / guessing-icon overlay on
          // the question grid that a freshly-finished module gets.
          reviewedQids: entry.reviewedQids,
          guessedQids: entry.guessedQids,
        },
      });
    } finally {
      setOpening(null);
    }
  };

  if (entries === null) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <p className="text-sm text-slate-500">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Custom Modules</h1>
        <p className="mt-1 text-sm text-slate-500">Your last {entries.length} attempted modules.</p>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-8 text-center">
          <LayoutGrid className="mx-auto text-slate-600" size={30} />
          <h3 className="mt-3 font-semibold text-slate-200">No modules yet</h3>
          <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">
            Build a custom module to see your attempt history here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => {
            const isResumable = entry.id === resumableId;
            return (
              <div
                key={entry.id}
                className={`rounded-2xl border p-4 ${
                  isResumable ? "border-sky-700 bg-sky-950/20" : "border-slate-800 bg-slate-900/60"
                }`}
              >
                {isResumable ? (
                  <>
                    <span className="mb-2 inline-block rounded-md bg-sky-900/60 px-2.5 py-1 text-xs font-semibold text-sky-300">
                      Resume available
                    </span>
                    <p className="text-sm font-semibold text-slate-100">{entry.subjectLabel}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{formatDateTime(entry.startedAt)}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {entry.questionIds.length} questions
                      {entry.mode === "quiz" && (
                        <>
                          {" "}&middot; <span className="font-semibold text-red-400">{formatTimeLeft(entry.startedAt, now)}</span>
                        </>
                      )}
                    </p>
                    <button
                      type="button"
                      onClick={() => openEntry(entry)}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-500"
                    >
                      <Play size={15} /> Resume module
                    </button>
                  </>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-100">{entry.subjectLabel}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{formatDateTime(entry.startedAt)}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{entry.questionIds.length} questions</p>
                      <button
                        type="button"
                        onClick={() => openEntry(entry)}
                        disabled={opening === entry.id}
                        className="mt-3 w-full rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {opening === entry.id ? "Loading…" : "View solved module"}
                      </button>
                    </div>
                    <ScoreDonut entry={entry} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {entries.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-4 border-t border-slate-800 pt-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#639922]" /> Correct
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#E24B4A]" /> Incorrect
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#7F77DD]" /> Skipped
          </span>
        </div>
      )}
    </main>
  );
}
