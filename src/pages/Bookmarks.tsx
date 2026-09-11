import { ArrowRight, Bookmark } from "lucide-react";
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SUBJECTS } from "../constants";
import { getAllQuestionProgress } from "../lib/db";
import type { Exam } from "../types";

// Exam id prefixes as they appear at the start of every qid. Order matters:
// "INI" and "FMG" must be checked before shorter prefixes would collide.
const EXAM_PREFIXES: Array<{ exam: Exam; prefix: string }> = [
  { exam: "INI-CET", prefix: "INI" },
  { exam: "FMGE", prefix: "FMG" },
  { exam: "NEET-PG", prefix: "PG" },
];

function decodeQid(qid: string): { exam: Exam; subjectId: string } | null {
  const match = EXAM_PREFIXES.find((e) => qid.startsWith(e.prefix));
  if (!match) return null;
  const code = qid.slice(match.prefix.length, match.prefix.length + 2).toUpperCase();
  const subject = SUBJECTS.find((s) => s.code === code);
  if (!subject) return null;
  return { exam: match.exam, subjectId: subject.id };
}

export default function Bookmarks() {
  const navigate = useNavigate();
  const [bookmarkedQids, setBookmarkedQids] = useState<string[] | null>(null);

  useEffect(() => {
    getAllQuestionProgress().then((items) => {
      setBookmarkedQids(items.filter((p) => p.bookmarked).map((p) => p.qid));
    });
  }, []);

  // Decode every bookmarked qid to {exam, subjectId} without loading any
  // question JSON — pure string parsing against constants.ts.
  const decoded = useMemo(() => {
    if (!bookmarkedQids) return [];
    return bookmarkedQids
      .map((qid) => decodeQid(qid))
      .filter((x): x is { exam: Exam; subjectId: string } => x !== null);
  }, [bookmarkedQids]);

  // Subject bars: only subjects with >=1 bookmark, count spans all exams.
  const subjectRows = useMemo(() => {
    const counts = new Map<string, number>();
    for (const info of decoded) {
      counts.set(info.subjectId, (counts.get(info.subjectId) ?? 0) + 1);
    }
    return SUBJECTS
      .filter((s) => counts.has(s.id))
      .map((s) => ({ ...s, count: counts.get(s.id) ?? 0 }));
  }, [decoded]);

  const openSubject = (subjectId: string) => {
    navigate(`/bookmarks/${subjectId}`);
  };

  if (bookmarkedQids === null) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <p className="text-sm text-slate-500">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-7">
        <h1 className="text-2xl font-bold">Bookmarks</h1>
        <p className="mt-1 text-sm text-slate-500">Review your bookmarked PYQs by subject.</p>
      </div>

      {subjectRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-8 text-center">
          <Bookmark className="mx-auto text-slate-600" size={30} />
          <h3 className="mt-3 font-semibold text-slate-200">No bookmarks yet</h3>
          <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">
            Bookmark questions while solving to revisit them here.
          </p>
          <Link
            to="/pyqs"
            className="mt-4 inline-flex rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-950"
          >
            Browse PYQs
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {subjectRows.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => openSubject(s.id)}
              className="group flex w-full items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/60 p-5 text-left hover:border-slate-600"
            >
              <span className="font-bold">{s.name}</span>
              <span className="flex items-center gap-3">
                <span className="text-xs text-slate-500">
                  {s.count} Q{s.count === 1 ? "" : "s"}
                </span>
                <ArrowRight size={17} className="text-slate-600 transition group-hover:text-slate-200" />
              </span>
            </button>
          ))}
        </div>
      )}
    </main>
  );
}