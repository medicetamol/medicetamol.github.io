import { BookOpen, ChevronLeft, ChevronRight, Flame } from "lucide-react";
import { Link } from "react-router-dom";
import { EXAMS } from "../constants";

export default function ExamSelect() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200">
        <ChevronLeft size={16} /> Home
      </Link>

      <div className="mb-7">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-text">
          <BookOpen size={13} /> Previous year questions
        </span>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          Pick your <span className="text-accent-text">exam</span>
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
          Every question you solve today is a mark you won&apos;t lose on exam day.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {EXAMS.map((exam, i) => (
          <Link
            key={exam.id}
            to={`/pyqs/${exam.id}`}
            className={`group relative flex items-center gap-4 overflow-hidden rounded-3xl border bg-slate-900/60 p-4 transition-colors hover:border-accent/50 sm:p-5 ${
              i === 0 ? "border-accent/40" : "border-slate-800"
            }`}
          >
            {i === 0 && (
              <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-accent/10" />
            )}
            <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent-soft text-base font-bold text-accent-text">
              {exam.prefix}
            </span>
            <span className="relative min-w-0 flex-1">
              <span className="block text-base font-bold">{exam.name}</span>
              <span className="mt-0.5 block text-xs leading-5 text-slate-400">{exam.description}</span>
            </span>
            <ChevronRight
              size={20}
              className={`relative shrink-0 transition-colors group-hover:text-accent-text ${
                i === 0 ? "text-accent-text" : "text-slate-500"
              }`}
            />
          </Link>
        ))}
      </div>

      <div className="mt-6 flex items-start gap-3 rounded-2xl bg-accent-soft p-4">
        <Flame size={22} className="mt-0.5 shrink-0 text-accent-text" />
        <div>
          <p className="text-sm font-semibold text-slate-100">Consistency beats intensity</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            A few PYQs every day will do more for your rank than a marathon once a month.
          </p>
        </div>
      </div>
    </main>
  );
}
