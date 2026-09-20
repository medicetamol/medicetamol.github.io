import { ArrowRight, BarChart3, BookOpen, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import Streak from "../components/Streak";
import InstallButton from "../components/InstallButton";
import { getDailyQuestion } from "../data/dailyQuestion";
import type { PYQQuestion } from "../types";

export default function Home() {
  const [daily, setDaily] = useState<PYQQuestion | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getDailyQuestion().then((q) => {
      if (!cancelled) setDaily(q ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 sm:p-10">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <BookOpen size={18} />
            <span>PYQs for Medicos</span>
          </div>
          <Streak size="sm" linkToProgress />
        </div>

        <h1 className="mt-2 max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl">
          Solve PYQs
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
          Solve Real Previous Year Questions<br />
          Get better everyday<br />
          Solve, bookmark important ones, and track your actual QBank performance.
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            to="/pyqs"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-slate-50"
          >
            Proceed to PYQs <ArrowRight size={17} />
          </Link>
          <InstallButton />
        </div>
      </section>

      {daily && (
        <section className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
            <Sparkles size={16} className="text-amber-400" />
            PYQ of the Day
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-300">{daily.question}</p>
          <Link
            to={`/solve/${daily.id}`}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-xs font-bold text-slate-950"
          >
            Solve now <ArrowRight size={14} />
          </Link>
        </section>
      )}

      <section className="mt-5 grid gap-3 sm:grid-cols-3">
        {[
          [BookOpen, "PYQs", "Exam-wise and subject-wise"],
          [BarChart3, "Progress", "See where to focus"],
          [Sparkles, "Daily PYQ", "One fresh question every day"]
        ].map(([Icon, title, text]) => {
          const I = Icon as typeof BookOpen;
          return (
            <div key={title as string} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
              <I size={20} className="text-slate-400" />
              <h3 className="mt-4 text-sm font-bold">{title as string}</h3>
              <p className="mt-1 text-xs text-slate-500">{text as string}</p>
            </div>
          );
        })}
      </section>

      <footer className="mt-10 border-t border-slate-800/90 pt-8 text-center">
        <p className="text-xs text-slate-600">One place to solve, track, and actually improve.</p>
        <Link
          to="/about"
          className="mt-3 inline-block text-xs font-semibold text-slate-500 hover:text-slate-300"
        >
          About mediCetamol
        </Link>
      </footer>
    </main>
  );
}