import React, { useEffect, useState } from 'react';
import { motion } from "framer-motion";
import { Link } from 'react-router-dom';
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
  linkToProgress = false,
}: {
  size?: "sm" | "md";
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

  const lit = info.completedToday && info.days > 0;
  const dims = size === "sm" ? "h-9 w-9 text-2xl" : "h-14 w-14 text-4xl";

  const content = (
    <div className="flex flex-col items-center gap-1">
      <motion.div
        className={`grid place-items-center rounded-full bg-transparent ${dims}`}
        animate={
          lit
            ? { scale: [1, 1.08, 1] }
            : { scale: 1 }
        }
        transition={lit ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" } : undefined}
      >
        <span className={lit ? "" : "opacity-30 grayscale"} role="img" aria-label="streak">
          🔥
        </span>
      </motion.div>
      <span className={`text-sm font-bold ${lit ? "text-orange-400" : "text-slate-600"}`}>
        {info.days}
      </span>
      {size === "md" && (
        <span className="text-[11px] text-slate-500">
          {info.completedToday
            ? "Streak complete"
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
