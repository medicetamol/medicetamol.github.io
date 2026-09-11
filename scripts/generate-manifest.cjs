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
      manifest[exam][subjectId] = { total: 0, topics: {} };
      continue;
    }
    try {
      const raw = fs.readFileSync(qFile, 'utf-8');
      const questions = JSON.parse(raw);
      const list = Array.isArray(questions) ? questions : [];

      const topics = {};
      for (const q of list) {
        const code = q.t;
        if (!code) continue;
        topics[code] = (topics[code] || 0) + 1;
      }

      manifest[exam][subjectId] = { total: list.length, topics };
    } catch {
      manifest[exam][subjectId] = { total: 0, topics: {} };
    }
  }
}

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

fs.writeFileSync(outFile, JSON.stringify(manifest, null, 2));
console.log(`Generated manifest.json with counts for ${exams.length} exam(s).`);