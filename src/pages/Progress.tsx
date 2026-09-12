import { Activity, BarChart3, CheckCircle2, Flame, Target, Trash2, XCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { getAllQuestionProgress, getDailyActivity, clearSubjectProgress } from "../lib/db";
import { SUBJECTS, EXAM_PREFIX } from "../constants";
import type { DailyActivity, QuestionProgress, Exam } from "../types";

const EXAMS: Exam[] = ["NEET-PG", "INI-CET", "FMGE"];

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

  const [progress, setProgress] = useState<QuestionProgress[]>([]);
  const [activity, setActivity] = useState<DailyActivity[]>([]);
  const [clearTarget, setClearTarget] = useState<{
    subjectId: string;
    subjectName: string;
  } | null>(null);
  const [clearing, setClearing] = useState(false);

  const subjectsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([getAllQuestionProgress(), getDailyActivity()]).then(([p, a]) => {
      setProgress(p);
      setActivity(a);
    });
  }, []);

  // Scroll to subjects section when arriving from Subject.tsx link
  useEffect(() => {
    if (locationState?.scrollToSubjects && subjectsRef.current) {
      setTimeout(() => {
        subjectsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    }
  }, [locationState?.scrollToSubjects]);

  const directAttempts = progress.reduce((n, p) => n + p.attempts, 0);
  const correct = progress.reduce((n, p) => n + p.correctAttempts, 0);
  const incorrect = progress.reduce((n, p) => n + p.incorrectAttempts, 0);
  const bookmarks = progress.filter((p) => p.bookmarked).length;
  const accuracy = directAttempts ? Math.round((correct / directAttempts) * 100) : 0;

  const streak = useMemo(() => {
    const days = new Set(activity.filter((a) => a.questions > 0).map((a) => a.date));
    let count = 0;
    const d = new Date();
    while (true) {
      const key = d.toISOString().slice(0, 10);
      if (!days.has(key)) break;
      count++;
      d.setDate(d.getDate() - 1);
    }
    return count;
  }, [activity]);

  // Decode subject directly from each progress row's qid prefix (PGAN001 → "AN" → anatomy).
  // No question JSON needs to load for this — the id format is fully self-describing.
  const subjectByPrefix = useMemo(() => {
    const map = new Map<string, string>();
    for (const exam of EXAMS) {
      const examPrefix = EXAM_PREFIX[exam];
      for (const subject of SUBJECTS) {
        map.set(`${examPrefix}${subject.code}`, subject.id);
      }
    }
    return map;
  }, []);

  const subjectStats = SUBJECTS.map((subject) => {
    const qids = progress
      .filter((p) => {
        const prefix = p.qid.slice(0, 4);
        return subjectByPrefix.get(prefix) === subject.id;
      })
      .map((p) => p.qid);
    const rows = progress.filter((p) => qids.includes(p.qid));
    const attempts = rows.reduce((n, p) => n + p.attempts, 0);
    const c = rows.reduce((n, p) => n + p.correctAttempts, 0);
    return {
      ...subject,
      qids,
      attempts,
      correct: c,
      accuracy: attempts ? Math.round((c / attempts) * 100) : null,
    };
  })
    .filter((s) => s.attempts > 0)
    .sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0));

  const weekly = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    return (
      activity.find((a) => a.date === key) ?? {
        date: key,
        questions: 0,
        correct: 0,
        incorrect: 0,
      }
    );
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

    // Refresh progress
    const [p] = await Promise.all([getAllQuestionProgress()]);
    setProgress(p);
    setClearing(false);
    setClearTarget(null);
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-7">
        <h1 className="text-2xl font-bold">Progress</h1>
        <p className="mt-1 text-sm text-slate-500">
          Your direct QBank performance and activity.
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric icon={Activity} label="Questions" value={directAttempts} />
        <Metric icon={CheckCircle2} label="Correct" value={correct} />
        <Metric icon={Target} label="Accuracy" value={`${accuracy}%`} />
        <Metric icon={Flame} label="Streak" value={`${streak}d`} />
      </div>

      <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs leading-5 text-slate-500">
        Answer recorded — custom modules do not alter correctness statistics.
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
            const max = Math.max(1, ...weekly.map((x) => x.questions));
            const height = Math.max(5, (day.questions / max) * 100);
            return (
              <div
                key={day.date}
                className="flex h-full flex-1 flex-col items-center justify-end gap-2"
              >
                <span className="text-[10px] text-slate-500">{day.questions || ""}</span>
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
          <div className="mt-4 space-y-3">
            <Row icon={CheckCircle2} label="Correct attempts" value={correct} />
            <Row icon={XCircle} label="Incorrect attempts" value={incorrect} />
            <Row icon={Target} label="Bookmarks" value={bookmarks} />
          </div>
        </div>

        {/* Subjects section */}
        <div ref={subjectsRef} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <h2 className="font-bold">Subjects</h2>

          {subjectStats.length === 0 ? (
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Subject-level performance will appear after you solve PYQs directly from
              the QBank.
            </p>
          ) : (
            <>
              <p className="mt-1 text-sm leading-6 text-slate-300">
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
                      <b className="text-xs">{s.accuracy}%</b>
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