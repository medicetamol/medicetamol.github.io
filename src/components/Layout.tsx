import { Link, useLocation } from "react-router-dom";
import { Activity, BarChart3, Bookmark, BookOpen, Menu, Settings, X } from "lucide-react";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// ─── Header actions slot ────────────────────────────────────────────────────
// Lets any page register a right-side icon/button in the top navbar (e.g. the
// question-navigator legend icon), instead of each page owning its own copy
// of the navbar. Call useHeaderAction(node, deps) — registers on mount/when
// deps change, clears on unmount, same mental model as useEffect.
const HeaderActionsContext = createContext<(node: ReactNode) => void>(() => {});

export function useHeaderAction(node: ReactNode, deps: unknown[]) {
  const setHeaderAction = useContext(HeaderActionsContext);
  useEffect(() => {
    setHeaderAction(node);
    return () => setHeaderAction(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [headerAction, setHeaderActionState] = useState<ReactNode>(null);
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
    { to: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <HeaderActionsContext.Provider value={setHeaderActionState}>
      <div className="min-h-screen bg-page text-slate-100">
        <header className="sticky top-0 z-40 relative border-b border-slate-800/90 bg-page">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
            {/* Logo — non-functional during custom module */}
            {isCustomQuiz ? (
              <span className="flex cursor-default items-center gap-2.5 select-none">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-page">
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
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-page">
                  <Activity size={20} strokeWidth={2.5} />
                </span>
                <span className="text-lg font-bold tracking-tight">mediCetamol</span>
              </Link>
            )}

            {/* Desktop nav — hidden during custom module */}
            {!isCustomQuiz && (
              <nav className="hidden items-center gap-1 md:flex">
                {nav.map(({ to, label, icon: Icon }) => (
                  <Link
                    key={to}
                    to={to}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                      location.pathname.startsWith(to)
                        ? "bg-slate-800 text-slate-50"
                        : "text-slate-400 hover:bg-slate-900 hover:text-slate-50"
                    }`}
                  >
                    <Icon size={17} />
                    {label}
                  </Link>
                ))}
              </nav>
            )}

            <div className="flex items-center gap-1">
              {/* Page-registered action (e.g. question navigator legend icon) */}
              {headerAction}

              {/* Hamburger — hidden during custom module */}
              {!isCustomQuiz && (
                <button
                  aria-label="Open menu"
                  onClick={() => setOpen((v) => !v)}
                  className="rounded-lg p-2 text-slate-300 hover:bg-slate-900 md:hidden"
                >
                  {open ? <X size={21} /> : <Menu size={21} />}
                </button>
              )}
            </div>
          </div>

          {/* Mobile menu — floating overlay so it never shifts page content
              below it as it opens/closes (hidden during custom module) */}
          {!isCustomQuiz && open && (
            <div className="absolute inset-x-0 top-full z-50 border-t border-slate-800 bg-page px-4 py-3 shadow-xl md:hidden">
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
    </HeaderActionsContext.Provider>
  );
}