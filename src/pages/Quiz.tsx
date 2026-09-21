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
  loadQuestions,
  hasDetailedExplanation,
  loadDetailedExplanation,
  loadExplanations,
} from "../data/questions";
import {
  getQuestionAnswer,
  getAllAnswers,
  isBookmarked,
  recordDailyActivity,
  recordDirectAnswer,
  saveQuizResult,
  toggleBookmark,
} from "../lib/db";
import { useEffect, useRef, useState, useCallback } from "react";
import QuestionCard from "../components/QuestionCard";
import MarkdownContent from "../components/MarkdownContent";
import type { Exam, PYQQuestion, QuizAnswer } from "../types";
import { SUBJECTS } from "../constants";
import { formatQuestionForShare, getSiteUrl, shareOrCopy } from "../lib/sharing";
import { isStandalone } from "../lib/pwa";

// ─── helpers ────────────────────────────────────────────────────────────────

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

const SECONDS_PER_QUESTION = 60;
const LAST_TEN_SECONDS = 10;

// ─── Quiz mode derivation ────────────────────────────────────────────────────
// source=custom  → custom module (ids param present)
// source=direct  → normal PYQ drill (default)
// mode=quiz      → exam mode (global timer, no per-Q submit, no live marking)
// mode=guide     → guide mode (per-question timer, submit, explanation live)  ← default for custom
// For direct PYQ sessions mode is always "guide" behaviour (with submit).

// ─── Fullscreen helpers ──────────────────────────────────────────────────────

// History entries kept "in reserve" under a custom-module quiz so Back can be intercepted
// (Back then lands on one of these, fires popstate, and the page reacts instead of leaving).
const TRAP_RESERVE = 3;
type TrapState = { mediCetamolQuiz?: boolean; depth?: number } | null;

function requestFS() {
  if (isStandalone()) return; // installed app: no forced fullscreen
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
  const [targetQuestion, setTargetQuestion] = useState<PYQQuestion | undefined>(undefined);
  const [targetReady, setTargetReady] = useState(!questionId);

  useEffect(() => {
    if (!questionId) {
      setTargetQuestion(undefined);
      setTargetReady(true);
      return;
    }
    let cancelled = false;
    setTargetReady(false);
    findQuestion(questionId).then((result) => {
      if (cancelled) return;
      setTargetQuestion(result);
      setTargetReady(true);
    });
    return () => { cancelled = true; };
  }, [questionId]);

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
  const [pool, setPool] = useState<PYQQuestion[]>([]);
  const [poolReady, setPoolReady] = useState(false);

  useEffect(() => {
    if (!examId || !targetReady) return;
    let cancelled = false;
    setPoolReady(false);

    (async () => {
      let result: PYQQuestion[];

      if (isSolveLink) {
        if (!targetQuestion) {
          result = [];
        } else {
          const subjectQuestions = await loadQuestions(examId, targetQuestion.subjectId);
          if (cancelled) return;
          const topicQuestions = subjectQuestions.filter((q) => q.topicId === targetQuestion.topicId);
          const candidates = topicQuestions.length >= 5 ? topicQuestions : subjectQuestions;
          const remaining = shuffle(candidates.filter((q) => q.id !== targetQuestion.id)).slice(0, 4);
          result = [targetQuestion, ...remaining];
        }
      } else if (isCustom) {
        // Only fetch the subjects actually referenced by the id list — decode
        // subject from each id's 2-letter code (qid format: exam+subject+serial).
        const neededSubjectIds = Array.from(
          new Set(
            ids
              .map((id) => {
                const code = id.slice(2, 4);
                return SUBJECTS.find((s) => s.code === code)?.id;
              })
              .filter((s): s is string => Boolean(s))
          )
        );
        const bySubject = await Promise.all(
          neededSubjectIds.map((sid) => loadQuestions(examId, sid))
        );
        if (cancelled) return;
        const loaded = bySubject.flat();
        // Maintain the order from the ids param (already shuffled in ModuleBuilder)
        result = ids
          .map((id) => loaded.find((q) => q.id === id))
          .filter((q): q is PYQQuestion => q !== undefined);
      } else {
        // Direct PYQ: only the one subject from the route param, serial order
        const questions = await loadQuestions(examId, subjectId ?? "");
        if (cancelled) return;
        result = topic !== "all" ? questions.filter((q) => q.topicId === topic) : questions;
      }

      if (cancelled) return;
      setPool(result);
      setPoolReady(true);
    })();

    return () => { cancelled = true; };
  }, [examId, targetReady, isSolveLink, targetQuestion?.id, isCustom, ids.join(","), subjectId, topic]);

  // ── Restore starting index for direct PYQ (first unanswered) ──
  const [startIndexReady, setStartIndexReady] = useState(isSolveLink || isCustom);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (isSolveLink || isCustom || pool.length === 0) return;
    getAllAnswers().then((allAnswers) => {
      const answeredSet = new Set(allAnswers.map((a) => a.qid));
      const firstUnanswered = pool.findIndex((q) => !answeredSet.has(q.id));
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

  // pool loads asynchronously — totalSeconds is 0 on first render (pool still empty),
  // so the useState initializer above locks in 0 permanently unless we resync here.
  useEffect(() => {
    if (poolReady) setGlobalSecondsLeft(totalSeconds);
  }, [poolReady, totalSeconds]);

  // Modals
  const [showEarlyConfirm, setShowEarlyConfirm] = useState(false);
  const [showFinalConfirm, setShowFinalConfirm] = useState(false); // unanswered questions warning
  const [showFSExitModal, setShowFSExitModal] = useState(false);

  // Back-button handling reads these from inside a long-lived popstate listener.
  const fsModalOpenRef = useRef(false);        // is the "Continue where you left" modal open?
  const fsModalOpenedAtRef = useRef(0);        // when it opened (ms)
  const backSubmitRef = useRef(false);         // Back already triggered a submit
  const finishQuizRef = useRef<() => Promise<void>>(async () => {});
  const finishingRef = useRef(false);        // quiz is being submitted — ignore fullscreen/back events
  const trapDepthRef = useRef(0);              // reserve entries currently below the quiz
  const topUpTraps = useCallback((force = false) => {
    // Chrome flags history entries a page adds WITHOUT a user gesture and skips them on Back
    // (Back then leaves the app instead of reaching the page). So the reserve is only built
    // while there is transient user activation (any tap/click); `force` is a last resort.
    const ua = (navigator as Navigator & { userActivation?: { isActive: boolean } }).userActivation;
    if (!force && ua && !ua.isActive) return;
    while (trapDepthRef.current < TRAP_RESERVE) {
      trapDepthRef.current += 1;
      window.history.pushState(
        { mediCetamolQuiz: true, depth: trapDepthRef.current },
        "",
        window.location.href
      );
    }
  }, []);
  useEffect(() => {
    fsModalOpenRef.current = showFSExitModal;
    if (showFSExitModal) fsModalOpenedAtRef.current = Date.now();
  }, [showFSExitModal]);

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

  // ── Prevent browser back (custom modules + solve links) ──
  // Custom modules: block back entirely to protect an in-progress timed quiz.
  // Solve links (shared /solve/:id, including "PYQ of the Day"): back should
  // feel like leaving the site into the app, not getting stuck — so instead
  // of re-trapping the URL, send them to the homepage.
  useEffect(() => {
    if (!pool.length) return;
    // Direct PYQ: allow native back navigation
    if (!isCustom && !isSolveLink) return;

    if (isSolveLink) {
      const state = { mediCetamolQuiz: true };
      window.history.pushState(state, "", window.location.href);
      const goHome = () => navigate("/", { replace: true });
      window.addEventListener("popstate", goHome);
      return () => window.removeEventListener("popstate", goHome);
    }

    // Custom module: keep a reserve of history entries under the quiz (built on user taps).
    const current = window.history.state as TrapState;
    trapDepthRef.current = current?.mediCetamolQuiz ? (current.depth ?? 0) : 0;
    topUpTraps();
    const onClick = () => topUpTraps();

    const onBack = (e: PopStateEvent) => {
      if (finishingRef.current) return; // submitting — let navigation proceed untouched
      // Back consumed one reserve entry — work out how many remain from where we landed.
      const landed = e.state as TrapState;
      trapDepthRef.current = landed?.mediCetamolQuiz ? (landed.depth ?? 0) : 0;

      // Back while the "Continue where you left" modal is already open: submit the module
      // instead of leaving the page, which would throw away every answer.
      if (fsModalOpenRef.current) {
        // Leaving fullscreen with Back can also deliver a popstate in the same gesture —
        // ignore anything arriving right after the modal opened.
        if (Date.now() - fsModalOpenedAtRef.current < 600) {
          if (trapDepthRef.current === 0) topUpTraps(true);
          return;
        }
        if (!backSubmitRef.current) {
          backSubmitRef.current = true;
          void finishQuizRef.current();
        }
        return;
      }

      // No fullscreen to exit (installed app, or fullscreen unavailable): the first Back
      // opens the same modal — timer pauses, Exit submits the module, Go Back resumes.
      // (While in fullscreen, leaving fullscreen is what opens it.)
      if (isStandalone() || !isFullscreen()) {
        if (isQuizMode) setGlobalTimerRunning(false);
        else setTimerEnabled(false);
        setShowFSExitModal(true);
      }

      // Nothing left in reserve: last resort so the next Back is still caught. Normally the
      // reserve is refilled by the next tap ("Go Back" included), which is gesture-backed.
      if (trapDepthRef.current === 0) topUpTraps(true);
    };
    window.addEventListener("popstate", onBack);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("popstate", onBack);
      document.removeEventListener("click", onClick, true);
    };
  }, [pool.length, index, isCustom, isSolveLink, isQuizMode, navigate, topUpTraps]);

  // ── Fullscreen management (custom modules only) ──
  useEffect(() => {
    if (!isCustom || isStandalone()) return; // installed app never enters fullscreen
    const onFSChange = () => {
      if (finishingRef.current) return; // we exited fullscreen ourselves on submit
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

    isBookmarked(question.id).then(setBookmarked).catch(() => setBookmarked(false));

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
      getQuestionAnswer(question.id).then((a) => {
        if (cancelled) return;
        if (a) {
          // Question was answered in a previous session — restore as "submitted".
          // `incorrect` holds the exact option picked when wrong; when absent
          // the question was answered correctly, so highlight the correct answer.
          const wasCorrect = a.incorrect === undefined;
          const syntheticAnswer: QuizAnswer = {
            qid: question.id,
            selected: wasCorrect ? question.answer : a.incorrect ?? null,
            correct: wasCorrect,
          };
          answersRef.current = [...answersRef.current.filter((x) => x.qid !== question.id), syntheticAnswer];
          selectedRef.current = syntheticAnswer.selected;
          submittedRef.current = true;
          setSelected(syntheticAnswer.selected);
          setSubmitted(true);
          setTimedOut(false); // a stored answer was always an actual pick, never a skip
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
    if (secondsLeft <= 0) return;

    const timer = window.setInterval(() => {
      setSecondsLeft((value) => (value <= 1 ? 0 : value - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isQuizMode, timerEnabled, submitted, question?.id, secondsLeft]);

  // React to the per-question timer hitting zero and auto-submit as skipped.
  // Kept as a separate effect (rather than nested inside the setSecondsLeft
  // updater above) so this real side effect always runs exactly once,
  // reliably flips `submitted`, and never leaves the question stuck.
  useEffect(() => {
    if (isQuizMode) return;
    if (submitted || !question) return;
    if (secondsLeft > 0) return;
    void submitCurrent(selectedRef.current, true);
  }, [isQuizMode, submitted, question?.id, secondsLeft]);

  // ── Global timer (quiz mode) ──
  useEffect(() => {
    if (!isQuizMode || !poolReady) return;

    const timer = window.setInterval(() => {
      if (!globalTimerRunningRef.current) return;
      setGlobalSecondsLeft((value) => (value <= 1 ? 0 : value - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isQuizMode, poolReady]);

  // Time up → submit. Kept out of the state updater above: calling finishQuiz (which sets
  // state and navigates) from inside an updater is a side effect during render.
  //
  // globalSecondsLeft starts at 0 (the pool is empty when the state is first created) and is
  // only filled in by the resync effect once the pool has loaded. Without the "armed" guard,
  // that initial 0 would be mistaken for "time is up" and the exam would submit itself the
  // moment it opened. So a 0 only counts as a timeout after we have seen a real value > 0.
  const timeUpArmedRef = useRef(false);
  useEffect(() => {
    if (!isQuizMode || !poolReady || pool.length === 0) return;
    if (globalSecondsLeft > 0) {
      timeUpArmedRef.current = true;
      return;
    }
    if (!timeUpArmedRef.current) return; // stale initial 0, not a real timeout
    void finishQuizRef.current();
  }, [isQuizMode, poolReady, pool.length, globalSecondsLeft]);

  // ─── Derived ────────────────────────────────────────────────────────────────

  const [explanations, setExplanations] = useState<Awaited<ReturnType<typeof loadExplanations>>>([]);

  useEffect(() => {
    if (!question || !examId) {
      setExplanations([]);
      return;
    }
    let cancelled = false;
    loadExplanations(examId, question.subjectId)
      .then((result) => { if (!cancelled) setExplanations(result); })
      .catch(() => { if (!cancelled) setExplanations([]); });
    return () => { cancelled = true; };
  }, [examId, question?.subjectId]);

  const explanation = question
    ? explanations.find((x) => x.id === question.id)
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
    // "Skipped" styling (sky, not green) applies whenever nothing was
    // selected at submit time — whether from the timer running out or the
    // user hitting Submit with no choice made.
    setTimedOut(choice === null);

    if (timeout) setSecondsLeft(0);

    // Persistence is best-effort: a storage failure must never break the quiz UI.
    try {
      if (!isCustom && !isSolveLink) {
        await recordDirectAnswer(question.id, correct, choice);
      }
      // Daily streak counts an actual attempt in any mode — Direct QBank,
      // custom module, or a shared /solve/:id link — but never a skip/timeout.
      if (choice !== null) {
        await recordDailyActivity(correct);
      }
    } catch (err) {
      console.error("Could not record answer", err);
    }
  }

  const finishQuiz = useCallback(async () => {
    if (finishingRef.current) return; // double-fire guard (timer + button + back)
    finishingRef.current = true;

    setShowFinalConfirm(false);
    setShowFSExitModal(false);
    setGlobalTimerRunning(false);
    setTimerEnabled(false);

    // For quiz mode: build final answers for all questions (unanswered = skipped)
    const finalAnswers: QuizAnswer[] = pool.map((q) => {
      const existing = answersRef.current.find((a) => a.qid === q.id);
      if (existing) return existing;
      return { qid: q.id, selected: null, correct: false };
    });

    // Saving must never block the user from seeing their result.
    try {
      await saveQuizResult({
        exam: examId,
        questionIds: pool.map((q) => q.id),
        answers: finalAnswers,
        customModule: isCustom,
        startedAt,
        finishedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("saveQuizResult failed", err);
    }

    // Navigate FIRST, leave fullscreen afterwards. Exiting fullscreen while the quiz
    // page is still mounted resizes the viewport and can leave a black frame on Android.
    navigate(`/result/${examId}`, {
      replace: true,
      state: {
        total: pool.length,
        answers: finalAnswers,
        questions: pool,
        custom: isCustom,
        examFinished: true,
      },
    });
    window.setTimeout(exitFS, 150);
  }, [pool, examId, isCustom, startedAt, navigate]);
  finishQuizRef.current = finishQuiz;

  // In quiz mode, save/update the current question's selection into answersRef.
  // Must overwrite any existing entry (not just add when missing) so that
  // changing a previously-picked answer and then navigating away persists the change.
  const flushCurrentQuizSelection = useCallback(() => {
    if (!question) return;
    const sel = selectedRef.current;
    const existing = answersRef.current.find((a) => a.qid === question.id);
    if (sel === null) {
      // No selection: drop any stale saved answer for this question so it stays unanswered.
      if (existing) {
        const nextAnswers = answersRef.current.filter((a) => a.qid !== question.id);
        answersRef.current = nextAnswers;
        setAnswers(nextAnswers);
      }
      return;
    }
    if (existing && existing.selected === sel) return; // already in sync
    const correct = sel === question.answer;
    const nextAnswers: QuizAnswer[] = [
      ...answersRef.current.filter((a) => a.qid !== question.id),
      { qid: question.id, selected: sel, correct },
    ];
    answersRef.current = nextAnswers;
    setAnswers(nextAnswers);
  }, [question]);

  const requestFinalSubmit = useCallback(() => {
    if (isQuizMode) {
      // Flush the current question's selection into answersRef before counting.
      // The last question has no NEXT button to trigger the flush that next() does,
      // so the selection lives only in selectedRef until we explicitly save it here.
      flushCurrentQuizSelection();
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

    // Guide / direct: answers are locked in once submitted, so there's nothing
    // to go back and change — skip the "you have N left" confirmation and
    // just finish directly.
    const isLast = index === pool.length - 1;
    if (isLast) {
      void finishQuiz();
      return;
    }

    // Early exit from non-last question
    setShowEarlyConfirm(true);
  }, [isQuizMode, index, pool, finishQuiz, flushCurrentQuizSelection]);

  // Compute and apply the (selected, submitted, timedOut) state for a target
  // question synchronously, in the same handler as setIndex, so the freshly
  // rendered question never briefly shows the previous question's state
  // (e.g. stale correct/wrong colors) before the effect corrects it.
  const applyQuestionState = useCallback((targetQuestion: PYQQuestion) => {
    const previousAnswer = answersRef.current.find((a) => a.qid === targetQuestion.id);
    const restoredSelection = previousAnswer?.selected ?? null;
    selectedRef.current = restoredSelection;
    setSelected(restoredSelection);
    if (isQuizMode) {
      submittedRef.current = false;
      setSubmitted(false);
      setTimedOut(false);
    } else {
      submittedRef.current = Boolean(previousAnswer);
      setSubmitted(Boolean(previousAnswer));
      setTimedOut(Boolean(previousAnswer && previousAnswer.selected === null));
      // Reset the timer in the same batch as the index change. If it were left at 0 (a
      // timed-out question), the new question would render with secondsLeft = 0 and the
      // auto-submit effect would instantly skip it — and every question after it.
      setSecondsLeft(SECONDS_PER_QUESTION);
    }
  }, [isQuizMode]);

  const next = useCallback(() => {
    if (isQuizMode) {
      // In quiz mode: save current selection then move on (no submit requirement)
      flushCurrentQuizSelection();
      if (index < pool.length - 1) {
        applyQuestionState(pool[index + 1]);
        setIndex((i) => i + 1);
        window.scrollTo({ top: 0, behavior: "auto" });
      }
      return;
    }
    if (!submittedRef.current || index >= pool.length - 1) return;
    applyQuestionState(pool[index + 1]);
    setIndex((i) => i + 1);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [isQuizMode, index, pool, flushCurrentQuizSelection, applyQuestionState]);

  const previous = useCallback(() => {
    if (isQuizMode) {
      if (index <= 0) return;
      flushCurrentQuizSelection();
      applyQuestionState(pool[index - 1]);
      setIndex((i) => i - 1);
      window.scrollTo({ top: 0, behavior: "auto" });
      return;
    }
    if (!submittedRef.current || index <= 0) return;
    applyQuestionState(pool[index - 1]);
    setIndex((i) => i - 1);
  }, [isQuizMode, index, pool, flushCurrentQuizSelection, applyQuestionState]);

  const handleSubmit = () => {
    if (submittedRef.current || !timerEnabled) return;
    void submitCurrent(selectedRef.current);
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
  const isBlurred = (isCustom && showFSExitModal) ||
    (isQuizMode && !globalTimerRunning && !showFSExitModal);

  const actionClass =
    "rounded-xl border border-slate-700 bg-slate-800 px-4 py-3.5 text-sm font-semibold text-slate-200 hover:bg-slate-750";
  const solveMoreClass =
    "rounded-xl border border-slate-200 bg-slate-100 px-4 py-3.5 text-sm font-bold text-slate-950 shadow-lg shadow-slate-200/20 hover:bg-slate-50";

  // ─── Unanswered count (for quiz mode submit) ──────────────────────────────
  const unansweredCount = pool.filter(
    (q) => !answersRef.current.find((a) => a.qid === q.id && a.selected !== null)
  ).length;

  if (!startIndexReady || !poolReady || !pool.length) {
    if (!startIndexReady || !poolReady) {
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
    <main className="relative mx-auto min-h-screen w-full max-w-4xl px-1 pb-24 sm:px-2">

      {/* ── Global timer bar (quiz mode) ── */}
      {isQuizMode && (
        <div className="sticky top-14 z-30 -mx-1 bg-page-deep/95 px-1 pb-1 pt-[0.5px] backdrop-blur">
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
        <div className={!submitted ? "sticky top-14 z-30 -mx-1 bg-page-deep/95 px-1 pb-1 pt-[0.5px] backdrop-blur" : ""}>
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
          key={question.id}
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
                className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 shadow-sm transition-colors hover:bg-slate-700 hover:text-slate-50 active:bg-slate-700"
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
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-900 bg-page-deep/95 px-1.5 py-2 backdrop-blur sm:px-2">
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
              disabled={!timerEnabled}
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