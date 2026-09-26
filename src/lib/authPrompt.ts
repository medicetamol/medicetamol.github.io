// ─── Sign-in prompt milestones ──────────────────────────────────────────────
// Soft prompts (streak / DQB count / custom modules) nag the signed-out user
// only when they cross a NEW threshold they haven't been shown before, and
// at most once per calendar day overall (first trigger to fire wins that
// day). "Report error" is a separate, always-on hard prompt — not part of
// this milestone/day-cap system at all (see shouldPromptForReportError).
//
// Everything here is stored in localStorage (persists across visits, unlike
// sessionStorage) so a milestone already shown doesn't re-ask forever. On
// sign-in, clearAuthPromptState() wipes all of it — nothing left to track.

const KEY_STREAK_LEVEL = "authPrompt_streakLevel";
const KEY_DQB_LEVEL = "authPrompt_dqbLevel";
const KEY_MODULE_LEVEL = "authPrompt_moduleLevel";
const KEY_LAST_SHOWN_DATE = "authPrompt_lastShownDate";

const DQB_STEP = 20; // prompt at 20, 40, 60...
const MODULE_STEP = 3; // prompt at 3, 6, 9...

export type SoftPromptTrigger = "streak" | "dqb" | "customModule";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function getNumber(key: string): number {
  const raw = localStorage.getItem(key);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? n : 0;
}

/** True if a soft prompt has already been shown today (any trigger). */
function alreadyShownToday(): boolean {
  return localStorage.getItem(KEY_LAST_SHOWN_DATE) === todayStr();
}

function markShownToday(): void {
  localStorage.setItem(KEY_LAST_SHOWN_DATE, todayStr());
}

/**
 * Streak trigger: fires at 2 days, then again only once the streak has grown
 * past the level last shown (3, 4, 5...), or after a reset + fresh climb back
 * to 2. `days` is the live streak length from computeStreak().
 */
export function checkStreakMilestone(days: number): boolean {
  if (alreadyShownToday()) return false;
  if (days < 2) return false;
  const lastLevel = getNumber(KEY_STREAK_LEVEL);
  // Re-arm after a break: if the streak dropped below what was last shown,
  // treat the next 2+ as a new climb and prompt again.
  const isNewClimb = days < lastLevel;
  if (days > lastLevel || isNewClimb) {
    localStorage.setItem(KEY_STREAK_LEVEL, String(days));
    markShownToday();
    return true;
  }
  return false;
}

/** Direct Subject QB trigger: fires at 20, 40, 60... solved. */
export function checkDqbMilestone(totalSolved: number): boolean {
  if (alreadyShownToday()) return false;
  const lastLevel = getNumber(KEY_DQB_LEVEL);
  const currentStep = Math.floor(totalSolved / DQB_STEP) * DQB_STEP;
  if (currentStep >= DQB_STEP && currentStep > lastLevel) {
    localStorage.setItem(KEY_DQB_LEVEL, String(currentStep));
    markShownToday();
    return true;
  }
  return false;
}

/** Custom modules trigger: fires at the 3rd, 6th, 9th... completed module, on "See Explanations". */
export function checkCustomModuleMilestone(completedCount: number): boolean {
  if (alreadyShownToday()) return false;
  const lastLevel = getNumber(KEY_MODULE_LEVEL);
  const currentStep = Math.floor(completedCount / MODULE_STEP) * MODULE_STEP;
  if (currentStep >= MODULE_STEP && currentStep > lastLevel) {
    localStorage.setItem(KEY_MODULE_LEVEL, String(currentStep));
    markShownToday();
    return true;
  }
  return false;
}

/** Clears all milestone/day-cap tracking — call once the user signs in. */
export function clearAuthPromptState(): void {
  localStorage.removeItem(KEY_STREAK_LEVEL);
  localStorage.removeItem(KEY_DQB_LEVEL);
  localStorage.removeItem(KEY_MODULE_LEVEL);
  localStorage.removeItem(KEY_LAST_SHOWN_DATE);
}
