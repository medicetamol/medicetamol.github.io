import React, { useEffect, useState } from 'react';
import { motion } from "framer-motion";
import { Link } from 'react-router-dom';
import { Flame } from "lucide-react";
import { computeStreak, getDailyActivity, STREAK_DAILY_GOAL } from "../lib/db";
import type { StreakInfo } from "../lib/db";

/**
 * Shared streak indicator (flame + day count) used on Home and Progress.
 * A day counts toward the streak once STREAK_DAILY_GOAL questions are
 * solved. Today never hard-breaks the streak by itself — until today
 * either hits the goal or fully ends, the flame shows yesterday's count,
 * dimmed ("at risk"). See computeStreak in lib/db.ts for the exact rule.
 */
export default function Streak({
  size = "md",
  variant = "stack",
  linkToProgress = false,
}: {
  size?: "sm" | "md";
  /** "pill" = compact "4 day streak" chip used on Home; "stack" = flame + count (Progress). */
  variant?: "stack" | "pill";
  /** When true, wraps the widget in a Link to /progress (used on Home; Progress itself skips this). */
  linkToProgress?: boolean;
}) {
  const [info, setInfo] = useState<StreakInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDailyActivity().then((activity) => {
      if (cancelled) return;
      setInfo(computeStreak(activity));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!info) return null;

  // Three distinct states:
  //  a. no active streak — grayscale, but high-contrast enough to read clearly
  //  b. streak active, today still pending — colored but desaturated, gently
  //     pulsing as a nudge; the pulse stops once today's goal is hit
  //  c. streak active, today's goal met — fully colored, steady (no pulse)
  const hasStreak = info.days > 0;
  const pendingToday = hasStreak && !info.completedToday;
  const completedActive = hasStreak && info.completedToday;

  if (variant === "pill") {
    const label = hasStreak ? `${info.days} day streak` : "Build your Streak";
    const pill = (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full text-sm font-semibold ${
          hasStreak
            ? "bg-accent-soft text-accent-text"
            : "border border-slate-800 bg-slate-900/60 text-slate-400"
        } ${pendingToday ? "py-1 pl-1.5 pr-3" : "px-3 py-1.5"}`}
      >
        {pendingToday ? (
          // at risk: dotted ring + blinking flame
          <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-dotted border-red-500">
            <Flame size={15} fill="currentColor" className="flame-blink" aria-hidden="true" />
          </span>
        ) : (
          <Flame
            size={16}
            fill={hasStreak ? "currentColor" : "none"}
            className={hasStreak ? "" : "text-slate-500"}
            aria-hidden="true"
          />
        )}
        {label}
      </span>
    );
    return linkToProgress ? (
      <Link to="/progress" aria-label={`${label}. View progress`} className="rounded-full">
        {pill}
      </Link>
    ) : (
      pill
    );
  }

  const dims = size === "sm" ? "h-9 w-9 text-2xl" : "h-14 w-14 text-4xl";

  const flameClass = hasStreak ? "" : "opacity-60 grayscale"; // (a) no streak — visible, not colorful

  const countClass = hasStreak ? "text-orange-400" : "text-slate-400";

  const content = (
    <div className="flex flex-col items-center gap-1">
      <motion.div
        className={`grid place-items-center rounded-full bg-transparent ${dims} ${
          pendingToday ? "border-2 border-dotted border-red-500" : ""
        }`}
        animate={pendingToday ? { scale: [1, 1.08, 1] } : { scale: 1 }}
        transition={pendingToday ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" } : undefined}
      >
        <span className={flameClass} role="img" aria-label="streak">
          🔥
        </span>
      </motion.div>
      <span className={`text-sm font-bold ${countClass}`}>{info.days}</span>
      {size === "md" && (
        <span className={`text-[11px] ${pendingToday ? "text-red-400 font-medium" : "text-slate-500"}`}>
          {completedActive
            ? "Streak complete"
            : pendingToday
              ? `⚠️ Streak At Risk`
              : `${info.todayCount}/${STREAK_DAILY_GOAL} Qs today`}
        </span>
      )}
    </div>
  );

  if (linkToProgress) {
    return (
      <Link to="/progress" aria-label="View progress" className="rounded-2xl">
        {content}
      </Link>
    );
  }

  return content;
}
