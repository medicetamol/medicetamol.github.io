import type { Exam, PYQExplanation, PYQQuestion } from "../types";
import { SUBJECTS } from "../constants";

const questionModules = import.meta.glob("../../PYQs/*/*/questions.json", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

const explanationModules = import.meta.glob("../../PYQs/*/*/explanations.json", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

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
  image?: true | string;
};

function resolveImage(
  image: true | string | undefined,
  exam: Exam,
  subjectId: string,
  id: string
): string | undefined {
  if (!image) return undefined;
  if (image === true) return `PYQs/${exam}/${subjectId}/images/${id}.webp`;
  if (image.startsWith("http")) return image;
  return `PYQs/${exam}/${subjectId}/images/${image}`;
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
        ...(q.image ? { image: resolveImage(q.image, exam, subjectId, q.id) } : {}),
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

export function loadQuestions(
  exam: Exam,
  subjectId: string
): PYQQuestion[] {
  const key = Object.keys(questionModules).find(
    (key) =>
      key.includes(`PYQs/${exam}/`) &&
      key.includes(`/${subjectId}/questions.json`)
  );

  return key
    ? parseQuestions(questionModules[key], exam, subjectId)
    : [];
}

export function loadExplanations(
  exam: Exam,
  subjectId: string
): PYQExplanation[] {
  const key = Object.keys(explanationModules).find(
    (key) =>
      key.includes(`PYQs/${exam}/`) &&
      key.includes(`/${subjectId}/explanations.json`)
  );

  return key
    ? parseExplanations(explanationModules[key])
    : [];
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

export function findQuestion(questionId: string): PYQQuestion | undefined {
  const exams: Exam[] = ["NEET-PG", "INI-CET", "FMGE"];

  for (const exam of exams) {
    const question = getAllQuestions(exam).find((q) => q.id === questionId);
    if (question) return question;
  }

  return undefined;
}

export function getAllQuestions(exam: Exam): PYQQuestion[] {
  return Object.entries(questionModules)
    .filter(([key]) => key.includes(`PYQs/${exam}/`))
    .flatMap(([key, raw]) => {
      const subjectId =
        key.match(/PYQs\/[^/]+\/([^/]+)\/questions\.json$/)?.[1] ?? "";

      return parseQuestions(raw, exam, subjectId);
    });
}
