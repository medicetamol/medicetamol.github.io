import { ArrowLeft, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { EXAMS } from "../constants";

export default function ExamSelect() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-200">
        <ArrowLeft size={16} /> Home
      </Link>

      <div className="mb-7">
        <h1 className="text-2xl font-bold">PYQs</h1>
        <p className="mt-1 text-sm text-slate-500">Choose the examination.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {EXAMS.map((exam) => (
          <Link
            key={exam.id}
            to={`/pyqs/${exam.id}`}
            className="group rounded-2xl border border-slate-800 bg-slate-900/60 p-5 hover:border-slate-600"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-bold">{exam.name}</h2>
              <ArrowRight size={17} className="text-slate-600 transition group-hover:text-slate-200" />
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">{exam.description}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}