import type { Exam, PYQExplanation, PYQQuestion } from "../types";
import { SUBJECTS, EXAM_PREFIX } from "../constants";

// Lazy: each subject's questions.json/explanations.json is fetched only when requested,
// instead of the whole ~7.5MB dataset loading into every visitor's bundle upfront.
const questionModules = import.meta.glob("../../PYQs/*/*/questions.json", {
  query: "?raw",
  import: "default",
}) as Record<string, () => Promise<string>>;

const explanationModules = import.meta.glob("../../PYQs/*/*/explanations.json", {
  query: "?raw",
  import: "default",
}) as Record<string, () => Promise<string>>;

const detailedExplanationModules = import.meta.glob(
  "../../PYQs/*/*/explanations/*.md",
  {
    query: "?raw",
    import: "default",
  }
) as Record<string, () => Promise<string>>;

type CompactQuestion = {
  id: string;
  y: number;
  t: string;
  q: string;
  o: string[];
  a: number;
  img?: true | string;
};

function resolveImage(
  image: true | string | undefined,
  exam: Exam,
  subjectId: string,
  id: string
): string | undefined {
  if (!image) return undefined;
  if (image === true) return `/PYQs/${exam}/${subjectId}/images/${id}.webp`;
  if (image.startsWith("http")) return image;
  return `/PYQs/${exam}/${subjectId}/images/${image}`;
}

function parseQuestions(
  raw: string,
  exam: Exam,
  subjectId: string
): PYQQuestion[] {
  try {
    const questions: CompactQuestion[] = JSON.parse(raw);
    const subject = SUBJECTS.find((s) => s.id === subjectId);

    return questions.map((q) => {
      const topic = subject?.topics.find((t) => t.id === q.t);

      return {
        id: q.id,
        exam,
        year: q.y,
        subjectId,
        topicId: q.t,
        topicName: topic?.name ?? q.t,
        question: q.q,
        options: q.o,
        answer: q.a,
        ...(q.img ? { image: resolveImage(q.img, exam, subjectId, q.id) } : {}),
      };
    });
  } catch {
    return [];
  }
}

function parseExplanations(raw: string): PYQExplanation[] {
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function findQuestionModuleKey(
  modules: Record<string, unknown>,
  exam: Exam,
  subjectId: string,
  filename: string
): string | undefined {
  return Object.keys(modules).find(
    (key) =>
      key.includes(`PYQs/${exam}/`) &&
      key.includes(`/${subjectId}/${filename}`)
  );
}

export async function loadQuestions(
  exam: Exam,
  subjectId: string
): Promise<PYQQuestion[]> {
  const key = findQuestionModuleKey(questionModules, exam, subjectId, "questions.json");
  if (!key) return [];

  const raw = await questionModules[key]();
  return parseQuestions(raw, exam, subjectId);
}

// Fire-and-forget: triggers the same dynamic import as loadQuestions so the browser
// starts (and caches) the fetch ahead of navigation. Call on click, not hover/touchstart.
export function prefetchQuestions(exam: Exam, subjectId: string): void {
  const key = findQuestionModuleKey(questionModules, exam, subjectId, "questions.json");
  if (key) void questionModules[key]();
}

export async function loadExplanations(
  exam: Exam,
  subjectId: string
): Promise<PYQExplanation[]> {
  const key = findQuestionModuleKey(explanationModules, exam, subjectId, "explanations.json");
  if (!key) return [];

  const raw = await explanationModules[key]();
  return parseExplanations(raw);
}

export function hasDetailedExplanation(
  exam: Exam,
  subjectId: string,
  questionId: string
): boolean {
  const suffix = `PYQs/${exam}/${subjectId}/explanations/${questionId}.md`;
  return Object.keys(detailedExplanationModules).some((key) => key.endsWith(suffix));
}

export async function loadDetailedExplanation(
  exam: Exam,
  subjectId: string,
  questionId: string
): Promise<string | null> {
  const suffix = `PYQs/${exam}/${subjectId}/explanations/${questionId}.md`;
  const key = Object.keys(detailedExplanationModules).find((item) => item.endsWith(suffix));

  if (!key) return null;

  try {
    return await detailedExplanationModules[key]();
  } catch {
    return null;
  }
}

// qid format: {examPrefix}{subjectCode}{serial} — fixed 2+2+3 chars, e.g. PGAN001.
// Fully decodable: exam + subject resolve directly from the id, so only that one
// subject file loads instead of scanning every exam/subject.
function decodeQid(questionId: string): { exam: Exam; subjectId: string } | undefined {
  if (questionId.length < 4) return undefined;

  const examPrefix = questionId.slice(0, 2);
  const subjectCode = questionId.slice(2, 4);

  const exam = (Object.keys(EXAM_PREFIX) as Exam[]).find(
    (e) => EXAM_PREFIX[e] === examPrefix
  );
  if (!exam) return undefined;

  const subject = SUBJECTS.find((s) => s.code === subjectCode);
  if (!subject) return undefined;

  return { exam, subjectId: subject.id };
}

export async function findQuestion(questionId: string): Promise<PYQQuestion | undefined> {
  const decoded = decodeQid(questionId);
  if (!decoded) return undefined;

  const questions = await loadQuestions(decoded.exam, decoded.subjectId);
  return questions.find((q) => q.id === questionId);
}

export async function getAllQuestions(exam: Exam): Promise<PYQQuestion[]> {
  const entries = Object.entries(questionModules).filter(([key]) =>
    key.includes(`PYQs/${exam}/`)
  );

  const results = await Promise.all(
    entries.map(async ([key, load]) => {
      const subjectId =
        key.match(/PYQs\/[^/]+\/([^/]+)\/questions\.json$/)?.[1] ?? "";
      const raw = await load();
      return parseQuestions(raw, exam, subjectId);
    })
  );

  return results.flat();
}
