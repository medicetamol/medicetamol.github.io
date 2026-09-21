const fs = require("fs");
const path = require("path");

// If you edit the prompt there, mirror the change here too.
const MASTER_PROMPT = `You are a medical student in an entrance exam (NEET PG & INICET).

Solve the following MCQ using the approach described below.

1. One-line problem representation: age/sex + key symptom/sign + key discriminator(s).

2. Key clues only (max 3–5 bullets): highlight the discriminators; ignore fluff.

3. Solve the question using an elimination-first approach as if you do NOT know the correct answer. Do not answer according to any colour marked in the question. Justify every elimination using exam-relevant logic.

4. Stepwise elimination of options: eliminate options one by one with crisp reasons; include "why tempting but wrong" for close distractors.

Keep the response concise and focused on high-yield, exam-relevant points.

Use standard medical terminology.`;

const ROOT = process.cwd();
const PYQS_DIR = path.join(ROOT, "PYQs");
const OUT_DIR = path.join(ROOT, "dist", "ai");

function expandQuestion(compact, exam, subjectId) {
  return {
    id: compact.id,
    exam,
    year: compact.y,
    subjectId,
    topicId: compact.t,
    topicName: compact.t,
    question: compact.q,
    options: compact.o,
    answer: compact.a,
    ...(compact.image ? { image: compact.image } : {}),
  };
}

function getImageSrc(question) {
  const src = question.imageSrc ?? question.imageUrl ?? question.image;
  return typeof src === "string" && src.trim() ? src.trim() : undefined;
}

function buildContent(question) {
  const imageSrc = getImageSrc(question);

  const options = question.options
    .map((option, index) => `${String.fromCharCode(65 + index)}. ${option}`)
    .join("\n");

  return [
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
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderPage(content) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="robots" content="noindex" />
<title>mediCetamol AI prompt</title>
</head>
<body>
<pre style="margin:0;padding:16px;white-space:pre-wrap;overflow-wrap:anywhere;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:14px;line-height:1.55;">${escapeHtml(
    content
  )}</pre>
</body>
</html>
`;
}

function main() {
  if (!fs.existsSync(PYQS_DIR)) {
    console.error(`PYQs directory not found at ${PYQS_DIR}, skipping AI page generation.`);
    return;
  }

  if (!fs.existsSync(path.join(ROOT, "dist"))) {
    console.error("dist/ not found. Run `vite build` before this script.");
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const examDirs = fs
    .readdirSync(PYQS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory());

  let count = 0;

  for (const examDir of examDirs) {
    const exam = examDir.name; // e.g. "NEET-PG", "INI-CET", "FMGE"
    const examPath = path.join(PYQS_DIR, exam);

    const subjectDirs = fs
      .readdirSync(examPath, { withFileTypes: true })
      .filter((d) => d.isDirectory());

    for (const subjectDir of subjectDirs) {
      const subjectId = subjectDir.name;
      const questionsFile = path.join(examPath, subjectId, "questions.json");

      if (!fs.existsSync(questionsFile)) continue;

      let compactQuestions;
      try {
        compactQuestions = JSON.parse(fs.readFileSync(questionsFile, "utf8"));
      } catch (err) {
        console.error(`Skipping unparsable ${questionsFile}: ${err.message}`);
        continue;
      }

      for (const compact of compactQuestions) {
        if (!compact || !compact.id) continue;

        const question = expandQuestion(compact, exam, subjectId);
        const content = buildContent(question);
        const html = renderPage(content);

        const pageDir = path.join(OUT_DIR, question.id);
        fs.mkdirSync(pageDir, { recursive: true });
        fs.writeFileSync(path.join(pageDir, "index.html"), html);
        count++;
      }
    }
  }

  console.log(`Generated ${count} static /ai/:id pages in dist/ai/`);
}

main();
