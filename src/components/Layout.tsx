import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, BarChart3, Bookmark, BookOpen, Menu, Search, Settings, Table2, X } from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

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
  const [qidOpen, setQidOpen] = useState(false);
  const [qid, setQid] = useState("");
  const [qidError, setQidError] = useState("");
  const [qidBusy, setQidBusy] = useState(false);
  const qidInputRef = useRef<HTMLInputElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Detect active custom module quiz session:
  // path is /quiz/:exam/custom and source=custom param is present
  const isCustomQuiz =
    location.pathname.includes("/quiz/") &&
    location.pathname.includes("/custom") &&
    new URLSearchParams(location.search).get("source") === "custom";

  const navBeforeSearch = [
    { to: "/pyqs", label: "PYQs", icon: BookOpen },
    { to: "/allotment", label: "Allotments", icon: Table2 },
    { to: "/bookmarks", label: "Bookmarks", icon: Bookmark },
    { to: "/progress", label: "Progress", icon: BarChart3 },
  ];
  const navAfterSearch = [{ to: "/settings", label: "Settings", icon: Settings }];

  // Close the drawer whenever the route changes (e.g. after a search lands on /solve/:id)
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Escape closes the drawer; page behind doesn't scroll while it's open
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  // Every time the drawer closes (X, backdrop, Escape, or page change), reset the search
  // so it reopens collapsed, with no autofocus / keyboard popup.
  useEffect(() => {
    if (open) return;
    setQidOpen(false);
    setQid("");
    setQidError("");
  }, [open]);

  useEffect(() => {
    if (open && qidOpen) qidInputRef.current?.focus();
  }, [open, qidOpen]);

  const openQuestionSearch = () => {
    setQidOpen(true);
    setOpen(true);
  };

  const submitQid = async (e: FormEvent) => {
    e.preventDefault();
    const id = qid.trim().toUpperCase();
    if (!/^[A-Z]{4}\d{3}$/.test(id)) {
      setQidError("Enter a valid ID, like PGAN001");
      return;
    }
    setQidBusy(true);
    setQidError("");
    try {
      const { findQuestion } = await import("../data/questions");
      const found = await findQuestion(id);
      if (!found) {
        setQidError("No question found with that ID");
        return;
      }
      setQid("");
      setQidOpen(false);
      setOpen(false);
      navigate(`/solve/${id}`);
    } catch {
      setQidError("Couldn't search right now. Try again");
    } finally {
      setQidBusy(false);
    }
  };

  const navLinkClass = "flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-slate-300 hover:bg-slate-900";

  return (
    <HeaderActionsContext.Provider value={setHeaderActionState}>
      <div className="min-h-dvh bg-page text-slate-100">
        <header className="sticky top-0 z-40 relative border-b border-slate-800/90 bg-page">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
            {/* Logo — non-functional during custom module */}
            {isCustomQuiz ? (
              <span className="flex cursor-default items-center gap-2.5 select-none">
                <img src="/logo.svg" alt="" width={36} height={36} className="h-9 w-9 rounded-xl" />
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
                <img src="/logo.svg" alt="" width={36} height={36} className="h-9 w-9 rounded-xl" />
                <span className="text-lg font-bold tracking-tight">mediCetamol</span>
              </Link>
            )}

            {/* Desktop nav — hidden during custom module */}
            {!isCustomQuiz && (
              <nav className="hidden items-center gap-1 md:flex">
                {[...navBeforeSearch, { to: "#qid", label: "Question ID", icon: Search }, ...navAfterSearch].map(
                  ({ to, label, icon: Icon }) =>
                    to === "#qid" ? (
                      <button
                        key={to}
                        type="button"
                        onClick={openQuestionSearch}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-slate-900 hover:text-slate-50"
                      >
                        <Icon size={17} />
                        {label}
                      </button>
                    ) : (
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
                    )
                )}
              </nav>
            )}

            <div className="flex items-center gap-1">
              {/* Page-registered action (e.g. question navigator legend icon) */}
              {headerAction}

              {/* Hamburger — hidden during custom module */}
              {!isCustomQuiz && (
                <button
                  aria-label="Open menu"
                  onClick={() => setOpen(true)}
                  className="rounded-lg p-2 text-slate-300 hover:bg-slate-900 md:hidden"
                >
                  <Menu size={21} />
                </button>
              )}
            </div>
          </div>

        </header>

        {children}

        {/* Right-side drawer (replaces the old full-width dropdown). Always mounted so it can
            slide; inert + invisible while closed. Hidden during custom module. */}
        {!isCustomQuiz && (
          <div
            className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none invisible"}`}
            aria-hidden={!open}
          >
            <button
              type="button"
              aria-label="Close menu"
              tabIndex={open ? 0 : -1}
              onClick={() => setOpen(false)}
              className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${
                open ? "opacity-100" : "opacity-0"
              }`}
            />
            <aside
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              className={`absolute inset-y-0 right-0 flex w-[70%] max-w-xs flex-col border-l border-slate-800 bg-page shadow-2xl transition-transform duration-200 ease-out ${
                open ? "translate-x-0" : "translate-x-full"
              }`}
            >
              <div className="flex h-14 items-center justify-between border-b border-slate-800 px-4">
                <span className="text-base font-semibold text-slate-100">Menu</span>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-2 text-slate-300 hover:bg-slate-900"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-2 py-2">
                {navBeforeSearch.map(({ to, label, icon: Icon }) => (
                  <Link key={to} to={to} onClick={() => setOpen(false)} className={navLinkClass}>
                    <Icon size={18} />
                    {label}
                  </Link>
                ))}

                {/* Question ID — directly below Progress */}
                <button
                  type="button"
                  onClick={() => setQidOpen((v) => !v)}
                  aria-expanded={qidOpen}
                  className={`w-full ${navLinkClass} ${qidOpen ? "bg-slate-900 text-slate-50" : ""}`}
                >
                  <Search size={18} />
                  Question ID
                </button>
                {qidOpen && (
                  <form onSubmit={submitQid} className="mx-3 mb-2 mt-1 rounded-xl border border-slate-800 p-3">
                    <label htmlFor="qid-search" className="text-xs text-slate-400">
                      Search by Question ID
                    </label>
                    <div className="mt-1.5 flex items-center gap-2">
                      <input
                        id="qid-search"
                        ref={qidInputRef}
                        value={qid}
                        onChange={(e) => {
                          setQid(e.target.value);
                          setQidError("");
                        }}
                        placeholder="PGAN001"
                        autoCapitalize="characters"
                        autoCorrect="off"
                        spellCheck={false}
                        maxLength={7}
                        className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm uppercase text-slate-100 placeholder:normal-case placeholder:text-slate-500 focus:border-slate-500 focus:outline-none"
                      />
                      <button
                        type="submit"
                        aria-label="Search question"
                        disabled={qidBusy}
                        className="rounded-lg bg-slate-800 p-2 text-slate-100 hover:bg-slate-700 disabled:opacity-60"
                      >
                        <ArrowRight size={18} />
                      </button>
                    </div>
                    {qidError && <p className="mt-2 text-xs text-red-400">{qidError}</p>}
                  </form>
                )}

                {navAfterSearch.map(({ to, label, icon: Icon }) => (
                  <Link key={to} to={to} onClick={() => setOpen(false)} className={navLinkClass}>
                    <Icon size={18} />
                    {label}
                  </Link>
                ))}
              </div>
            </aside>
          </div>
        )}
      </div>
    </HeaderActionsContext.Provider>
  );
}