import { ArrowLeft, Check, ChevronDown } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { EXAMS, SUBJECTS } from "../constants";
import { getAllQuestions } from "../data/questions";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Exam, PYQQuestion, StatusFilter } from "../types";
import { getAllQuestionProgress } from "../lib/db";
import FilterBar from "../components/FilterBar";

// ─── Sub-components ──────────────────────────────────────────────────────────

function MultiSelect({
  label,
  summary,
  open,
  onToggle,
  children,
}: {
  label: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-slate-500">{label}</span>
          <span className="mt-2 block truncate text-sm text-slate-100">{summary}</span>
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-slate-500 transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="border-t border-slate-800">{children}</div>}
    </div>
  );
}

function SelectionList({
  items,
  selected,
  onToggle,
}: {
  items: Array<{ id: string; name: string }>;
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="max-h-80 overflow-y-auto">
      {items.map((item) => {
        const active = selected.includes(item.id);
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onToggle(item.id)}
            className="flex w-full items-center gap-3 border-b border-slate-800 px-4 py-3.5 text-left last:border-b-0 hover:bg-slate-900"
          >
            <span
              className={`grid h-5 w-5 shrink-0 place-items-center rounded border ${
                active
                  ? "border-slate-300 bg-slate-100 text-slate-950"
                  : "border-slate-600"
              }`}
            >
              {active && <Check size={14} strokeWidth={3} />}
            </span>
            <span className="flex-1 text-sm text-slate-200">{item.name}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Mode toggle ─────────────────────────────────────────────────────────────

function ModeToggle({
  mode,
  onChange,
}: {
  mode: "quiz" | "guide";
  onChange: (mode: "quiz" | "guide") => void;
}) {
  return (
    <div className="flex overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
      {(["guide", "quiz"] as const).map((m) => {
        const active = mode === m;
        return (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            className={`flex-1 py-3 text-sm font-semibold transition ${
              active
                ? "bg-slate-800 text-slate-100"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {m === "guide" ? "Guide Mode" : "Exam Mode"}
          </button>
        );
      })}
    </div>
  );
}

// ─── Begin modal ─────────────────────────────────────────────────────────────

function BeginModal({
  questionCount,
  mode,
  onProceed,
  onBack,
}: {
  questionCount: number;
  mode: "quiz" | "guide";
  onProceed: () => void;
  onBack: () => void;
}) {
  const totalMinutes = questionCount; // 1 min per question
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <h2 className="text-center text-lg font-semibold text-slate-100">
          Let's begin the Module
        </h2>
        <p className="mt-1 text-center text-xs text-slate-500">
          Crafting a module for you with {questionCount} question
          {questionCount === 1 ? "" : "s"}
        </p>
        {mode === "quiz" && (
          <p className="mt-1 text-center text-xs text-slate-400">
            Total Duration: {totalMinutes} minute{totalMinutes === 1 ? "" : "s"}
          </p>
        )}

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-100"
          >
            Go Back
          </button>
          <button
            type="button"
            onClick={onProceed}
            className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-bold text-slate-950"
          >
            Let's Proceed
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ModuleBuilder() {
  const { exam } = useParams();
  const navigate = useNavigate();
  const examId = exam as Exam;
  const [all, setAll] = useState<PYQQuestion[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setDataLoading(true);
    getAllQuestions(examId).then((result) => {
      if (cancelled) return;
      setAll(result);
      setDataLoading(false);
    });
    return () => { cancelled = true; };
  }, [examId]);

  const [subjects, setSubjects] = useState<string[]>(["all"]);
  const [topics, setTopics] = useState<string[]>(["all"]);
  const [statuses, setStatuses] = useState<StatusFilter[]>(["all"]);
  const [questionCount, setQuestionCount] = useState(20);
  const [moduleMode, setModuleMode] = useState<"quiz" | "guide">("guide");
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [topicOpen, setTopicOpen] = useState(false);
  const [showBeginModal, setShowBeginModal] = useState(false);
  const [progress, setProgress] = useState<
    Record<string, Awaited<ReturnType<typeof getAllQuestionProgress>>[number]>
  >({});

  useEffect(() => {
    getAllQuestionProgress().then((items) => {
      setProgress(Object.fromEntries(items.map((x) => [x.qid, x])));
    });
  }, []);

  const selectedSubjectSet = useMemo(() => new Set(subjects), [subjects]);
  const selectedTopicSet = useMemo(() => new Set(topics), [topics]);

  const topicItems = useMemo(() => {
    const source = subjects.includes("all")
      ? all
      : all.filter((q) => selectedSubjectSet.has(q.subjectId));
    return Array.from(
      new Map(
        source.map((q) => [q.topicId, q.topicName ?? q.topicId])
      ).entries()
    )
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({ id, name }));
  }, [all, subjects, selectedSubjectSet]);

  const matchingCount = useMemo(() => {
    return all.filter((q) => {
      if (!subjects.includes("all") && !selectedSubjectSet.has(q.subjectId)) return false;
      if (!topics.includes("all") && !selectedTopicSet.has(q.topicId)) return false;
      if (statuses.includes("all")) return true;
      const p = progress[q.id];
      return statuses.some((status) => {
        if (status === "incorrect") return Boolean(p?.firstIncorrect || p?.directIncorrect);
        if (status === "correct") return Boolean(p?.directCorrect);
        if (status === "bookmark") return Boolean(p?.bookmarked);
        return true;
      });
    }).length;
  }, [all, subjects, topics, statuses, progress, selectedSubjectSet, selectedTopicSet]);

  const toggleSubjects = (id: string) => {
    if (id === "all") {
      setSubjects(["all"]);
      setTopics(["all"]);
      return;
    }
    const next = subjects.filter((x) => x !== "all");
    if (next.includes(id)) {
      const without = next.filter((x) => x !== id);
      setSubjects(without.length ? without : ["all"]);
    } else {
      setSubjects([...next, id]);
    }
    setTopics(["all"]);
  };

  const toggleTopics = (id: string) => {
    if (id === "all") { setTopics(["all"]); return; }
    const next = topics.filter((x) => x !== "all");
    if (next.includes(id)) {
      const without = next.filter((x) => x !== id);
      setTopics(without.length ? without : ["all"]);
    } else {
      setTopics([...next, id]);
    }
  };

  const buildQuestionList = () => {
    const filtered = all.filter((q) => {
      if (!subjects.includes("all") && !selectedSubjectSet.has(q.subjectId)) return false;
      if (!topics.includes("all") && !selectedTopicSet.has(q.topicId)) return false;
      if (statuses.includes("all")) return true;
      const p = progress[q.id];
      return statuses.some((status) => {
        if (status === "incorrect") return Boolean(p?.firstIncorrect || p?.directIncorrect);
        if (status === "correct") return Boolean(p?.directCorrect);
        if (status === "bookmark") return Boolean(p?.bookmarked);
        return true;
      });
    });

    const unique = Array.from(new Map(filtered.map((q) => [q.id, q])).values());
    return [...unique].sort(() => Math.random() - 0.5).slice(0, questionCount);
  };

  const handleCreateClick = () => {
    if (matchingCount === 0) return;
    setShowBeginModal(true);
  };

  const handleProceed = () => {
    setShowBeginModal(false);
    const shuffled = buildQuestionList();
    if (!shuffled.length) return;

    // Request fullscreen before navigating — requires the user gesture from this click
    const el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {
        // Fullscreen may be denied on some browsers; proceed anyway
      });
    }

    const params = new URLSearchParams();
    params.set("source", "custom");
    params.set("mode", moduleMode);
    params.set("ids", shuffled.map((q) => q.id).join(","));
    navigate(`/quiz/${examId}/custom?${params.toString()}`);
  };

  const actualCount = Math.min(matchingCount, questionCount);

  const subjectSummary = subjects.includes("all")
    ? "All subjects"
    : `${subjects.length} subject${subjects.length > 1 ? "s" : ""} selected`;
  const topicSummary = topics.includes("all")
    ? "All topics"
    : `${topics.length} topic${topics.length > 1 ? "s" : ""} selected`;

  return (
    <main className="mx-auto max-w-3xl px-4 pb-36 pt-8 sm:px-6">
      <Link
        to={`/pyqs/${exam}`}
        className="mb-6 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-200"
      >
        <ArrowLeft size={16} /> {EXAMS.find((e) => e.id === examId)?.name}
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold">Create Module</h1>
        <p className="mt-1 text-sm text-slate-500">
          Choose subjects, topics, status and question count.
        </p>
      </div>

      {/* Filters */}
      <div className="space-y-3 overflow-y-auto pb-2">
        <MultiSelect
          label="Subject"
          summary={subjectSummary}
          open={subjectOpen}
          onToggle={() => setSubjectOpen((v) => !v)}
        >
          <SelectionList
            items={[
              { id: "all", name: "All subjects" },
              ...SUBJECTS.map((s) => ({ id: s.id, name: s.name })),
            ]}
            selected={subjects}
            onToggle={toggleSubjects}
          />
        </MultiSelect>

        <MultiSelect
          label="Topic"
          summary={topicSummary}
          open={topicOpen}
          onToggle={() => setTopicOpen((v) => !v)}
        >
          <SelectionList
            items={[{ id: "all", name: "All topics" }, ...topicItems]}
            selected={topics}
            onToggle={toggleTopics}
          />
        </MultiSelect>

        <FilterBar value={statuses} onChange={setStatuses} />
      </div>

      {/* Mode toggle — normal document flow, same z-level as filters */}
      <div className="mt-4">
        <ModeToggle mode={moduleMode} onChange={setModuleMode} />
      </div>

      {/* Bottom bar — fixed to bottom of viewport with 10px margin */}
      <div className="fixed inset-x-0 bottom-[10px] z-30 px-4 sm:px-6">
        <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-[#10161e]/95 p-3 shadow-soft backdrop-blur">
          <label className="w-1/4 min-w-[78px] rounded-xl border border-slate-700 bg-slate-900 px-3 py-2">
            <span className="block text-[10px] text-slate-500">Questions</span>
            <select
              value={questionCount}
              onChange={(e) => setQuestionCount(Number(e.target.value))}
              className="mt-0.5 w-full bg-transparent text-sm font-semibold text-slate-100 outline-none"
              aria-label="Number of questions"
            >
              {[10, 20, 30, 40, 50, 60, 80, 100].map((n) => (
                <option key={n} value={n} className="bg-slate-900">
                  {n}
                </option>
              ))}
            </select>
          </label>

          <span className="flex-1 text-center text-xs text-slate-500">
            {dataLoading
              ? "Loading questions…"
              : matchingCount === 0
                ? "No questions available"
                : `${actualCount} question${actualCount === 1 ? "" : "s"}`}
          </span>

          <button
            type="button"
            disabled={dataLoading || matchingCount === 0}
            onClick={handleCreateClick}
            className="rounded-xl bg-slate-100 px-5 py-3 text-xs font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
          >
            CREATE MODULE
          </button>
        </div>
        </div>
      </div>

      {/* Begin modal */}
      {showBeginModal && (
        <BeginModal
          questionCount={actualCount}
          mode={moduleMode}
          onProceed={handleProceed}
          onBack={() => setShowBeginModal(false)}
        />
      )}
    </main>
  );
}
