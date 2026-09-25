import { ArrowLeft, History, Sparkles } from "lucide-react";
import { Link, useParams } from 'react-router-dom';
import { SUBJECTS, EXAMS, EXAM_PREFIX } from "../constants";
import manifest from "../data/manifest.json";
import React, { useEffect, useState } from 'react';
import { getAllAnswers } from "../lib/db";
import { prefetchQuestions } from "../data/questions";
import { useTheme } from "../lib/theme";

type SubjectManifest = { total: number; topics: Record<string, number> };
type Manifest = Record<string, Record<string, SubjectManifest>>;
const counts = manifest as Manifest;

export default function SubjectSelect() {
  const { exam } = useParams<{ exam: "NEET-PG" | "INI-CET" | "FMGE" }>();
  const examId: "NEET-PG" | "INI-CET" | "FMGE" =
    exam && EXAMS.some((x) => x.id === exam) ? exam : "NEET-PG";
  const currentExam = EXAMS.find((x) => x.id === examId);

  // Donut ring colour endpoints (quiet at 0% → strongest at 100%); inverted for the light theme.
  const theme = useTheme();
  const RING_FROM = theme === "light" ? [125, 139, 160] : [55, 65, 81];
  const RING_TO = theme === "light" ? [51, 65, 85] : [148, 163, 184];

  const [answeredQids, setAnsweredQids] = useState<Set<string>>(new Set());

  useEffect(() => {
    getAllAnswers().then((items) => {
      setAnsweredQids(new Set(items.map((a) => a.qid)));
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

      {/* Create custom module — full-width banner, plus a square shortcut to its history */}
      <div className="mb-4 flex items-stretch gap-3">
        <Link
          to={`/module/${examId}`}
          className="flex flex-1 items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900/60 px-5 py-4 hover:border-slate-500 hover:bg-slate-800/60"
        >
          <Sparkles size={17} className="shrink-0 text-slate-400" />
          <span className="text-sm font-semibold text-slate-200">Create custom module</span>
        </Link>
        <Link
          to="/modules/history"
          aria-label="Custom module history"
          className="flex w-14 shrink-0 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/60 hover:border-slate-500 hover:bg-slate-800/60"
        >
          <History size={18} className="text-slate-400" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {SUBJECTS.map((subject) => {
          const total = counts[examId]?.[subject.id]?.total ?? 0;
          const prefix = `${EXAM_PREFIX[examId]}${subject.code}`;
          let attempted = 0;
          for (const qid of answeredQids) {
            if (qid.startsWith(prefix)) attempted++;
          }
          const pct = total > 0 ? Math.round((attempted / total) * 100) : 0;

          // Donut ring color: linear RGB interpolation from RING_FROM (0%) to RING_TO (100%)
          const donutColor = `rgb(${RING_FROM.map((c, i) =>
            Math.round(c + (RING_TO[i] - c) * (pct / 100))
          ).join(", ")})`;

          const RADIUS = 15;
          const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
          const dash = (pct / 100) * CIRCUMFERENCE;
          const gap = CIRCUMFERENCE - dash;
          const showDonut = total > 0 && attempted > 0;

          return (
            <Link
              key={subject.id}
              to={`/pyqs/${examId}/${subject.id}`}
              onClick={() => prefetchQuestions(examId, subject.id)}
              className="group relative flex min-h-[100px] flex-col justify-between overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 p-3.5 pl-4 hover:border-slate-600"
            >
              {showDonut && (
                <div className="absolute right-[5px] top-[5px] h-[42px] w-[42px]">
                  <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90">
                    <circle cx="21" cy="21" r={RADIUS} fill="none" className="stroke-slate-800" strokeWidth="4.5" />
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