import { ChevronDown, HelpCircle, X } from "lucide-react";
import React, { useState } from 'react';
import type { StatusFilter } from "../types";

export type ReadOnlyStatus = "correct" | "incorrect" | "skipped";

export interface ReadOnlyQuestionMeta {
  status: ReadOnlyStatus;
  reviewed: boolean;
  guessing: boolean;
  bookmarked: boolean;
}

const STATUS_STYLE: Record<ReadOnlyStatus, string> = {
  correct: "bg-emerald-800/80 text-emerald-100",
  incorrect: "bg-red-900/70 text-red-100",
  skipped: "bg-sky-900/60 text-sky-100",
};

const FILTER_LABEL: Record<StatusFilter, string> = {
  all: "All questions",
  correct: "Correct",
  incorrect: "Incorrect",
  skipped: "Skipped",
  reviewed: "Reviewed",
  guessing: "Guessing answer",
  bookmark: "Bookmarked",
};

const FILTER_ORDER: StatusFilter[] = ["all", "correct", "incorrect", "skipped", "reviewed", "guessing", "bookmark"];

export default function ReadOnlyNavigator({
  open,
  onClose,
  meta, // meta[i] describes questions[i] — full, unfiltered pool
  currentIndex,
  onJump,
  filter,
  onFilterChange,
  hideOption,
  onToggleHideOption,
}: {
  open: boolean;
  onClose: () => void;
  meta: ReadOnlyQuestionMeta[];
  currentIndex: number;
  onJump: (poolIndex: number) => void;
  filter: StatusFilter;
  onFilterChange: (f: StatusFilter) => void;
  hideOption: boolean;
  onToggleHideOption: () => void;
}) {
  const [filterOpen, setFilterOpen] = useState(false);

  if (!open) return null;

  const matchesFilter = (m: ReadOnlyQuestionMeta, f: StatusFilter) => {
    if (f === "all") return true;
    if (f === "correct") return m.status === "correct";
    if (f === "incorrect") return m.status === "incorrect";
    if (f === "skipped") return m.status === "skipped";
    if (f === "reviewed") return m.reviewed;
    if (f === "guessing") return m.guessing;
    if (f === "bookmark") return m.bookmarked;
    return true;
  };

  // Indices into the full pool that pass the active filter — grid numbers
  // and navigation both operate over this filtered subset, not the raw pool.
  const visiblePoolIndices = meta
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => matchesFilter(m, filter))
    .map(({ i }) => i);

  const counts = FILTER_ORDER.reduce((acc, f) => {
    acc[f] = meta.filter((m) => matchesFilter(m, f)).length;
    return acc;
  }, {} as Record<StatusFilter, number>);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Filter and question navigator"
      onClick={onClose}
    >
      <div
        className="h-[92dvh] w-full max-w-4xl overflow-y-auto rounded-t-2xl border-t border-slate-700 bg-slate-900 px-4 pb-6 pt-3 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-slate-700" />

        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-100">Review questions</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-200"
          >
            <X size={18} />
          </button>
        </div>

        {/* Hide marked option toggle */}
        <div className="mb-3 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 px-3.5 py-3">
          <span className="text-sm text-slate-300">Hide my selected option</span>
          <button
            type="button"
            role="switch"
            aria-checked={hideOption}
            onClick={onToggleHideOption}
            className={`relative h-6 w-11 shrink-0 overflow-hidden rounded-full transition-colors ${
              hideOption ? "bg-sky-600" : "bg-slate-700"
            }`}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                hideOption ? "translate-x-[18px]" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Filter dropdown */}
        <div className="relative mb-4">
          <button
            type="button"
            onClick={() => setFilterOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 px-3.5 py-3 text-sm text-slate-200"
          >
            <span>
              {FILTER_LABEL[filter]}
              <span className="ml-1.5 text-slate-500">({counts[filter]})</span>
            </span>
            <ChevronDown size={16} className={`text-slate-500 transition-transform ${filterOpen ? "rotate-180" : ""}`} />
          </button>
          {filterOpen && (
            <div className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-xl">
              {FILTER_ORDER.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => { onFilterChange(f); setFilterOpen(false); }}
                  className={`flex w-full items-center justify-between px-3.5 py-2.5 text-left text-sm ${
                    filter === f ? "bg-slate-800 text-slate-50" : "text-slate-300 hover:bg-slate-800/60"
                  }`}
                >
                  {FILTER_LABEL[f]}
                  <span className="text-slate-500">{counts[f]}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Grid — filtered subset only */}
        {visiblePoolIndices.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">No questions match this filter.</p>
        ) : (
          <div className="grid grid-cols-7 gap-2 sm:grid-cols-8">
            {visiblePoolIndices.map((poolIndex) => {
              const m = meta[poolIndex];
              const isCurrent = poolIndex === currentIndex;
              return (
                <button
                  key={poolIndex}
                  type="button"
                  onClick={() => onJump(poolIndex)}
                  className={`relative aspect-square rounded-lg text-sm font-semibold transition-colors ${STATUS_STYLE[m.status]} ${
                    isCurrent ? "ring-2 ring-sky-400" : ""
                  }`}
                  aria-label={`Go to question ${poolIndex + 1}`}
                  aria-current={isCurrent ? "true" : undefined}
                >
                  {poolIndex + 1}
                  {m.reviewed && (
                    <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-violet-400" />
                  )}
                  {m.guessing && (
                    <HelpCircle size={10} className="absolute bottom-0.5 left-0.5 text-amber-300" strokeWidth={2.5} />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div className="mb-1 mt-4 flex flex-wrap gap-x-3 gap-y-2 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-800/80" /> Correct
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-900/70" /> Incorrect
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-sky-900/60" /> Skipped
          </span>
          <span className="flex items-center gap-1.5">
            <span className="relative inline-block h-2.5 w-2.5 rounded-sm bg-emerald-800/80">
              <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-violet-400" />
            </span>
            Reviewed
          </span>
          <span className="flex items-center gap-1.5">
            <HelpCircle size={12} className="text-amber-400" /> Guessing
          </span>
        </div>
      </div>
    </div>
  );
}
