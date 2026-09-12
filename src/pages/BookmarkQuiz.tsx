import {
  ArrowLeft,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  CornerRightUp,
  Loader2,
  Pause,
  Play,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getSubject, SUBJECTS, EXAM_PREFIX } from "../constants";
import {
  findQuestion,
  hasDetailedExplanation,
  loadDetailedExplanation,
  loadExplanations,
} from "../data/questions";
import { getAllQuestionProgress, toggleBookmark } from "../lib/db";
import QuestionCard from "../components/QuestionCard";
import MarkdownContent from "../components/MarkdownContent";
import { formatQuestionForShare, getSiteUrl, shareOrCopy } from "../lib/sharing";
import type { Exam, PYQQuestion, QuizAnswer } from "../types";

const SECONDS_PER_QUESTION = 60;
const LAST_TEN_SECONDS = 10;

// ─── Bookmark-only helper: decode {exam, subjectId} from a qid, since a
// bookmarked subject can span multiple exams (unlike the rest of the app,
// which is always single-exam-scoped via the URL). Reuses the same fixed
// 2+2+3 char qid format and centralized EXAM_PREFIX map as questions.ts. ──
function decodeQid(qid: string): { exam: Exam; subjectId: string } | null {
  if (qid.length < 4) return null;
  const examPrefix = qid.slice(0, 2);
  const exam = (Object.keys(EXAM_PREFIX) as Exam[]).find((e) => EXAM_PREFIX[e] === examPrefix);
  if (!exam) return null;
  const code = qid.slice(2, 4).toUpperCase();
  const subject = SUBJECTS.find((s) => s.code === code);
  if (!subject) return null;
  return { exam, subjectId: subject.id };
}

type LoadState = "loading" | "ready" | "empty";

// ─── Craft step: subject header + topic filter + "Solve Module" ──
export default function BookmarkQuiz() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const navigate = useNavigate();
  const subject = getSubject(subjectId ?? "");

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [bundle, setBundle] = useState<PYQQuestion[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string>("all");
  const [started, setStarted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!subjectId) return;

    setLoadState("loading");
    getAllQuestionProgress().then(async (items) => {
      if (cancelled) return;
      const bookmarkedIds = items.filter((p) => p.bookmarked).map((p) => p.qid);
      const relevantIds = bookmarkedIds.filter((qid) => decodeQid(qid)?.subjectId === subjectId);
      const resolved = await Promise.all(relevantIds.map((id) => findQuestion(id)));
      const questions = resolved.filter((q): q is PYQQuestion => Boolean(q));

      if (cancelled) return;
      setBundle(questions);
      setLoadState(questions.length ? "ready" : "empty");
    });

    return () => { cancelled = true; };
  }, [subjectId]);

  const topics = useMemo(() => {
    return Array.from(
      new Map(bundle.map((q) => [q.topicId, q.topicName ?? q.topicId])).entries()
    );
  }, [bundle]);

  const filtered = useMemo(() => {
    return selectedTopic === "all" ? bundle : bundle.filter((q) => q.topicId === selectedTopic);
  }, [bundle, selectedTopic]);

  if (!subject) return null;

  if (started) {
    return <ReviewSession questions={filtered} onExit={() => setStarted(false)} />;
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <button
        type="button"
        onClick={() => navigate("/bookmarks")}
        className="mb-6 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-200"
      >
        <ArrowLeft size={16} /> Bookmarks
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold">{subject.name}</h1>
        {loadState === "loading" ? (
          <p className="mt-1 flex items-center gap-2 text-sm text-slate-500">
            <Loader2 size={14} className="animate-spin" /> Crafting QBank only for you…
          </p>
        ) : (
          <p className="mt-1 text-sm text-slate-500">
            {bundle.length} bookmarked PYQ{bundle.length === 1 ? "" : "s"}
          </p>
        )}
      </div>

      {loadState === "empty" && (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-8 text-center">
          <Bookmark className="mx-auto text-slate-600" size={30} />
          <h3 className="mt-3 font-semibold text-slate-200">No bookmarks found</h3>
          <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">
            This subject has no bookmarked questions right now.
          </p>
        </div>
      )}

      {loadState !== "empty" && (
        <>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedTopic("all")}
                disabled={loadState === "loading"}
                className={`rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-40 ${selectedTopic === "all" ? "bg-slate-100 text-slate-950" : "bg-slate-800 text-slate-300"}`}
              >
                All topics
              </button>
              {topics.map(([id, name]) => (
                <button
                  key={id}
                  onClick={() => setSelectedTopic(id)}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold ${selectedTopic === id ? "bg-slate-100 text-slate-950" : "bg-slate-800 text-slate-300"}`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-4 py-3">
            <span className="text-sm text-slate-400">
              {loadState === "loading" ? "Preparing…" : `${filtered.length} question${filtered.length === 1 ? "" : "s"} selected`}
            </span>
            <button
              type="button"
              onClick={() => setStarted(true)}
              disabled={loadState === "loading" || filtered.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-xs font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loadState === "loading" ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
              Solve Module
            </button>
          </div>
        </>
      )}
    </main>
  );
}

// ─── Review session: rebuilt directly from Quiz.tsx's guide-mode logic and
// JSX (header timer bar, question card, explanation section, bottom nav),
// with two differences: (1) each question carries its own `exam`/`subjectId`
// instead of one page-level examId, since a subject's bookmarks can span
// multiple exams; (2) no progress writes, no IndexedDB answer-restore, no
// fullscreen/quiz-mode branches — this is guide-mode-only, review-only. ──
function ReviewSession({
  questions,
  onExit,
}: {
  questions: PYQQuestion[];
  onExit: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  // Every question entering this session came from a bookmark; track
  // removals locally so Prev/Next reflects unbookmarking done mid-session.
  const [bookmarkedSet, setBookmarkedSet] = useState<Set<string>>(
    () => new Set(questions.map((q) => q.id))
  );
  const [feedback, setFeedback] = useState("");

  const [timerEnabled, setTimerEnabled] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(SECONDS_PER_QUESTION);

  const [detailedExplanation, setDetailedExplanation] = useState<string | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const selectedRef = useRef<number | null>(null);
  const answersRef = useRef<QuizAnswer[]>([]);
  const submittedRef = useRef(false);
  const feedbackTimerRef = useRef<number | null>(null);

  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { submittedRef.current = submitted; }, [submitted]);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  const question = questions[index];
  const bookmarked = question ? bookmarkedSet.has(question.id) : false;

  useEffect(() => {
    if (!question) return;
    const previousAnswer = answersRef.current.find((a) => a.qid === question.id);
    const restoredSelection = previousAnswer?.selected ?? null;
    selectedRef.current = restoredSelection;
    submittedRef.current = Boolean(previousAnswer);
    setSelected(restoredSelection);
    setSubmitted(Boolean(previousAnswer));
    setTimedOut(Boolean(previousAnswer && previousAnswer.selected === null));
    setSecondsLeft(SECONDS_PER_QUESTION);
    setTimerEnabled(true);
    setFeedback("");
  }, [index, question?.id]);

  useEffect(() => {
    setDetailedExplanation(null);
    setShowDetails(false);
    setLoadingDetails(false);
  }, [question?.id]);

  useEffect(() => {
    if (!timerEnabled || submitted || !question) return;
    if (secondsLeft <= 0) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((value) => (value <= 1 ? 0 : value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [timerEnabled, submitted, question?.id, secondsLeft]);

  useEffect(() => {
    if (submitted || !question) return;
    if (secondsLeft > 0) return;
    submitCurrent(selectedRef.current, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted, question?.id, secondsLeft]);

  const [explanations, setExplanations] = useState<Awaited<ReturnType<typeof loadExplanations>>>([]);

  useEffect(() => {
    if (!question) {
      setExplanations([]);
      return;
    }
    let cancelled = false;
    loadExplanations(question.exam, question.subjectId).then((result) => {
      if (!cancelled) setExplanations(result);
    });
    return () => { cancelled = true; };
  }, [question?.exam, question?.subjectId]);

  const explanation = question
    ? explanations.find((x) => x.id === question.id)
    : undefined;

  const detailedAvailable = Boolean(
    question && hasDetailedExplanation(question.exam, question.subjectId, question.id)
  );

  const showFeedback = useCallback((message: string) => {
    if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
    setFeedback(message);
    feedbackTimerRef.current = window.setTimeout(() => setFeedback(""), 1200);
  }, []);

  function submitCurrent(choice: number | null = selectedRef.current, timeout = false) {
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
    setTimedOut(choice === null);
    if (timeout) setSecondsLeft(0);
  }

  const applyQuestionState = useCallback((targetQuestion: PYQQuestion) => {
    const previousAnswer = answersRef.current.find((a) => a.qid === targetQuestion.id);
    const restoredSelection = previousAnswer?.selected ?? null;
    selectedRef.current = restoredSelection;
    setSelected(restoredSelection);
    submittedRef.current = Boolean(previousAnswer);
    setSubmitted(Boolean(previousAnswer));
    setTimedOut(Boolean(previousAnswer && previousAnswer.selected === null));
  }, []);

  const next = useCallback(() => {
    if (index >= questions.length - 1) return;
    applyQuestionState(questions[index + 1]);
    setIndex((i) => i + 1);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [index, questions, applyQuestionState]);

  const previous = useCallback(() => {
    if (index <= 0) return;
    applyQuestionState(questions[index - 1]);
    setIndex((i) => i - 1);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [index, questions, applyQuestionState]);

  const handleSubmit = () => {
    if (submittedRef.current || !timerEnabled) return;
    submitCurrent(selectedRef.current);
  };

  const handleOptionSelect = (choice: number) => {
    if (submittedRef.current) return;
    if (selectedRef.current === choice) {
      selectedRef.current = null;
      setSelected(null);
      return;
    }
    selectedRef.current = choice;
    setSelected(choice);
  };

  const toggleDetails = async () => {
    if (!question || !detailedAvailable) return;
    if (showDetails) { setShowDetails(false); return; }
    if (!detailedExplanation) {
      setLoadingDetails(true);
      const content = await loadDetailedExplanation(question.exam, question.subjectId, question.id);
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
    setBookmarkedSet((prev) => {
      const next = new Set(prev);
      if (result.bookmarked) next.add(question.id);
      else next.delete(question.id);
      return next;
    });
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const timerProgress = (secondsLeft / SECONDS_PER_QUESTION) * 100;
  const danger = secondsLeft <= LAST_TEN_SECONDS && !submitted;

  const actionClass =
    "rounded-xl border border-slate-700 bg-slate-800 px-4 py-3.5 text-sm font-semibold text-slate-200 hover:bg-slate-750";

  if (!question) {
    return (
      <main className="mx-auto max-w-3xl px-3 py-12 text-center">
        <h1 className="text-xl font-bold">No questions in this set</h1>
        <button
          type="button"
          onClick={onExit}
          className="mt-5 inline-flex rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-950"
        >
          Back
        </button>
      </main>
    );
  }

  return (
    <main className="relative mx-auto min-h-screen w-full max-w-4xl px-1 pb-24 sm:px-2">

      <div className={!submitted ? "sticky top-16 z-30 -mx-1 bg-[#080b10]/95 px-1 pb-1 pt-[0.5px] backdrop-blur" : ""}>
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
          <button
            type="button"
            onClick={onExit}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-300"
            aria-label="Back to bookmarks"
          >
            <ChevronLeft size={14} />
            {index + 1}/{questions.length}
          </button>
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
              className="rounded-lg p-2 text-sky-400 transition-colors hover:text-sky-300"
              aria-label={bookmarked ? "Remove bookmark" : "Bookmark"}
            >
              <Bookmark size={21} strokeWidth={1.8} fill={bookmarked ? "currentColor" : "none"} />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-2">
        <QuestionCard
          key={question.id}
          question={question}
          selected={selected}
          submitted={submitted}
          timedOut={timedOut}
          bookmarked={bookmarked}
          onSelect={handleOptionSelect}
          onBookmark={bookmark}
          hasDetailedExplanation={detailedAvailable}
          onShareFeedback={showFeedback}
        />

        {submitted && question && (
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

      <div
        className={`pointer-events-none fixed bottom-[5.25rem] left-1/2 z-40 -translate-x-1/2 rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-2 text-xs text-slate-200 shadow-lg transition-opacity ${
          feedback ? "opacity-100" : "opacity-0"
        }`}
        aria-live="polite"
      >
        {feedback}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-900 bg-[#080b10]/95 px-1.5 py-2 backdrop-blur sm:px-2">
        <div className="mx-auto flex max-w-4xl items-stretch gap-2">
          <button
            type="button"
            onClick={previous}
            disabled={index === 0}
            className={`flex-[1] ${actionClass} disabled:cursor-not-allowed disabled:opacity-40 px-2`}
            aria-label="Previous question"
          >
            <ChevronLeft size={18} className="mx-auto" />
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitted}
            className={`flex-[3] ${actionClass} disabled:cursor-not-allowed disabled:opacity-40`}
          >
            SUBMIT
          </button>

          <button
            type="button"
            onClick={next}
            disabled={index === questions.length - 1}
            className={`flex-[1] ${actionClass} disabled:cursor-not-allowed disabled:opacity-40 px-2`}
            aria-label="Next question"
          >
            <ChevronRight size={18} className="mx-auto" />
          </button>
        </div>
      </div>
    </main>
  );
}