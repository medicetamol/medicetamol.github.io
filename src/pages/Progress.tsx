import { Activity, BarChart3, CheckCircle2, Target, Trash2, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { getAllAnswers, getAllBookmarks, getDailyActivity, getLifetimeStats, clearSubjectProgress, STREAK_DAILY_GOAL } from "../lib/db";
import { SUBJECTS, EXAM_PREFIX, EXAMS } from "../constants";
import Streak from "../components/Streak";
import manifest from "../data/manifest.json";
import type { DailyActivity, LifetimeStats, QuestionAnswer, Exam } from "../types";

// ─── Confirm modal ────────────────────────────────────────────────────────────

function ClearConfirmModal({
  subjectName,
  onConfirm,
  onCancel,
}: {
  subjectName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        {/* Dustbin icon */}
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-red-900/60 bg-red-950/40">
          <Trash2 size={26} className="text-red-400" strokeWidth={1.6} />
        </div>

        <h2 className="text-center text-lg font-semibold text-slate-100">Are you sure?</h2>
        <p className="mt-2 text-center text-sm leading-6 text-slate-400">
          {subjectName} progress will be cleared.
          <br />
          Once cleared, it can't be revived.
          <br />
          <span className="text-slate-500">
            But you can solve again, and progress will be updated.
          </span>
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl border border-red-800/60 bg-red-950/40 px-4 py-3 text-sm font-semibold text-red-300 hover:bg-red-900/40"
          >
            Yes
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-100"
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Progress() {
  const location = useLocation();
  const locationState = location.state as {
    scrollToSubjects?: boolean;
    highlightSubject?: string;
  } | null;

  const [answers, setAnswers] = useState<QuestionAnswer[]>([]);
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [activity, setActivity] = useState<DailyActivity[]>([]);
  const [lifetime, setLifetime] = useState<LifetimeStats>({ id: "lifetime", totalSolved: 0, totalCorrect: 0 });
  const [clearTarget, setClearTarget] = useState<{
    subjectId: string;
    subjectName: string;
  } | null>(null);
  const [clearing, setClearing] = useState(false);

  const subjectsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([getAllAnswers(), getAllBookmarks(), getDailyActivity(), getLifetimeStats()]).then(
      ([a, b, act, lt]) => {
        setAnswers(a);
        setBookmarkCount(b.length);
        setActivity(act);
        setLifetime(lt);
      }
    );
  }, []);

  // Scroll to subjects section when arriving from Subject.tsx link
  useEffect(() => {
    if (locationState?.scrollToSubjects && subjectsRef.current) {
      setTimeout(() => {
        subjectsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    }
  }, [locationState?.scrollToSubjects]);

  const directAnswered = answers.length;
  const directCorrect = answers.filter((a) => a.incorrect === undefined).length;
  const directIncorrect = directAnswered - directCorrect;
  const bookmarks = bookmarkCount;

  // Top metrics reflect lifetime solving anywhere on the site — a running
  // counter that survives subject-clear and future dailyActivity pruning.
  // The weekly chart still reads from dailyActivity (that's exactly what it's for).
  const totalQuestions = lifetime.totalSolved;
  const totalCorrect = lifetime.totalCorrect;
  const overallAccuracy = totalQuestions ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayActivity = activity.find((a) => a.date === todayKey);
  const todayCount = (todayActivity?.correct ?? 0) + (todayActivity?.incorrect ?? 0);
  const streakGoalMet = todayCount >= STREAK_DAILY_GOAL;

  const [selectedExam, setSelectedExam] = useState<Exam>("NEET-PG");

  const subjectStats = SUBJECTS.map((subject) => {
    const examPrefix = EXAM_PREFIX[selectedExam];
    const prefix = `${examPrefix}${subject.code}`;
    const rows = answers.filter((a) => a.qid.slice(0, 4) === prefix);
    const qids = rows.map((a) => a.qid);
    const attempts = rows.length;
    const c = rows.filter((a) => a.incorrect === undefined).length;
    // Total available PYQs for this subject, within the selected exam only.
    const manifestData = manifest as Record<string, Record<string, { total: number }>>;
    const totalAvailable = manifestData[selectedExam]?.[subject.id]?.total ?? 0;
    return {
      ...subject,
      qids,
      attempts,
      correct: c,
      accuracy: attempts ? Math.round((c / attempts) * 100) : null,
      solvedPercent: totalAvailable ? Math.round((attempts / totalAvailable) * 100) : 0,
    };
  })
    .filter((s) => s.attempts > 0)
    .sort((a, b) => a.solvedPercent - b.solvedPercent);

  const weekly = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    const row = activity.find((a) => a.date === key);
    return {
      date: key,
      total: (row?.correct ?? 0) + (row?.incorrect ?? 0),
    };
  });

  // Single-tap handler for subject rows — opens confirmation modal directly
  const handleSubjectTap = (subjectId: string, subjectName: string) => {
    setClearTarget({ subjectId, subjectName });
  };

  const handleConfirmClear = async () => {
    if (!clearTarget || clearing) return;
    setClearing(true);

    const subject = subjectStats.find((s) => s.id === clearTarget.subjectId);
    if (subject) {
      await clearSubjectProgress(subject.qids);
    }

    // Refresh answers (bookmarks are untouched by a subject clear)
    const a = await getAllAnswers();
    setAnswers(a);
    setClearing(false);
    setClearTarget(null);
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-7">
        <h1 className="text-2xl font-bold">Progress</h1>
        <p className="mt-1 text-sm text-slate-500">Your overall performance and activity.</p>
        <p className="mt-1 text-sm text-slate-500">Let's get 1% better each day.</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric icon={Activity} label="Questions" value={totalQuestions} />
        <Metric icon={CheckCircle2} label="Correct" value={totalCorrect} />
        <Metric icon={Target} label="Accuracy" value={`${overallAccuracy}%`} />
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
          <Streak size="sm" />
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-center">
        <p className="text-xs uppercase tracking-wide text-slate-500">Daily Target</p>
        <p className="mt-1 text-sm font-semibold text-slate-200">
          {streakGoalMet ? "Streak complete" : `${todayCount}/${STREAK_DAILY_GOAL} Questions Completed`}
        </p>
        {!streakGoalMet && (
          <p className="mt-1 text-xs text-slate-500">Complete this to maintain your streak</p>
        )}
      </div>

      {/* Weekly chart */}
      <section className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold">This week</h2>
            <p className="mt-1 text-xs text-slate-500">PYQs solved per day</p>
          </div>
          <BarChart3 size={19} className="text-slate-500" />
        </div>

        <div className="mt-6 flex h-36 items-end gap-2">
          {weekly.map((day) => {
            const max = Math.max(1, ...weekly.map((x) => x.total));
            const height = Math.max(5, (day.total / max) * 100);
            return (
              <div
                key={day.date}
                className="flex h-full flex-1 flex-col items-center justify-end gap-2"
              >
                <span className="text-[10px] text-slate-500">{day.total || ""}</span>
                <div
                  className="w-full rounded-t-md bg-slate-700"
                  style={{ height: `${height}%` }}
                />
                <span className="text-[9px] text-slate-600">{day.date.slice(5)}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Performance + Subjects */}
      <section className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <h2 className="font-bold">Performance</h2>
          <p className="mt-1 text-xs text-slate-500">Direct QBank only</p>
          <div className="mt-4 space-y-3">
            <Row icon={CheckCircle2} label="Correct attempts" value={directCorrect} />
            <Row icon={XCircle} label="Incorrect attempts" value={directIncorrect} />
            <Row icon={Target} label="Bookmarks" value={bookmarks} />
          </div>
        </div>

        {/* Subjects section */}
        <div ref={subjectsRef} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <h2 className="font-bold">Subjectwise Progress</h2>

          <div className="mt-3 flex gap-1 rounded-xl border border-slate-800 bg-slate-950 p-1">
            {EXAMS.map((exam) => (
              <button
                key={exam.id}
                type="button"
                onClick={() => setSelectedExam(exam.id)}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  selectedExam === exam.id
                    ? "bg-slate-800 text-white"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {exam.name}
              </button>
            ))}
          </div>

          {subjectStats.length === 0 ? (
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Subject-level performance will appear after you solve {EXAMS.find((e) => e.id === selectedExam)?.name} PYQs directly from
              the QBank.
            </p>
          ) : (
            <>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Click on the subject to get options to clear records.
              </p>
              <p className="text-sm leading-6 text-slate-400">
                Once cleared, history can't be revived. But you can solve again and that will reflect in progress.
              </p>

              <div className="mt-3 space-y-2">
                {subjectStats.map((s) => {
                  const isHighlighted = locationState?.highlightSubject === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSubjectTap(s.id, s.name)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                        isHighlighted
                          ? "bg-slate-800 ring-1 ring-slate-600"
                          : "bg-slate-950 hover:bg-slate-900"
                      }`}
                    >
                      <span className="flex-1 text-sm text-slate-300">{s.name}</span>
                      <span className="text-xs text-slate-500">{s.attempts} Q</span>
                      <b className="text-xs">{s.solvedPercent}% solved</b>
                      <Trash2 size={15} className="ml-1 shrink-0 text-red-400/70" strokeWidth={1.8} />
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>

      {/* Clear confirm modal */}
      {clearTarget && (
        <ClearConfirmModal
          subjectName={clearTarget.subjectName}
          onConfirm={() => void handleConfirmClear()}
          onCancel={() => setClearTarget(null)}
        />
      )}
    </main>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
      <Icon size={18} className="text-slate-500" />
      <p className="mt-4 text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-slate-950 p-3">
      <Icon size={17} className="text-slate-500" />
      <span className="flex-1 text-sm text-slate-400">{label}</span>
      <b className="text-sm">{value}</b>
    </div>
  );
}