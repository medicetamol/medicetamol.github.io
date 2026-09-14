import type { Exam } from "../types";

export interface ModuleBuilderState {
  subjects: string[]; // subject ids currently selected
  topicsBySubject: Record<string, string[]>; // subjectId -> topic ids ("all" = every topic)
}

function key(exam: Exam): string {
  return `moduleBuilder:${exam}`;
}

function emptyState(): ModuleBuilderState {
  return { subjects: [], topicsBySubject: {} };
}

export function loadModuleBuilderState(exam: Exam): ModuleBuilderState {
  try {
    const raw = sessionStorage.getItem(key(exam));
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    return {
      subjects: Array.isArray(parsed.subjects) ? parsed.subjects : [],
      topicsBySubject:
        parsed.topicsBySubject && typeof parsed.topicsBySubject === "object"
          ? parsed.topicsBySubject
          : {},
    };
  } catch {
    return emptyState();
  }
}

export function saveModuleBuilderState(exam: Exam, state: ModuleBuilderState): void {
  try {
    sessionStorage.setItem(key(exam), JSON.stringify(state));
  } catch {
    // sessionStorage unavailable — selection just won't persist across nav, non-fatal
  }
}
