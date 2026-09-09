import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  CornerRightUp,
  Pause,
  Play,
  Sparkles,
} from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  findQuestion,
  getAllQuestions,
  hasDetailedExplanation,
  loadDetailedExplanation,
  loadExplanations,
} from "../data/questions";
import {
  getQuestionProgress,
  getAllQuestionProgress,
  recordDirectAnswer,
  saveQuizResult,
  toggleBookmark,
} from "../lib/db";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import QuestionCard from "../components/QuestionCard";
import MarkdownContent from "../components/MarkdownContent";
import type { Exam, PYQQuestion, QuizAnswer } from "../types";
import { formatQuestionForShare, getSiteUrl, shareOrCopy } from "../lib/sharing";

// ─── helpers ────────────────────────────────────────────────────────────────

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

const SECONDS_PER_QUESTION = 60;
const HALF_TIME = 30;
const LAST_TEN_SECONDS = 10;

// ─── Quiz mode derivation ────────────────────────────────────────────────────
// source=custom  → custom module (ids param present)
// source=direct  → normal PYQ drill (default)
// mode=quiz      → exam/quiz mode (global timer, no per-Q submit, no live marking)
// mode=guide     → guide mode (per-question timer, submit, explanation live)  ← default for custom
// For direct PYQ sessions mode is always "guide" behaviour (with submit).

// ─── Fullscreen helpers ──────────────────────────────────────────────────────

function requestFS() {
  const el = document.documentElement;
  if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
}
function exitFS() {
  if (document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  }
}
function isFullscreen() {
  return Boolean(document.fullscreenElement);
}

// ─── Modal helper ────────────────────────────────────────────────────────────

function Modal({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        {children}
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function Quiz() {
  const { exam, subjectId, questionId } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();

  // Derive session identity
  const targetQuestion = useMemo(
    () => (questionId ? findQuestion(questionId) : undefined),
    [questionId]
  );
  const examId = ((exam as Exam | undefined) ?? targetQuestion?.exam ?? "NEET-PG") as Exam;
  const isSolveLink = Boolean(questionId);

  // source: custom vs direct
  const source = search.get("source") === "custom" ? "custom" : "direct";
  // mode: quiz vs guide (only relevant for custom modules)
  const moduleMode = (search.get("mode") ?? "guide") as "quiz" | "guide";
  const isCustom = source === "custom";
  const isQuizMode = isCustom && moduleMode === "quiz";
  const isGuideMode = !isQuizMode; // direct PYQ + guide custom both behave the same inside

  const ids = (search.get("ids") ?? "").split(",").filter(Boolean);
  const topic = search.get("topic") ?? "all";

  // ── Build question pool ──
  const pool = useMemo<PYQQuestion[]>(() => {
    if (!examId) return [];
    const allQuestions = getAllQuestions(examId);

    if (isSolveLink) {
      if (!targetQuestion) return [];
      const subjectQuestions = allQuestions.filter((q) => q.subjectId === targetQuestion.subjectId);
      const topicQuestions = subjectQuestions.filter((q) => q.topicId === targetQuestion.topicId);
      const candidates = topicQuestions.length >= 5 ? topicQuestions : subjectQuestions;
      const remaining = shuffle(candidates.filter((q) => q.id !== targetQuestion.id)).slice(0, 39);
      return [targetQuestion, ...remaining];
    }

    if (isCustom) {
      // Custom: maintain the order from the ids param (already shuffled in ModuleBuilder)
      return ids
        .map((id) => allQuestions.find((q) => q.id === id))
        .filter((q): q is PYQQuestion => q !== undefined);
    }

    // Direct PYQ: serial order (no shuffle)
    let questions = allQuestions.filter((q) => q.subjectId === subjectId);
    if (topic !== "all") questions = questions.filter((q) => q.topicId === topic);
    return questions; // serial, as stored
  }, [examId, isSolveLink, targetQuestion?.id, isCustom, ids.join(","), subjectId, topic]);

  // ── Restore starting index for direct PYQ (first unanswered) ──
  const [startIndexReady, setStartIndexReady] = useState(isSolveLink || isCustom);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (isSolveLink || isCustom || pool.length === 0) return;
    getAllQuestionProgress().then((allProgress) => {
      const progressMap = new Map(allProgress.map((p) => [p.qid, p]));
      const firstUnanswered = pool.findIndex((q) => {
        const p = progressMap.get(q.id);
        // "answered" means has a selection (correct or incorrect). Skipped (attempts but no directCorrect/directIncorrect) not counted.
        return !p || (p.attempts === 0);
      });
      setIndex(firstUnanswered >= 0 ? firstUnanswered : 0);
      setStartIndexReady(true);
    });
  }, [pool.length, isSolveLink, isCustom]);

  // ── Per-question state ──
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [bookmarked, setBookmarked] = useState(false);
  const [feedback, setFeedback] = useState("");

  // Per-question timer (guide/direct)
  const [timerEnabled, setTimerEnabled] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(SECONDS_PER_QUESTION);

  // Global timer for quiz mode
  const totalSeconds = pool.length * SECONDS_PER_QUESTION;
  const [globalSecondsLeft, setGlobalSecondsLeft] = useState(totalSeconds);
  const [globalTimerRunning, setGlobalTimerRunning] = useState(true);

  // Modals
  const [showEarlyConfirm, setShowEarlyConfirm] = useState(false);
  const [showFinalConfirm, setShowFinalConfirm] = useState(false); // unanswered questions warning
  const [showFSExitModal, setShowFSExitModal] = useState(false);

  // Detailed explanation
  const [detailedExplanation, setDetailedExplanation] = useState<string | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const [startedAt] = useState(new Date().toISOString());

  // Refs (avoid stale closures in timers/effects)
  const selectedRef = useRef<number | null>(null);
  const answersRef = useRef<QuizAnswer[]>([]);
  const submittedRef = useRef(false);
  const feedbackTimerRef = useRef<number | null>(null);
  const globalTimerRunningRef = useRef(true);

  // ── Sync refs ──
  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { submittedRef.current = submitted; }, [submitted]);
  useEffect(() => { globalTimerRunningRef.current = globalTimerRunning; }, [globalTimerRunning]);

  // ── Cleanup ──
  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  // ── Prevent browser back (custom modules + solve links only) ──
  useEffect(() => {
    if (!pool.length) return;
    // Direct PYQ: allow native back navigation
    if (!isCustom && !isSolveLink) return;
    const state = { mediCetamolQuiz: true };
    window.history.pushState(state, "", window.location.href);
    const blockBack = () => window.history.pushState(state, "", window.location.href);
    window.addEventListener("popstate", blockBack);
    return () => window.removeEventListener("popstate", blockBack);
  }, [pool.length, index, isCustom, isSolveLink]);

  // ── Fullscreen management (custom modules only) ──
  useEffect(() => {
    if (!isCustom) return;
    const onFSChange = () => {
      if (!isFullscreen()) {
        // User exited fullscreen
        if (isQuizMode) setGlobalTimerRunning(false);
        else setTimerEnabled(false);
        setShowFSExitModal(true);
      }
    };
    document.addEventListener("fullscreenchange", onFSChange);
    return () => document.removeEventListener("fullscreenchange", onFSChange);
  }, [isCustom, isQuizMode]);

  // ── Load question state when index changes ──
  const question = pool[index];

  useEffect(() => {
    if (!question) return;

    getQuestionProgress(question.id).then((p) => setBookmarked(Boolean(p?.bookmarked)));

    if (isQuizMode) {
      // In quiz mode we track selections in answersRef only, no "submitted" state per question
      const prev = answersRef.current.find((a) => a.qid === question.id);
      selectedRef.current = prev?.selected ?? null;
      setSelected(prev?.selected ?? null);
      setSubmitted(false);
      setTimedOut(false);
      setFeedback("");
      return;
    }

    // Guide / direct: restore prior answer if any
    const previousAnswer = answersRef.current.find((a) => a.qid === question.id);

    // For direct PYQ, also check IndexedDB to restore persisted answers.
    // Guard against stale async: if the question changes before this resolves, discard the result.
    let cancelled = false;
    if (!isCustom && !isSolveLink && !previousAnswer) {
      getQuestionProgress(question.id).then((p) => {
        if (cancelled) return;
        if (p && p.attempts > 0) {
          // Question was answered in a previous session — restore as "submitted".
          // We don't store which option was chosen, so restore selected as the
          // correct answer index so it highlights green (not the skipped/timed-out sky style).
          const syntheticAnswer: QuizAnswer = {
            qid: question.id,
            selected: p.directCorrect ? question.answer : null,
            correct: p.directCorrect,
          };
          answersRef.current = [...answersRef.current.filter((a) => a.qid !== question.id), syntheticAnswer];
          selectedRef.current = syntheticAnswer.selected;
          submittedRef.current = true;
          setSelected(syntheticAnswer.selected);
          setSubmitted(true);
          setTimedOut(!p.directCorrect); // only show "skipped" style when they actually got it wrong
        }
      });
    }

    const restoredSelection = previousAnswer?.selected ?? null;
    selectedRef.current = restoredSelection;
    submittedRef.current = Boolean(previousAnswer);
    setSelected(restoredSelection);
    setSubmitted(Boolean(previousAnswer));
    setTimedOut(Boolean(previousAnswer && previousAnswer.selected === null));
    setSecondsLeft(SECONDS_PER_QUESTION);
    setTimerEnabled(true);
    setFeedback("");

    return () => { cancelled = true; };
  }, [index, question?.id, isQuizMode, isCustom, isSolveLink]);

  useEffect(() => {
    setDetailedExplanation(null);
    setShowDetails(false);
    setLoadingDetails(false);
  }, [question?.id]);

  // ── Per-question timer (guide mode + direct) ──
  useEffect(() => {
    if (isQuizMode) return;
    if (!timerEnabled || submitted || !question) return;

    const timer = window.setInterval(() => {
      setSecondsLeft((value) => {
        if (value <= 1) {
          window.clearInterval(timer);
          void submitCurrent(selectedRef.current, true);
          return 0;
        }
        return value - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isQuizMode, timerEnabled, submitted, question?.id]);

  // ── Global timer (quiz mode) ──
  useEffect(() => {
    if (!isQuizMode) return;

    const timer = window.setInterval(() => {
      if (!globalTimerRunningRef.current) return;
      setGlobalSecondsLeft((value) => {
        if (value <= 1) {
          window.clearInterval(timer);
          void finishQuiz();
          return 0;
        }
        return value - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isQuizMode]);

  // ─── Derived ────────────────────────────────────────────────────────────────

  const explanation = question && examId
    ? loadExplanations(examId, question.subjectId).find((x) => x.id === question.id)
    : undefined;

  const detailedAvailable = Boolean(
    question && examId && hasDetailedExplanation(examId, question.subjectId, question.id)
  );

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  const showFeedback = useCallback((message: string) => {
    if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
    setFeedback(message);
    feedbackTimerRef.current = window.setTimeout(() => setFeedback(""), 1200);
  }, []);

  async function submitCurrent(choice: number | null = selectedRef.current, timeout = false) {
    if (submittedRef.current || !question) return;

    const correct = choice !== null && choice === question.answer;
    const nextAnswers: QuizAnswer[] = [
      ...answersRef.current.filter((a) => a.qid !== question.id),
      { qid: question.id, selected: choice, correct },
    ];

    answersRef.current = nextAnswers;
    submittedRef.current = true;
    setAnswers(nextAnswers);
    setSubmitted(true);
    setTimedOut(timeout && choice === null);

    if (timeout) setSecondsLeft(0);

    if (!isCustom && !isSolveLink) {
      await recordDirectAnswer(question.id, correct);
    }
  }

  const finishQuiz = useCallback(async () => {
    setShowFinalConfirm(false);
    setShowFSExitModal(false);

    // For quiz mode: build final answers for all questions (unanswered = skipped)
    const finalAnswers: QuizAnswer[] = pool.map((q) => {
      const existing = answersRef.current.find((a) => a.qid === q.id);
      if (existing) return existing;
      return { qid: q.id, selected: null, correct: false };
    });

    exitFS();

    await saveQuizResult({
      exam: examId,
      questionIds: pool.map((q) => q.id),
      answers: finalAnswers,
      customModule: isCustom,
      startedAt,
      finishedAt: new Date().toISOString(),
    });

    navigate(`/result/${examId}`, {
      state: {
        total: pool.length,
        answers: finalAnswers,
        questions: pool,
        custom: isCustom,
        examFinished: true,
      },
    });
  }, [pool, examId, isCustom, startedAt, navigate]);

  const requestFinalSubmit = useCallback(() => {
    if (isQuizMode) {
      // Check unanswered
      const unanswered = pool.filter(
        (q) => !answersRef.current.find((a) => a.qid === q.id && a.selected !== null)
      ).length;
      if (unanswered > 0) {
        setShowFinalConfirm(true);
        return;
      }
      void finishQuiz();
      return;
    }

    // Guide / direct: check if on last question
    const isLast = index === pool.length - 1;
    if (isLast) {
      const unanswered = pool.filter(
        (q) => !answersRef.current.find((a) => a.qid === q.id && a.selected !== null)
      ).length;
      if (unanswered > 0) {
        setShowFinalConfirm(true);
        return;
      }
      void finishQuiz();
      return;
    }

    // Early exit from non-last question
    setShowEarlyConfirm(true);
  }, [isQuizMode, index, pool, finishQuiz]);

  const next = useCallback(() => {
    if (isQuizMode) {
      // In quiz mode: save current selection then move on (no submit requirement)
      const sel = selectedRef.current;
      if (sel !== null) {
        const correct = sel === question?.answer;
        const existing = answersRef.current.find((a) => a.qid === question?.id);
        if (!existing) {
          const nextAnswers: QuizAnswer[] = [
            ...answersRef.current,
            { qid: question!.id, selected: sel, correct },
          ];
          answersRef.current = nextAnswers;
          setAnswers(nextAnswers);
        }
      }
      if (index < pool.length - 1) {
        setIndex((i) => i + 1);
        window.scrollTo({ top: 0, behavior: "auto" });
      }
      return;
    }
    if (!submittedRef.current || index >= pool.length - 1) return;
    setIndex((i) => i + 1);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [isQuizMode, index, pool.length, question]);

  const previous = useCallback(() => {
    if (isQuizMode) {
      if (index <= 0) return;
      setIndex((i) => i - 1);
      window.scrollTo({ top: 0, behavior: "auto" });
      return;
    }
    if (!submittedRef.current || index <= 0) return;
    setIndex((i) => i - 1);
  }, [isQuizMode, index]);

  const handleSubmit = () => {
    if (submittedRef.current || !timerEnabled) return;
    const hasSelection = selectedRef.current !== null;
    const halfTimeReached = secondsLeft <= HALF_TIME;
    if (hasSelection || halfTimeReached) {
      void submitCurrent(selectedRef.current);
      return;
    }
    showFeedback("Wait for 30s to skip");
  };

  const handleOptionSelect = (choice: number) => {
    if (!isQuizMode && submittedRef.current) return;

    if (selectedRef.current === choice) {
      selectedRef.current = null;
      setSelected(null);
      return;
    }
    selectedRef.current = choice;
    setSelected(choice);
  };

  const toggleDetails = async () => {
    if (!question || !examId || !detailedAvailable) return;
    if (showDetails) { setShowDetails(false); return; }
    if (!detailedExplanation) {
      setLoadingDetails(true);
      const content = await loadDetailedExplanation(examId, question.subjectId, question.id);
      setDetailedExplanation(content);
      setLoadingDetails(false);
      if (!content) { showFeedback("Detailed explanation unavailable"); return; }
    }
    setShowDetails(true);
  };

  const askAI = async () => {
    if (!question) return;
    const aiUrl = getSiteUrl(`/ai/${question.id}`);
    const text = `Explain this PYQ using the\nmediceTaMol AI prompt.\n\n${formatQuestionForShare(question, { includeBranding: false })}\n\nUse this prompt to solve this:\n${aiUrl}`;
    const result = await shareOrCopy({ title: "Share with AI • mediceTaMol", text });
    showFeedback(
      result === "copied" ? "AI prompt link copied"
      : result === "shared" ? "Share sheet opened"
      : "Unable to share"
    );
  };

  const bookmark = async () => {
    if (!question) return;
    const result = await toggleBookmark(question.id);
    setBookmarked(result.bookmarked);
  };

  const handleFSGoBack = () => {
    setShowFSExitModal(false);
    requestFS();
    if (isQuizMode) setGlobalTimerRunning(true);
    else setTimerEnabled(true);
  };

  const handleFSExit = () => {
    void finishQuiz();
  };

  const handleGlobalPauseToggle = () => {
    setGlobalTimerRunning((v) => !v);
  };

  // ─── Derived display values ───────────────────────────────────────────────

  // Per-question timer display
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const timerProgress = (secondsLeft / SECONDS_PER_QUESTION) * 100;
  const danger = secondsLeft <= LAST_TEN_SECONDS && !submitted && !isQuizMode;

  // Global timer display
  const gTotal = pool.length * SECONDS_PER_QUESTION;
  const gMm = String(Math.floor(globalSecondsLeft / 60)).padStart(2, "0");
  const gSs = String(globalSecondsLeft % 60).padStart(2, "0");
  const globalTimerProgress = (globalSecondsLeft / gTotal) * 100;
  const globalDanger = globalSecondsLeft <= 60;

  // Quiz mode: is question section blurred?
  const isBlurred = isCustom && (!isFullscreen() && showFSExitModal) ||
    (isQuizMode && !globalTimerRunning && !showFSExitModal);

  const actionClass =
    "rounded-xl border border-slate-700 bg-slate-800 px-4 py-3.5 text-sm font-semibold text-slate-200 hover:bg-slate-750";
  const solveMoreClass =
    "rounded-xl border border-slate-200 bg-slate-100 px-4 py-3.5 text-sm font-bold text-slate-950 shadow-lg shadow-slate-200/20 hover:bg-white";

  // ─── Unanswered count (for quiz mode submit) ──────────────────────────────
  const unansweredCount = pool.filter(
    (q) => !answersRef.current.find((a) => a.qid === q.id && a.selected !== null)
  ).length;

  if (!startIndexReady || !pool.length) {
    if (!startIndexReady) {
      return (
        <main className="mx-auto max-w-3xl px-3 py-12 text-center">
          <p className="text-sm text-slate-500">Loading…</p>
        </main>
      );
    }
    return (
      <main className="mx-auto max-w-3xl px-3 py-12 text-center">
        <h1 className="text-xl font-bold">No questions available</h1>
        <p className="mt-2 text-sm text-slate-500">Add verified PYQs to this section first.</p>
        <Link
          to={`/pyqs/${exam}`}
          className="mt-5 inline-flex rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-950"
        >
          Back to PYQs
        </Link>
      </main>
    );
  }

  return (
    <main className="relative mx-auto min-h-screen w-full max-w-4xl px-1 pb-24 pt-1 sm:px-2 sm:pt-2">

      {/* ── Global timer bar (quiz mode) ── */}
      {isQuizMode && (
        <div className="sticky top-14 z-30 -mx-1 bg-[#080b10]/95 px-1 pb-1 pt-1 backdrop-blur">
          <div
            className={`mb-2 h-1 overflow-hidden rounded-full ${globalDanger ? "bg-red-950/70" : "bg-slate-900"}`}
          >
            <div
              className={`h-full transition-[width] duration-1000 ease-linear ${globalDanger ? "bg-red-500" : "bg-slate-500"}`}
              style={{ width: `${globalTimerProgress}%` }}
            />
          </div>
          <div className="mb-2 flex items-center justify-between gap-2 px-1">
            <span className="text-xs font-medium text-slate-500">
              {index + 1}/{pool.length}
            </span>
            <div className="flex items-center gap-2">
              {/* Global timer + pause */}
              <div
                className={`inline-flex items-center overflow-hidden rounded-lg border ${
                  globalDanger
                    ? "border-red-900/70 bg-red-950/30 text-red-400"
                    : "border-slate-800 text-slate-400"
                }`}
              >
                <button
                  type="button"
                  onClick={handleGlobalPauseToggle}
                  className="flex min-h-10 items-center px-2.5 py-2"
                  aria-label={globalTimerRunning ? "Pause timer" : "Resume timer"}
                >
                  {globalTimerRunning ? <Pause size={13} /> : <Play size={13} />}
                </button>
                <span className="border-l border-slate-800 px-2.5 py-2 text-xs font-medium">
                  {gMm}:{gSs}
                </span>
              </div>
              <button
                type="button"
                onClick={bookmark}
                className="rounded-lg p-2 text-slate-500 transition-colors hover:text-slate-200"
                aria-label={bookmarked ? "Remove bookmark" : "Bookmark"}
              >
                <Bookmark size={21} strokeWidth={1.8} fill={bookmarked ? "currentColor" : "none"} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Per-question timer bar (guide/direct) ── */}
      {!isQuizMode && (
        <div className={!submitted ? "sticky top-14 z-30 -mx-1 bg-[#080b10]/95 px-1 pb-1 pt-1 backdrop-blur" : ""}>
          <div
            className={`mb-2 h-1 overflow-hidden rounded-full ${danger ? "bg-red-950/70" : "bg-slate-900"}`}
            aria-label={`Time remaining ${mm}:${ss}`}
          >
            <div
              className={`h-full transition-[width] duration-1000 ease-linear ${danger ? "bg-red-500" : "bg-slate-500"}`}
              style={{ width: `${timerProgress}%` }}
            />
          </div>

          <div className="mb-2 flex items-center justify-between gap-2 px-1">
            <span className="text-xs font-medium text-slate-500">
              {index + 1}/{pool.length}
            </span>
            <div className="flex items-center gap-2">
              <div
                className={`inline-flex items-center overflow-hidden rounded-lg border ${
                  danger
                    ? "border-red-900/70 bg-red-950/30 text-red-400"
                    : "border-slate-800 text-slate-400"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setTimerEnabled((v) => !v)}
                  disabled={submitted}
                  className="flex min-h-10 items-center px-2.5 py-2 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={timerEnabled ? "Pause timer" : "Resume timer"}
                >
                  {timerEnabled ? <Pause size={13} /> : <Play size={13} />}
                </button>
                <span className="border-l border-slate-800 px-2.5 py-2 text-xs font-medium">
                  {mm}:{ss}
                </span>
              </div>
              <button
                type="button"
                onClick={bookmark}
                className="rounded-lg p-2 text-slate-500 transition-colors hover:text-slate-200"
                aria-label={bookmarked ? "Remove bookmark" : "Bookmark"}
              >
                <Bookmark size={21} strokeWidth={1.8} fill={bookmarked ? "currentColor" : "none"} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Question card (blurred in quiz mode when paused/fullscreen exited) ── */}
      <div
        className={`transition-[filter] duration-300 ${
          isBlurred || (isQuizMode && !globalTimerRunning) ? "blur-sm pointer-events-none select-none" : ""
        }`}
      >
        <QuestionCard
          question={question}
          selected={selected}
          submitted={isQuizMode ? false : submitted}
          timedOut={isQuizMode ? false : timedOut}
          bookmarked={bookmarked}
          onSelect={handleOptionSelect}
          onBookmark={bookmark}
          onShareFeedback={showFeedback}
        />

        {/* Explanation (guide/direct only) */}
        {!isQuizMode && submitted && question && (
          <section className="mt-6 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3.5 py-4 sm:px-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Explanation
              </p>
              <button
                type="button"
                onClick={askAI}
                className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 shadow-sm transition-colors hover:bg-slate-700 hover:text-white active:bg-slate-700"
                aria-label="Ask AI"
              >
                <Sparkles size={15} />
                <span>Ask AI</span>
              </button>
            </div>

            {explanation ? (
              <p className="mt-2 text-sm leading-6 text-slate-300">{explanation.e}</p>
            ) : (
              <div className="mt-3">
                <p className="text-sm leading-6 text-slate-500">Explanation not available yet.</p>
                <button
                  type="button"
                  onClick={askAI}
                  className="group mt-1.5 flex w-full items-end justify-end gap-1 text-right"
                  aria-label="Get an AI explanation for this question"
                >
                  <span className="text-xs italic leading-5 text-slate-500 underline decoration-slate-700 decoration-dotted underline-offset-4 transition-colors group-hover:text-slate-300 group-hover:decoration-slate-500">
                    Get an AI explanation for this question
                  </span>
                  <CornerRightUp
                    size={15}
                    strokeWidth={1.8}
                    className="mb-0.5 shrink-0 text-slate-600 transition-colors group-hover:text-slate-400"
                  />
                </button>
              </div>
            )}

            {explanation && detailedAvailable && (
              <>
                <button
                  type="button"
                  onClick={toggleDetails}
                  disabled={loadingDetails}
                  className="mt-3 inline-flex items-center rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-750 disabled:opacity-60"
                >
                  {loadingDetails ? "LOADING..." : showDetails ? "HIDE DETAILS ↑" : "VIEW MORE ↓"}
                </button>
                {showDetails && detailedExplanation && (
                  <div className="mt-4 border-t border-slate-800 pt-4">
                    <MarkdownContent content={detailedExplanation} />
                  </div>
                )}
              </>
            )}
          </section>
        )}
      </div>

      {/* ── Feedback toast ── */}
      <div
        className={`pointer-events-none fixed bottom-[5.25rem] left-1/2 z-40 -translate-x-1/2 rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-2 text-xs text-slate-200 shadow-lg transition-opacity ${
          feedback ? "opacity-100" : "opacity-0"
        }`}
        aria-live="polite"
      >
        {feedback}
      </div>

      {/* ── Modal: Early exit (non-last question, guide/direct) ── */}
      {showEarlyConfirm && (
        <Modal>
          <h2 className="text-center text-lg font-semibold text-slate-100">Are you sure?</h2>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => void finishQuiz()}
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-100"
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setShowEarlyConfirm(false)}
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-100"
            >
              Go Back
            </button>
          </div>
        </Modal>
      )}

      {/* ── Modal: Unanswered questions warning ── */}
      {showFinalConfirm && (
        <Modal>
          <h2 className="text-center text-lg font-semibold text-slate-100">Are you sure?</h2>
          <p className="mt-2 text-center text-sm text-slate-400">
            You have {unansweredCount} question{unansweredCount === 1 ? "" : "s"} left
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => void finishQuiz()}
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-100"
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setShowFinalConfirm(false)}
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-100"
            >
              Go Back
            </button>
          </div>
        </Modal>
      )}

      {/* ── Modal: Fullscreen exit ── */}
      {showFSExitModal && (
        <Modal>
          <h2 className="text-center text-lg font-semibold text-slate-100">
            Continue where you left
          </h2>
          <p className="mt-1 text-center text-xs text-slate-500">
            Exiting will submit your module
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleFSExit}
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-100"
            >
              Exit
            </button>
            <button
              type="button"
              onClick={handleFSGoBack}
              className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-bold text-slate-950"
            >
              Go Back
            </button>
          </div>
        </Modal>
      )}

      {/* ── Fixed bottom navigation ── */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-900 bg-[#080b10]/95 px-1.5 py-2 backdrop-blur sm:px-2">
        <div className="mx-auto flex max-w-4xl items-stretch gap-2">

          {isQuizMode ? (
            // Quiz mode: always PREVIOUS | NEXT (or FINAL SUBMIT at last)
            <>
              <button
                type="button"
                onClick={previous}
                disabled={index === 0}
                className={`flex-1 ${actionClass} disabled:cursor-not-allowed disabled:opacity-40`}
                aria-label="Previous question"
              >
                <span className="flex items-center justify-center gap-2">
                  <ChevronLeft size={18} />
                  PREV
                </span>
              </button>

              {index < pool.length - 1 ? (
                <button
                  type="button"
                  onClick={next}
                  className={`flex-1 ${actionClass}`}
                >
                  <span className="flex items-center justify-center gap-2">
                    NEXT
                    <ChevronRight size={18} />
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={requestFinalSubmit}
                  className={`flex-1 ${actionClass}`}
                >
                  <span className="flex items-center justify-center gap-2">
                    <ClipboardCheck size={20} strokeWidth={2.1} />
                    FINAL SUBMIT
                  </span>
                </button>
              )}
            </>
          ) : !submitted ? (
            // Guide/direct: not yet submitted → SUBMIT button
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!timerEnabled || (selected === null && secondsLeft > HALF_TIME)}
              className={`w-full ${actionClass} disabled:cursor-not-allowed disabled:opacity-100`}
            >
              SUBMIT
            </button>
          ) : isSolveLink && index === 0 ? (
            // Solve link: first question answered → single full-width SOLVE MORE
            <button
              type="button"
              onClick={next}
              className={`w-full ${solveMoreClass}`}
            >
              <span className="flex items-center justify-center gap-2">
                SOLVE MORE
                <ChevronRight size={18} />
              </span>
            </button>
          ) : index < pool.length - 1 ? (
            // Guide/direct: submitted, not last question
            <>
              <button
                type="button"
                onClick={previous}
                disabled={index === 0}
                className={`flex-1 ${actionClass} disabled:cursor-not-allowed`}
                aria-label="Previous question"
              >
                <span className="flex items-center justify-center gap-2">
                  <ChevronLeft size={18} />
                  PREV
                </span>
              </button>

              <button
                type="button"
                onClick={next}
                className={`flex-1 ${actionClass}`}
              >
                <span className="flex items-center justify-center gap-2">
                  NEXT
                  <ChevronRight size={18} />
                </span>
              </button>

              {/* Early exit button (non-last question) */}
              <button
                type="button"
                onClick={() => setShowEarlyConfirm(true)}
                className={`w-14 shrink-0 ${actionClass} px-2`}
                aria-label="Final submit"
              >
                <ClipboardCheck className="mx-auto" size={22} strokeWidth={2.1} />
              </button>
            </>
          ) : (
            // Guide/direct: submitted, last question → FINAL SUBMIT (no modal if all answered)
            <>
              <button
                type="button"
                onClick={previous}
                className={`flex-1 ${actionClass}`}
                aria-label="Previous question"
              >
                <span className="flex items-center justify-center gap-2">
                  <ChevronLeft size={18} />
                  PREV
                </span>
              </button>

              <button
                type="button"
                onClick={requestFinalSubmit}
                className={`flex-1 ${actionClass}`}
              >
                <span className="flex items-center justify-center gap-2">
                  <ClipboardCheck size={22} strokeWidth={2.1} />
                  FINAL SUBMIT
                </span>
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}