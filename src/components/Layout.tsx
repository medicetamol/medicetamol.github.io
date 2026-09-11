import { Link, useLocation } from "react-router-dom";
import { Activity, BarChart3, Bookmark, BookOpen, Menu, X } from "lucide-react";
import { useState } from "react";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Detect active custom module quiz session:
  // path is /quiz/:exam/custom and source=custom param is present
  const isCustomQuiz =
    location.pathname.includes("/quiz/") &&
    location.pathname.includes("/custom") &&
    new URLSearchParams(location.search).get("source") === "custom";

  const nav = [
    { to: "/pyqs", label: "PYQs", icon: BookOpen },
    { to: "/bookmarks", label: "Bookmarks", icon: Bookmark },
    { to: "/progress", label: "Progress", icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-[#0b0f14] text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-800/90 bg-[#0b0f14]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          {/* Logo — non-functional during custom module */}
          {isCustomQuiz ? (
            <span className="flex cursor-default items-center gap-2.5 select-none">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-[#0b0f14]">
                <Activity size={20} strokeWidth={2.5} />
              </span>
              <span className="text-lg font-bold tracking-tight text-slate-300">
                mediCetamol
              </span>
            </span>
          ) : (
            <Link
              to="/"
              className="flex items-center gap-2.5"
              onClick={() => setOpen(false)}
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-[#0b0f14]">
                <Activity size={20} strokeWidth={2.5} />
              </span>
              <span className="text-lg font-bold tracking-tight">mediCetamol</span>
            </Link>
          )}

          {/* Desktop nav — hidden during custom module */}
          {!isCustomQuiz && (
            <nav className="hidden items-center gap-1 sm:flex">
              {nav.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                    location.pathname.startsWith(to)
                      ? "bg-slate-800 text-white"
                      : "text-slate-400 hover:bg-slate-900 hover:text-white"
                  }`}
                >
                  <Icon size={17} />
                  {label}
                </Link>
              ))}
            </nav>
          )}

          {/* Hamburger — hidden during custom module */}
          {!isCustomQuiz && (
            <button
              aria-label="Open menu"
              onClick={() => setOpen((v) => !v)}
              className="rounded-lg p-2 text-slate-300 hover:bg-slate-900"
            >
              {open ? <X size={21} /> : <Menu size={21} />}
            </button>
          )}
        </div>

        {/* Mobile menu — hidden during custom module */}
        {!isCustomQuiz && open && (
          <div className="border-t border-slate-800 px-4 py-3 sm:hidden">
            {nav.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-slate-300 hover:bg-slate-900"
              >
                <Icon size={18} />
                {label}
              </Link>
            ))}
          </div>
        )}
      </header>

      {children}
    </div>
  );
}