import { ArrowRight, BarChart3, Bookmark, BookOpen, History, Sparkles, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import Streak from "../components/Streak";
import InstallButton from "../components/InstallButton";
import VisitorCount from "../components/VisitorCount";
import { getDailyQuestion } from "../data/dailyQuestion";
import type { PYQQuestion } from "../types";

const CARDS: Array<{ to: string; Icon: LucideIcon; title: string; text: string }> = [
  { to: "/pyqs", Icon: BookOpen, title: "PYQs", text: "By exam and subject" },
  { to: "/progress", Icon: BarChart3, title: "Progress", text: "See where to focus" },
  { to: "/bookmarks", Icon: Bookmark, title: "Bookmarks", text: "Revisit the tricky ones" },
  { to: "/modules/history", Icon: History, title: "Solved modules", text: "Your custom sets" }
];

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function Home() {
  const [daily, setDaily] = useState<PYQQuestion | null | undefined>(undefined);
  const [hello] = useState(greeting);

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
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/60 p-6 sm:p-10">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-accent/10" />
        <div aria-hidden="true" className="pointer-events-none absolute right-12 top-14 h-20 w-20 rounded-full bg-accent/10" />

        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm text-slate-400">{hello}, Doctor</p>
            <Streak size="sm" linkToProgress />
          </div>

          <h1 className="mt-3 max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight sm:text-6xl">
            Let&apos;s solve some <span className="text-accent-text">PYQs</span> today
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
            Solve real previous year questions, bookmark the important ones, and track your actual QBank performance.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              to="/pyqs"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-6 py-4 text-sm font-bold text-accent-ink hover:brightness-110 sm:py-3.5"
            >
              Proceed to PYQs <ArrowRight size={17} />
            </Link>
            <InstallButton />
          </div>
        </div>
      </section>

      {daily === undefined ? (
        // Reserves the card's space while the question loads, so nothing jumps.
        <div aria-hidden="true" className="mt-5 min-h-[168px] animate-pulse rounded-3xl bg-slate-900/40" />
      ) : (
        daily && (
          <section className="mt-5 rounded-3xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-text">
              <Sparkles size={13} /> PYQ of the day
            </span>
            <p className="mt-3 text-sm leading-6 text-slate-200 sm:text-base">{daily.question}</p>
            <Link
              to={`/solve/${daily.id}`}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-accent-text hover:underline"
            >
              Solve now <ArrowRight size={15} />
            </Link>
          </section>
        )
      )}

      <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {CARDS.map(({ to, Icon, title, text }) => (
          <Link
            key={to}
            to={to}
            className="rounded-3xl border border-slate-800 bg-slate-900/60 p-4 transition-colors hover:border-accent/40 sm:p-5"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent-text">
              <Icon size={19} />
            </span>
            <h2 className="mt-4 text-sm font-bold">{title}</h2>
            <p className="mt-1 text-xs text-slate-400">{text}</p>
          </Link>
        ))}
      </section>

      <footer className="mt-10 border-t border-slate-800/90 pt-8 text-center">
        <p className="text-xs text-slate-500">One place to solve, track, and actually improve.</p>
        <Link to="/about" className="mt-3 inline-block text-xs font-semibold text-slate-400 hover:text-slate-200">
          About mediCetamol
        </Link>
        <div className="mt-4 flex justify-center">
          <VisitorCount />
        </div>
      </footer>
    </main>
  );
}
