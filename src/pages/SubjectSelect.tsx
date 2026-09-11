import { ArrowLeft, Sparkles } from "lucide-react";
import { Link, useParams } from 'react-router-dom';
import { SUBJECTS, EXAMS, EXAM_PREFIX } from "../constants";
import manifest from "../data/manifest.json";
import React, { useEffect, useState } from 'react';
import { getAllQuestionProgress } from "../lib/db";

type Manifest = Record<string, Record<string, number>>;
const counts = manifest as Manifest;

export default function SubjectSelect() {
  const { exam } = useParams<{ exam: "NEET-PG" | "INI-CET" | "FMGE" }>();
  const examId = exam && EXAMS.some((x) => x.id === exam) ? exam : "NEET-PG";
  const currentExam = EXAMS.find((x) => x.id === examId);

  const [progressMap, setProgressMap] = useState<Map<string, { attempts: number }>>(new Map());

  useEffect(() => {
    getAllQuestionProgress().then((items) => {
      setProgressMap(new Map(items.map((p) => [p.qid, p])));
    });
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Link to="/pyqs" className="mb-6 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-200">
        <ArrowLeft size={16} /> Exams
      </Link>

      <div className="mb-7">
        <h1 className="text-2xl font-bold">{currentExam?.name ?? "PYQs"}</h1>
        <p className="mt-1 text-sm text-slate-500">Choose a subject.</p>
      </div>

      {/* Create custom module — full-width banner */}
      <Link
        to={`/module/${examId}`}
        className="mb-4 flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900/60 px-5 py-4 hover:border-slate-500 hover:bg-slate-800/60"
      >
        <Sparkles size={17} className="shrink-0 text-slate-400" />
        <span className="text-sm font-semibold text-slate-200">Create custom module</span>
      </Link>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {SUBJECTS.map((subject) => {
          const total = counts[examId]?.[subject.id] ?? 0;
          const prefix = `${EXAM_PREFIX[examId]}${subject.code}`;
          let attempted = 0;
          for (const [qid, p] of progressMap) {
            if (qid.startsWith(prefix) && p.attempts > 0) attempted++;
          }
          const pct = total > 0 ? Math.round((attempted / total) * 100) : 0;

          // Donut ring color: linear RGB interpolation
          // 0%   → rgb(55, 65, 81)
          // 100% → rgb(148, 163, 184)
          const donutColor = `rgb(${Math.round(55 + 93 * (pct / 100))}, ${Math.round(
            65 + 98 * (pct / 100)
          )}, ${Math.round(81 + 103 * (pct / 100))})`;

          const RADIUS = 15;
          const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
          const dash = (pct / 100) * CIRCUMFERENCE;
          const gap = CIRCUMFERENCE - dash;
          const showDonut = total > 0 && attempted > 0;

          return (
            <Link
              key={subject.id}
              to={`/pyqs/${examId}/${subject.id}`}
              className="group relative flex min-h-[100px] flex-col justify-between overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 p-3.5 pl-4 hover:border-slate-600"
            >
              {showDonut && (
                <div className="absolute right-[5px] top-[5px] h-[42px] w-[42px]">
                  <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90">
                    <circle cx="21" cy="21" r={RADIUS} fill="none" stroke="#1e293b" strokeWidth="4.5" />
                    <circle
                      cx="21"
                      cy="21"
                      r={RADIUS}
                      fill="none"
                      stroke={donutColor}
                      strokeWidth="4.5"
                      strokeDasharray={`${dash} ${gap}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div
                    className="absolute inset-0 flex items-center justify-center text-[8px] font-bold"
                    style={{ color: donutColor }}
                  >
                    {pct}%
                  </div>
                </div>
              )}

              <span className="pr-[50px] text-sm font-semibold leading-5">{subject.name}</span>

              <span className="text-xs text-slate-600">{total} PYQ{total === 1 ? "" : "s"}</span>
            </Link>
          );
        })}
      </div>
    </main>
  );
}