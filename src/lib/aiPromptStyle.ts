import type { PYQQuestion } from "../types";
import { formatQuestionForShare, getSiteUrl } from "./sharing";

export type AiApproach = "elimination" | "explanation" | "non-specific";
export type AiStyle = "normal" | "short";

export interface AiPromptSelection {
  approach: AiApproach;
  /** Ignored when approach is "non-specific". */
  style: AiStyle;
}

const STORAGE_KEY = "medicetamol:aiPromptSelection";

const DEFAULT_SELECTION: AiPromptSelection = {
  approach: "elimination",
  style: "short",
};

const PROMPTS_PAGE_URL = getSiteUrl("/AiPrompts.html");

// Section heading text as it appears on AiPrompts.html, used to name the
// prompt in plain language in the share text (AI fetchers ignore #anchors).
const SECTION_NAMES: Record<Exclude<AiApproach, "non-specific">, Record<AiStyle, string>> = {
  elimination: { normal: "Normal Elimination", short: "Short Elimination" },
  explanation: { normal: "Normal Explanation", short: "Brief Explanation" },
};

const LABELS: Record<AiApproach, string> = {
  elimination: "Elimination",
  explanation: "Explanation",
  "non-specific": "Non-specific",
};

export function getAiPromptSelection(): AiPromptSelection {
  if (typeof window === "undefined") return DEFAULT_SELECTION;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SELECTION;
    const parsed = JSON.parse(raw) as Partial<AiPromptSelection>;
    if (
      (parsed.approach === "elimination" ||
        parsed.approach === "explanation" ||
        parsed.approach === "non-specific") &&
      (parsed.style === "normal" || parsed.style === "short")
    ) {
      return { approach: parsed.approach, style: parsed.style };
    }
    return DEFAULT_SELECTION;
  } catch {
    return DEFAULT_SELECTION;
  }
}

export function setAiPromptSelection(selection: AiPromptSelection): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
  } catch {
    // best-effort only
  }
}

export function getAiApproachLabel(approach: AiApproach): string {
  return LABELS[approach];
}

/**
 * Builds the share-text tail for the given selection: which named section
 * to use plus the single static prompts-page link (no #anchor — AI
 * fetchers don't execute JS/scroll, so the page link alone plus a plain-
 * language section name is what actually steers the AI to the right
 * prompt). Returns null for "non-specific" — no prompt is carried at all.
 */
export function getAiPromptInstruction(selection: AiPromptSelection): {
  sectionName: string;
  url: string;
} | null {
  if (selection.approach === "non-specific") return null;
  const sectionName = SECTION_NAMES[selection.approach][selection.style];
  return { sectionName, url: PROMPTS_PAGE_URL };
}

/**
 * Builds the full "Ask AI" share text for a question, honoring the
 * current prompt-style selection. The selected style name is stated in
 * the opening line (not just at the end near the link) so a skimming AI
 * can't latch onto the wrong section on AiPrompts.html — e.g. matching
 * "Short" alone and landing on Short Elimination instead of Short
 * Explanation. Replaces the old per-question `/ai/${question.id}`
 * static-page link with the single AiPrompts.html page (or no link at
 * all for "non-specific").
 */
export function buildAskAiText(question: PYQQuestion, selection: AiPromptSelection): string {
  const instruction = getAiPromptInstruction(selection);

  // Image questions carry the full question + options inside the attached
  // share-card image now (see shareCard.ts) — repeating them as text would
  // be redundant, so this stays short: just the instruction (+ link) and a
  // fallback note in case the image didn't actually attach/paste.
  if (question.image) {
    const imageNote = "If an image is not attached, ask me to paste it.";
    if (!instruction) {
      return `Explain this IMAGE Based PYQ using the mediceTaMol AI prompt.\n\n${imageNote}`;
    }
    return `Explain this IMAGE Based PYQ using the mediceTaMol AI ${instruction.sectionName} prompt given in link\n${instruction.url}\n\n${imageNote}`;
  }

  const headline = instruction
    ? `Explain this PYQ using the\nmediceTaMol AI ${instruction.sectionName} prompt.`
    : `Explain this PYQ using the\nmediceTaMol AI prompt.`;

  const body = `${headline}\n\n${formatQuestionForShare(question, { includeBranding: false })}`;

  if (!instruction) return body;

  return `${body}\n\nUse the ${instruction.sectionName} prompt given in this link:\n${instruction.url}`;
}
