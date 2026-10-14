// Splits a question stem into plain text, numbered/lettered lists and
// matching (List I / List II) blocks. Pure render-time helper: data stays as is.

export type StemItem = { label: string; text: string };
export type StemBlock =
  | { type: "text"; text: string }
  | { type: "list"; items: StemItem[] }
  | { type: "match"; left: StemItem[]; right: StemItem[] }
  | { type: "pairs"; rows: { left: StemItem; right: StemItem }[] };

type Kind = "D" | "U" | "L";
const ITEM = /^\(?([A-Za-z]|\d{1,2})[.)]\s+(\S.*)$/;
const PAIR = /^(.*?)\s+[—–-]\s+\(?([A-Za-z]|\d{1,2})[.)]\s+(\S.*)$/;

function kindOf(label: string): Kind {
  if (/^\d+$/.test(label)) return "D";
  return label === label.toUpperCase() ? "U" : "L";
}

function parseItem(line: string): (StemItem & { kind: Kind }) | null {
  const m = line.match(ITEM);
  if (!m) return null;
  return { label: m[1], text: m[2].trim(), kind: kindOf(m[1]) };
}

export function parseStem(stem: string): StemBlock[] {
  const lines = stem.replace(/\r/g, "").split("\n");
  type Run = { kind: Kind; items: StemItem[] };
  const blocks: StemBlock[] = [];
  let textBuf: string[] = [];
  let run: Run | null = null;
  let prevRun: Run | null = null; // finished run that may pair with the next one
  let gap: string[] = []; // blank/heading lines between two runs

  const flushText = () => {
    const t = textBuf.join("\n").trim();
    if (t) blocks.push({ type: "text", text: t });
    textBuf = [];
  };
  const pushRun = (r: Run) => blocks.push({ type: "list", items: r.items });
  const flushPrev = () => {
    if (prevRun) pushRun(prevRun);
    prevRun = null;
    if (gap.length) { textBuf.push(...gap); gap = []; }
  };

  for (const raw of lines) {
    const line = raw.trim();
    const it = line ? parseItem(line) : null;

    if (it) {
      if (run && run.kind === it.kind) {
        run.items.push({ label: it.label, text: it.text });
        continue;
      }
      if (run) { // kind changed -> candidate matching pair
        if (prevRun) flushPrev();
        prevRun = run; gap = [];
        run = null;
      }
      if (prevRun && prevRun.kind !== it.kind && prevRun.items.length >= 2) {
        run = { kind: it.kind, items: [{ label: it.label, text: it.text }] };
        continue;
      }
      if (prevRun) flushPrev();
      flushText();
      run = { kind: it.kind, items: [{ label: it.label, text: it.text }] };
      continue;
    }

    // non-item line
    if (run) {
      // end of current run
      if (prevRun && prevRun.kind !== run.kind && prevRun.items.length >= 2 && run.items.length >= 2) {
        blocks.push({ type: "match", left: prevRun.items, right: run.items });
        prevRun = null; gap = [];
      } else {
        if (prevRun) flushPrev();
        prevRun = run;
        gap = [];
        run = null;
        // this line may be a short heading ("Descriptions:") between two groups
        if (!line) continue;
        if (/:$/.test(line) && line.length <= 40) { gap.push(line); continue; }
        flushPrev();
        textBuf.push(line);
        continue;
      }
      run = null;
      if (line) textBuf.push(line);
      continue;
    }
    if (prevRun) {
      // blank lines or short heading ("Descriptions:") may sit between groups; keep waiting
      if (!line || (/:$/.test(line) && line.length <= 40)) { if (line) gap.push(line); continue; }
      flushPrev();
    }
    textBuf.push(raw);
  }

  // end of input
  if (run) {
    if (prevRun && prevRun.kind !== run.kind && prevRun.items.length >= 2 && run.items.length >= 2) {
      flushText();
      blocks.push({ type: "match", left: prevRun.items, right: run.items });
      prevRun = null;
    } else {
      if (prevRun) flushPrev();
      flushText();
      pushRun(run);
    }
  }
  if (prevRun) { flushPrev(); }
  flushText();

  // "A) Equinus — 1. Longitudinal arch ..." style rows
  return blocks.map((b) => {
    if (b.type !== "list") return b;
    const rows = b.items.map((i) => {
      const m = i.text.match(PAIR);
      return m ? { left: { label: i.label, text: m[1].trim() }, right: { label: m[2], text: m[3].trim() } } : null;
    });
    if (rows.length >= 2 && rows.every(Boolean)) return { type: "pairs", rows: rows as any };
    return b;
  });
}
