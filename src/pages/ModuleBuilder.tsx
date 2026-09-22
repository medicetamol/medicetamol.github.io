import { ArrowLeft, Check, ChevronRight, History } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { EXAMS, SUBJECTS } from "../constants";
import { prefetchQuestions } from "../data/questions";
import type { Exam } from "../types";
import {
  loadModuleBuilderState,
  saveModuleBuilderState,
  type ModuleBuilderState,
} from "../lib/moduleBuilderState";
import ModuleFooterBar from "../components/ModuleFooterBar";

export default function ModuleBuilder() {
  const { exam } = useParams();
  const navigate = useNavigate();
  const examId = exam as Exam;

  const [state, setState] = useState<ModuleBuilderState>(() => loadModuleBuilderState(examId));

  useEffect(() => {
    setState(loadModuleBuilderState(examId));
  }, [examId]);

  const persist = (next: ModuleBuilderState) => {
    setState(next);
    saveModuleBuilderState(examId, next);
  };

  const allSelected = state.subjects.length === SUBJECTS.length;

  const toggleAll = () => {
    if (allSelected) {
      persist({ subjects: [], topicsBySubject: {} });
    } else {
      persist({ ...state, subjects: SUBJECTS.map((s) => s.id) });
      for (const s of SUBJECTS) prefetchQuestions(examId, s.id);
    }
  };

  const toggleSubject = (id: string) => {
    const active = state.subjects.includes(id);
    if (active) {
      persist({ ...state, subjects: state.subjects.filter((x) => x !== id) });
    } else {
      persist({ ...state, subjects: [...state.subjects, id] });
      prefetchQuestions(examId, id);
    }
  };

  const openTopics = (id: string) => {
    if (!state.subjects.includes(id)) {
      persist({ ...state, subjects: [...state.subjects, id] });
      prefetchQuestions(examId, id);
    }
    navigate(`/module/${examId}/topics/${id}`);
  };

  const total = SUBJECTS.length;

  return (
    <main className="mx-auto max-w-3xl px-4 pb-28 pt-8 sm:px-6">
      <Link
        to={`/pyqs/${exam}`}
        className="mb-6 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-200"
      >
        <ArrowLeft size={16} /> {EXAMS.find((e) => e.id === examId)?.name}
      </Link>

      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Create Module</h1>
          <p className="mt-1 text-sm text-slate-500">Choose subjects, then optionally pick topics.</p>
        </div>
        <Link
          to="/modules/history"
          className="mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-800 px-3 py-2 text-xs font-semibold text-slate-400 hover:border-slate-600 hover:text-slate-200"
        >
          <History size={14} /> History
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800">
        {/* All Subjects row */}
        <button
          type="button"
          onClick={toggleAll}
          className={`flex w-full items-center gap-3 border-b border-slate-800 px-4 py-3.5 text-left transition ${
            allSelected ? "bg-slate-800" : "hover:bg-slate-900"
          }`}
        >
          <span
            className={`grid h-5 w-5 shrink-0 place-items-center rounded border ${
              allSelected ? "border-slate-300 bg-slate-100 text-slate-950" : "border-slate-600"
            }`}
          >
            {allSelected && <Check size={14} strokeWidth={3} />}
          </span>
          <span className="flex-1 text-sm font-semibold text-slate-100">All Subjects</span>
        </button>

        {SUBJECTS.map((subject) => {
          const active = state.subjects.includes(subject.id);
          return (
            <div
              key={subject.id}
              className={`flex w-full items-center border-b border-slate-800 last:border-b-0 transition ${
                active ? "bg-slate-800/60" : "hover:bg-slate-900"
              }`}
            >
              <button
                type="button"
                onClick={() => toggleSubject(subject.id)}
                className="flex flex-1 items-center gap-3 px-4 py-3.5 text-left"
              >
                <span
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded border ${
                    active ? "border-slate-300 bg-slate-100 text-slate-950" : "border-slate-600"
                  }`}
                >
                  {active && <Check size={14} strokeWidth={3} />}
                </span>
                <span className="flex-1 min-w-0 text-sm text-slate-200">{subject.name}</span>
              </button>
              <button
                type="button"
                onClick={() => openTopics(subject.id)}
                aria-label={`Select topics for ${subject.name}`}
                className="shrink-0 px-4 py-3.5 text-slate-500 hover:text-slate-200"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Bottom bar */}
      <ModuleFooterBar>
        <span className="flex-1 text-xs text-slate-500">
          {state.subjects.length === 0
            ? "No subjects selected"
            : allSelected
              ? `All ${total} subjects selected`
              : `${state.subjects.length} subject${state.subjects.length > 1 ? "s" : ""} selected`}
        </span>
        <button
          type="button"
          disabled={state.subjects.length === 0}
          onClick={() => navigate(`/module/${examId}/craft`)}
          className="rounded-xl bg-slate-100 px-5 py-3 text-xs font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
        >
          CONTINUE
        </button>
      </ModuleFooterBar>
    </main>
  );
}