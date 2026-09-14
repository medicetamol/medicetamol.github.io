import { EXAMS, SUBJECTS } from "../constants";
import type { Exam } from "../types";

// URL shape: /custom/module?e=pg&m=q&i=AN1,5,PH23,BC34
// e = exam prefix (lowercase, matches EXAMS[].prefix)
// m = mode: "q" = exam/quiz mode, "g" = guide mode
// i = comma-separated refs: {2-letter subject code}{serial, no leading zeros}
//     subject code carries forward across consecutive ids of the same subject,
//     only re-written when the subject changes

const EXAM_BY_PREFIX: Record<string, Exam> = Object.fromEntries(
  EXAMS.map((e) => [e.prefix.toLowerCase(), e.id])
) as Record<string, Exam>;

const SUBJECT_CODE_TO_ID: Record<string, string> = Object.fromEntries(
  SUBJECTS.map((s) => [s.code, s.id])
);

export interface EncodedModule {
  exam: Exam;
  mode: "quiz" | "guide";
  ids: string[]; // full question ids, e.g. ["PGAN001", "PGAN005", "PGPH023"]
}

export function encodeModuleParams(mod: EncodedModule): string {
  const examEntry = EXAMS.find((e) => e.id === mod.exam);
  if (!examEntry) throw new Error(`Unknown exam: ${mod.exam}`);
  const examPrefix = examEntry.prefix; // e.g. "PG"

  const params = new URLSearchParams();
  params.set("e", examPrefix.toLowerCase());
  params.set("m", mod.mode === "quiz" ? "q" : "g");

  let lastSubjectCode = "";
  const parts: string[] = [];

  for (const fullId of mod.ids) {
    // fullId = {examPrefix:2}{subjectCode:2}{serial:3}
    const idSubjectCode = fullId.slice(2, 4);
    const serialStr = fullId.slice(4); // e.g. "005"
    const serial = String(parseInt(serialStr, 10)); // drop leading zeros

    if (idSubjectCode !== lastSubjectCode) {
      parts.push(`${idSubjectCode}${serial}`);
      lastSubjectCode = idSubjectCode;
    } else {
      parts.push(serial);
    }
  }

  params.set("i", parts.join(","));
  return params.toString();
}

export function decodeModuleParams(searchParams: URLSearchParams): EncodedModule | null {
  const e = searchParams.get("e");
  const m = searchParams.get("m");
  const i = searchParams.get("i");
  if (!e || !m || !i) return null;

  const exam = EXAM_BY_PREFIX[e.toLowerCase()];
  if (!exam) return null;

  const examEntry = EXAMS.find((ex) => ex.id === exam);
  if (!examEntry) return null;
  const examPrefix = examEntry.prefix;

  const mode: "quiz" | "guide" | null = m === "q" ? "quiz" : m === "g" ? "guide" : null;
  if (!mode) return null;

  const rawParts = i.split(",").filter(Boolean);
  const ids: string[] = [];
  let lastSubjectCode = "";

  for (const part of rawParts) {
    const match = part.match(/^([A-Z]{2})?(\d+)$/i);
    if (!match) return null;
    const [, subjectCode, serialRaw] = match;

    const code = subjectCode ? subjectCode.toUpperCase() : lastSubjectCode;
    if (!code || !SUBJECT_CODE_TO_ID[code]) return null;
    lastSubjectCode = code;

    const serial = serialRaw.padStart(3, "0");
    ids.push(`${examPrefix}${code}${serial}`);
  }

  if (ids.length === 0) return null;

  return { exam, mode, ids };
}

export function subjectNamesFromIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const id of ids) {
    const code = id.slice(2, 4);
    const subjectId = SUBJECT_CODE_TO_ID[code];
    const subject = SUBJECTS.find((s) => s.id === subjectId);
    if (subject && !seen.has(subject.id)) {
      seen.add(subject.id);
      names.push(subject.name);
    }
  }
  return names;
}
