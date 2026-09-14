import { ArrowLeft, Check } from "lucide-react";
import { Link, useParams } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import { getSubject } from "../constants";
import type { Exam } from "../types";
import manifest from "../data/manifest.json";
import {
  loadModuleBuilderState,
  saveModuleBuilderState,
  type ModuleBuilderState,
} from "../lib/moduleBuilderState";

type SubjectManifest = { total: number; topics: Record<string, number> };
type Manifest = Record<string, Record<string, SubjectManifest>>;
const counts = manifest as Manifest;

export default function ModuleBuilderTopics() {
  const { exam, subjectId } = useParams();
  const examId = exam as Exam;
  const subject = getSubject(subjectId ?? "");

  const [state, setState] = useState<ModuleBuilderState>(() => loadModuleBuilderState(examId));

  useEffect(() => {
    setState(loadModuleBuilderState(examId));
  }, [examId]);

  if (!subject || !subjectId) return null;

  const manifestTopics = counts[examId]?.[subjectId]?.topics ?? {};
  const topicItems = subject.topics
    .filter((t) => (manifestTopics[t.id] ?? 0) > 0)
    .map((t) => ({ id: t.id, name: t.name }));

  const selectedTopics = state.topicsBySubject[subjectId] ?? ["all"];
  const isAll = selectedTopics.includes("all") || selectedTopics.length === 0;

  const persistTopics = (topics: string[]) => {
    const next: ModuleBuilderState = {
      ...state,
      topicsBySubject: { ...state.topicsBySubject, [subjectId]: topics },
    };
    setState(next);
    saveModuleBuilderState(examId, next);
  };

  const toggleAll = () => {
    persistTopics(["all"]);
  };

  const toggleTopic = (id: string) => {
    const current = isAll ? [] : selectedTopics;
    const active = current.includes(id);
    if (active) {
      const without = current.filter((x) => x !== id);
      persistTopics(without.length ? without : ["all"]);
    } else {
      persistTopics([...current, id]);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link
        to={`/module/${examId}`}
        className="mb-6 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-200"
      >
        <ArrowLeft size={16} /> Back to Selecting Subjects
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold">{subject.name}</h1>
        <p className="mt-1 text-sm text-slate-500">Choose topics, or leave all selected.</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800">
        <button
          type="button"
          onClick={toggleAll}
          className={`flex w-full items-center gap-3 border-b border-slate-800 px-4 py-3.5 text-left transition ${
            isAll ? "bg-slate-800" : "hover:bg-slate-900"
          }`}
        >
          <span
            className={`grid h-5 w-5 shrink-0 place-items-center rounded border ${
              isAll ? "border-slate-300 bg-slate-100 text-slate-950" : "border-slate-600"
            }`}
          >
            {isAll && <Check size={14} strokeWidth={3} />}
          </span>
          <span className="flex-1 text-sm font-semibold text-slate-100">All topics</span>
        </button>

        {topicItems.map((topic) => {
          const active = !isAll && selectedTopics.includes(topic.id);
          return (
            <button
              key={topic.id}
              type="button"
              onClick={() => toggleTopic(topic.id)}
              className={`flex w-full items-center gap-3 border-b border-slate-800 px-4 py-3.5 text-left last:border-b-0 transition ${
                active ? "bg-slate-800/60" : "hover:bg-slate-900"
              }`}
            >
              <span
                className={`grid h-5 w-5 shrink-0 place-items-center rounded border ${
                  active ? "border-slate-300 bg-slate-100 text-slate-950" : "border-slate-600"
                }`}
              >
                {active && <Check size={14} strokeWidth={3} />}
              </span>
              <span className="flex-1 text-sm text-slate-200">{topic.name}</span>
            </button>
          );
        })}
      </div>
    </main>
  );
}
