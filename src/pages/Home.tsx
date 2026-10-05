import { ChevronRight, BarChart3, Bookmark, BookOpen, History, Sparkles, type LucideIcon } from "lucide-react";
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
    <main className="relative mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      {/* soft circles sit behind the hero, on the page itself (no card box) */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[440px] overflow-hidden">
        <div className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-accent/10" />
        <div className="absolute right-8 top-24 h-24 w-24 rounded-full bg-accent/10" />
      </div>

      <section className="relative p-5">
        <p className="text-sm text-slate-400">{hello}, Doctor</p>

        {/* min height reserves the pill's space while the streak loads */}
        <div className="mt-2 flex min-h-[36px] justify-end">
          <Streak variant="pill" linkToProgress />
        </div>

        <h1 className="mt-3 max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight sm:text-6xl">
          Let&apos;s solve some <span className="text-accent-text">PYQs</span> today
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
          Solve real previous year questions, bookmark the important ones, and track your actual QBank performance.
        </p>

        <Link
          to="/pyqs"
          className="btn-sweep mt-7 flex items-center justify-center gap-2 rounded-2xl bg-accent px-6 py-4 text-sm font-bold text-accent-ink hover:brightness-110 sm:inline-flex sm:py-3.5"
        >
          Proceed to PYQs <ChevronRight size={17} />
        </Link>
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
              Solve now <ChevronRight size={15} />
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

      <div className="mt-8 flex flex-col items-center gap-3 empty:hidden">
        <InstallButton />
      </div>

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
