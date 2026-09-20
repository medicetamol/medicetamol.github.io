import { ArrowLeft, Minus, Plus } from "lucide-react";
import { useNavigate, useParams } from 'react-router-dom';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SUBJECTS } from "../constants";
import { loadQuestions } from "../data/questions";
import { getAllAnswers, getAllBookmarks } from "../lib/db";
import type { QuestionAnswer } from "../types";
import type { Exam, PYQQuestion, StatusFilter } from "../types";
import { loadModuleBuilderState } from "../lib/moduleBuilderState";
import FilterBar from "../components/FilterBar";
import ModuleFooterBar from "../components/ModuleFooterBar";

// ─── Typewriter caption ──────────────────────────────────────────────────────

const CAPTIONS = [
  "Crafting QBank only for you…",
  "Collecting questions from stars, at speed of light…",
  "Just wait a few moments…",
  "We are still on it…",
  "Please wait a little more…",
];

function useTypewriterCaption(active: boolean): string {
  const [text, setText] = useState("");
  const textRef = useRef("");
  const orderRef = useRef<number[]>([]);

  useEffect(() => {
    if (!active) return;

    // Shuffle order once, cycle through it, reshuffle when exhausted
    const nextOrder = () => {
      if (orderRef.current.length === 0) {
        const order = CAPTIONS.map((_, i) => i);
        for (let i = order.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [order[i], order[j]] = [order[j], order[i]];
        }
        orderRef.current = order;
      }
      return orderRef.current.shift()!;
    };

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const setTextSafe = (value: string) => {
      textRef.current = value;
      setText(value);
    };

    const typeCaption = (caption: string, onDone: () => void) => {
      let i = 0;
      const tick = () => {
        if (cancelled) return;
        i++;
        setTextSafe(caption.slice(0, i));
        if (i < caption.length) {
          timeoutId = setTimeout(tick, 35);
        } else {
          timeoutId = setTimeout(onDone, 1100);
        }
      };
      tick();
    };

    const eraseCaption = (onDone: () => void) => {
      const erase = () => {
        if (cancelled) return;
        const next = textRef.current.slice(0, -1);
        setTextSafe(next);
        if (next.length > 0) {
          timeoutId = setTimeout(erase, 18);
        } else {
          timeoutId = setTimeout(onDone, 150);
        }
      };
      erase();
    };

    const cycle = () => {
      if (cancelled) return;
      const caption = CAPTIONS[nextOrder()];
      typeCaption(caption, () => {
        if (cancelled) return;
        eraseCaption(cycle);
      });
    };

    cycle();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [active]);

  return text;
}

// ─── Mode toggle ─────────────────────────────────────────────────────────────

function ModeToggle({
  mode,
  onChange,
  showError,
}: {
  mode: "quiz" | "guide" | null;
  onChange: (mode: "quiz" | "guide") => void;
  showError: boolean;
}) {
  return (
    <div>
      <div
        className={`flex overflow-hidden rounded-xl border bg-slate-950 transition ${
          showError ? "border-red-500 animate-pulse" : "border-slate-800"
        }`}
      >
        {(["guide", "quiz"] as const).map((m) => {
          const active = mode === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => onChange(m)}
              className={`flex-1 py-3 text-sm font-semibold transition ${
                active ? "bg-slate-800 text-slate-100" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {m === "guide" ? "Guide Mode" : "Exam Mode"}
            </button>
          );
        })}
      </div>
      {showError && (
        <p className="mt-2 text-center text-xs font-medium text-red-400">Select a mode first</p>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ModuleBuilderCraft() {
  const { exam } = useParams();
  const navigate = useNavigate();
  const examId = exam as Exam;

  const builderState = useMemo(() => loadModuleBuilderState(examId), [examId]);
  const selectedSubjects = builderState.subjects;

  // Redirect back if nothing was selected (e.g. direct nav / refresh with empty state)
  useEffect(() => {
    if (selectedSubjects.length === 0) {
      navigate(`/module/${examId}`, { replace: true });
    }
  }, [selectedSubjects.length, examId, navigate]);

  // ── Background fetch of all selected subjects' questions ──
  const [questionsBySubject, setQuestionsBySubject] = useState<Record<string, PYQQuestion[]>>({});
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (selectedSubjects.length === 0) return;
    let cancelled = false;
    setDataLoading(true);

    Promise.all(
      selectedSubjects.map(async (subjectId) => {
        const qs = await loadQuestions(examId, subjectId);
        return [subjectId, qs] as const;
      })
    ).then((results) => {
      if (cancelled) return;
      setQuestionsBySubject(Object.fromEntries(results));
      setDataLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [examId, selectedSubjects.join(",")]);

  // ── Progress data (separate, fast source — loads independently of JSON fetch) ──
  const [answers, setAnswers] = useState<Record<string, QuestionAnswer>>({});
  const [bookmarkedQids, setBookmarkedQids] = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.all([getAllAnswers(), getAllBookmarks()]).then(([a, b]) => {
      setAnswers(Object.fromEntries(a.map((x) => [x.qid, x])));
      setBookmarkedQids(new Set(b.map((x) => x.qid)));
    });
  }, []);

  // ── User choices (all available immediately, independent of fetch) ──
  const [statuses, setStatuses] = useState<StatusFilter[]>(["all"]);
  const [mode, setMode] = useState<"quiz" | "guide" | null>("quiz"); // Exam Mode preselected
  const [modeError, setModeError] = useState(false);
  const [questionCount, setQuestionCount] = useState(20);
  const [creating, setCreating] = useState(false);

  const caption = useTypewriterCaption(dataLoading);

  // ── Matching questions (topic filter from Step 1b state, status filter from here) ──
  const allLoaded = useMemo(
    () => Object.values(questionsBySubject).flat(),
    [questionsBySubject]
  );

  const matching = useMemo(() => {
    return allLoaded.filter((q) => {
      const topicsForSubject = builderState.topicsBySubject[q.subjectId] ?? ["all"];
      if (!topicsForSubject.includes("all") && !topicsForSubject.includes(q.topicId)) return false;

      if (statuses.includes("all")) return true;
      const a = answers[q.id];
      return statuses.some((status) => {
        if (status === "incorrect") return a?.incorrect !== undefined;
        if (status === "correct") return a !== undefined && a.incorrect === undefined;
        if (status === "bookmark") return bookmarkedQids.has(q.id);
        return true;
      });
    });
  }, [allLoaded, builderState.topicsBySubject, statuses, answers, bookmarkedQids]);

  const matchingCount = matching.length;

  const subjectSummary = useMemo(() => {
    const names = selectedSubjects
      .map((id) => SUBJECTS.find((s) => s.id === id)?.name)
      .filter((n): n is string => Boolean(n));
    if (names.length === 0) return "";
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    if (names.length <= 4) return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
    return `${names.slice(0, 3).join(", ")}, and ${names.length - 3} more`;
  }, [selectedSubjects]);

  const handleCreate = () => {
    if (!mode) {
      setModeError(true);
      window.setTimeout(() => setModeError(false), 1600);
      return;
    }
    if (dataLoading || matchingCount === 0 || creating) return;
    setCreating(true);

    const unique = Array.from(new Map(matching.map((q) => [q.id, q])).values());
    const shuffled = [...unique].sort(() => Math.random() - 0.5).slice(0, questionCount);

    if (shuffled.length) {
      const params = new URLSearchParams();
      params.set("source", "custom");
      params.set("mode", mode);
      params.set("ids", shuffled.map((q) => q.id).join(","));
      navigate(`/module/${examId}/solve?${params.toString()}`);
    }
    setCreating(false);
  };

  return (
    <main className="mx-auto max-w-3xl px-4 pb-28 pt-8 sm:px-6">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-6 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-200"
      >
        <ArrowLeft size={16} /> BACK
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold">Crafting Module</h1>
        {subjectSummary && (
          <p className="mt-1 text-sm text-slate-500">From {subjectSummary}.</p>
        )}
      </div>

      {/* Loading caption */}
      {dataLoading && (
        <div className="mb-6 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3.5 text-center text-sm text-slate-400">
          <span>{caption}</span>
          <span className="ml-0.5 inline-block w-px animate-pulse bg-slate-500 align-middle" style={{ height: "1em" }} />
        </div>
      )}

      {/* Choices — available immediately, independent of fetch */}
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-xs text-slate-500">Status</p>
          <FilterBar value={statuses} onChange={setStatuses} />
        </div>

        <div>
          <p className="mb-2 text-xs text-slate-500">Mode</p>
          <ModeToggle mode={mode} onChange={(m) => { setMode(m); setModeError(false); }} showError={modeError} />
        </div>
      </div>

      {/* Bottom bar */}
      <ModuleFooterBar>
        <div className="flex h-11 min-w-[130px] items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3">
          <button
            type="button"
            onClick={() => setQuestionCount((n) => Math.max(10, n - 10))}
            disabled={questionCount <= 10}
            aria-label="Decrease question count"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Minus size={16} />
          </button>
          <span className="text-sm font-bold text-slate-100">{questionCount}</span>
          <button
            type="button"
            onClick={() => setQuestionCount((n) => Math.min(180, n + 10))}
            disabled={questionCount >= 180}
            aria-label="Increase question count"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Plus size={16} />
          </button>
        </div>

        <button
          type="button"
          disabled={dataLoading || matchingCount === 0 || creating}
          onClick={handleCreate}
          className="py-3 flex-1 rounded-xl bg-slate-100 px-5 text-xs font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {dataLoading
            ? "LOADING…"
            : matchingCount === 0
              ? "NO QUESTIONS AVAILABLE"
              : "CREATE MODULE"}
        </button>
      </ModuleFooterBar>
    </main>
  );
}
