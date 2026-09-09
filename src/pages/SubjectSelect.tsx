import { ArrowLeft, Sparkles } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { SUBJECTS, EXAMS } from "../constants";
import { getAllQuestions } from "../data/questions";
import { useEffect, useState } from "react";
import { getAllQuestionProgress } from "../lib/db";

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
          const allQ = getAllQuestions(examId).filter((q) => q.subjectId === subject.id);
          const total = allQ.length;
          const attempted = allQ.filter((q) => {
            const p = progressMap.get(q.id);
            return p && p.attempts > 0;
          }).length;
          const pct = total > 0 ? Math.round((attempted / total) * 100) : 0;

          return (
            <Link
              key={subject.id}
              to={`/pyqs/${examId}/${subject.id}`}
              className="group flex min-h-28 flex-col justify-between overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 hover:border-slate-600"
            >
              {/* Card body */}
              <div className="flex-1 p-4">
                <span className="text-sm font-semibold leading-5">{subject.name}</span>
              </div>

              {/* Bottom strip: count + progress bar */}
              <div className="border-t border-slate-800 px-4 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{total} PYQ{total === 1 ? "" : "s"}</span>
                  {total > 0 && attempted > 0 && (
                    <span className="text-[10px] text-slate-600">{pct}%</span>
                  )}
                </div>
                {total > 0 && (
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-slate-500 transition-[width]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}