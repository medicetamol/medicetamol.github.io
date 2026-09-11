const fs = require('fs');
const path = require('path');

const root = process.cwd();
const pyqsDir = path.join(root, 'PYQs');
const outDir = path.join(root, 'src', 'data');
const outFile = path.join(outDir, 'manifest.json');

if (!fs.existsSync(pyqsDir)) {
  console.error('PYQs directory not found.');
  process.exit(1);
}

const manifest = {};

const exams = fs.readdirSync(pyqsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

for (const exam of exams) {
  const examDir = path.join(pyqsDir, exam);
  const subjects = fs.readdirSync(examDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  manifest[exam] = {};

  for (const subjectId of subjects) {
    const qFile = path.join(examDir, subjectId, 'questions.json');
    if (!fs.existsSync(qFile)) {
      manifest[exam][subjectId] = 0;
      continue;
    }
    try {
      const raw = fs.readFileSync(qFile, 'utf-8');
      const questions = JSON.parse(raw);
      manifest[exam][subjectId] = Array.isArray(questions) ? questions.length : 0;
    } catch {
      manifest[exam][subjectId] = 0;
    }
  }
}

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

fs.writeFileSync(outFile, JSON.stringify(manifest, null, 2));
console.log(`Generated manifest.json with counts for ${exams.length} exam(s).`);
