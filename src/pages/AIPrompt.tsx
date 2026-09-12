import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { findQuestion } from "../data/questions";
import type { PYQQuestion } from "../types";

const MASTER_PROMPT = `You are a medical student in an entrance exam (NEET PG & INICET).

Solve the following MCQ using the approach described below.

1. One-line problem representation: age/sex + key symptom/sign + key discriminator(s).

2. Key clues only (max 3–5 bullets): highlight the discriminators; ignore fluff.

3. Solve the question using an elimination-first approach as if you do NOT know the correct answer. Do not answer according to any colour marked in the question. Justify every elimination using exam-relevant logic.

4. Stepwise elimination of options: eliminate options one by one with crisp reasons; include "why tempting but wrong" for close distractors.

Keep the response concise and focused on high-yield, exam-relevant points.

Use standard medical terminology.`;

type ImageFields = {
  image?: string;
  imageSrc?: string;
  imageUrl?: string;
};

function getImageSrc(question: unknown): string | undefined {
  const q = question as ImageFields;
  const src = q.imageSrc ?? q.imageUrl ?? q.image;
  return typeof src === "string" && src.trim() ? src.trim() : undefined;
}

export default function AIPrompt() {
  const { questionId } = useParams<{ questionId: string }>();
  const [question, setQuestion] = useState<PYQQuestion | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    findQuestion(questionId ?? "").then((result) => {
      if (cancelled) return;
      setQuestion(result);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [questionId]);

  if (loading) {
    return <pre>{`mediCetamol AI endpoint\n\nLoading...`}</pre>;
  }

  if (!question) {
    return (
      <pre>{`mediCetamol AI endpoint

Question not found.
Question ID: ${questionId ?? ""}`}</pre>
    );
  }

  const imageSrc = getImageSrc(question);

  const options = question.options
    .map(
      (option, index) =>
        `${String.fromCharCode(65 + index)}. ${option}`
    )
    .join("\n");

  const content = [
    "Use this prompt to solve the following MCQ.",
    "",
    MASTER_PROMPT,
    "",
    "MCQ",
    "",
    imageSrc ? `![Question image](${imageSrc})` : "",
    imageSrc ? "" : "",
    question.question,
    "",
    options,
  ].join("\n");

  return (
    <pre
      style={{
        margin: 0,
        padding: "16px",
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
        fontFamily:
          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        fontSize: "14px",
        lineHeight: 1.55,
      }}
    >
      {content}
    </pre>
  );
}