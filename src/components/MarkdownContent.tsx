import { Fragment } from "react";
import { Ban, Brain, Lightbulb, Target, type LucideIcon } from "lucide-react";

type SectionStyle = {
  icon: LucideIcon;
  label: string;
  border: string;
  tint: string;
  text: string;
};

// Matched by exact heading text (case-insensitive). Anything else (custom
// table headings like "Muscles of Mastication") falls through to the plain
// heading style below, unstyled and uncoloured.
const SECTION_STYLES: Record<string, SectionStyle> = {
  "trigger point": {
    icon: Target,
    label: "Trigger Point",
    border: "#378ADD",
    tint: "rgba(55,138,221,0.10)",
    text: "#85B7EB",
  },
  "why not the other options?": {
    icon: Ban,
    label: "Why Not the Other Options?",
    border: "#E24B4A",
    tint: "rgba(226,75,74,0.08)",
    text: "#F09595",
  },
  "why the others are true": {
    icon: Ban,
    label: "Why the Others Are True",
    border: "#E24B4A",
    tint: "rgba(226,75,74,0.08)",
    text: "#F09595",
  },
  "mind capsule": {
    icon: Lightbulb,
    label: "Mind Capsule",
    border: "#EF9F27",
    tint: "rgba(239,159,39,0.10)",
    text: "#FAC775",
  },
  "memory hook": {
    icon: Brain,
    label: "Memory Hook",
    border: "#7F77DD",
    tint: "rgba(127,119,221,0.10)",
    text: "#AFA9EC",
  },
};

// Resolves an image `src` against the URL of the .md file it came from, so
// all of these work in an explanation file:
//   ../images/PGEN007e.webp                       (relative to the .md file)
//   /PYQs/NEET-PG/ent/images/PGEN007e.webp        (root-relative)
//   https://medicetamol.github.io/.../x.webp      (full URL, left unchanged)
// If no baseUrl is given, the src is returned as written.
function resolveImageSrc(src: string, baseUrl?: string): string {
  if (!baseUrl) return src;
  try {
    return new URL(src, new URL(baseUrl, window.location.href)).href;
  } catch {
    return src;
  }
}

function inlineParts(text: string, baseUrl?: string) {
  const parts = text
    .replace(/<br\s*\/?>/gi, "\n")
    .split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\n)/g);

  return parts.map((part, index) => {
    if (part === "\n") {
      return <br key={index} />;
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={index} className="rounded bg-slate-800 px-1 py-0.5 text-[0.9em] text-slate-200">
          {part.slice(1, -1)}
        </code>
      );
    }
    const image = part.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (image) {
      return (
        <img
          key={index}
          src={resolveImageSrc(image[2], baseUrl)}
          alt={image[1]}
          loading="lazy"
          className="max-h-[28rem] w-full rounded-xl object-contain"
        />
      );
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      return (
        <a
          key={index}
          href={link[2]}
          target="_blank"
          rel="noreferrer"
          className="text-sky-400 underline underline-offset-2"
        >
          {link[1]}
        </a>
      );
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

// Renders everything that isn't a top-level `#`/`##` heading: paragraphs,
// blockquotes, tables, lists, code blocks, and standalone reference images.
function renderBlocks(lines: string[], keyPrefix: string, baseUrl?: string): JSX.Element[] {
  const blocks: JSX.Element[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    if (!line) {
      i++;
      continue;
    }

    if (line.startsWith("```")) {
      const language = line.slice(3).trim();
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        code.push(lines[i]);
        i++;
      }
      i++;
      blocks.push(
        <pre key={`${keyPrefix}-${blocks.length}`} className="overflow-x-auto rounded-xl bg-slate-950 p-3 text-xs leading-6 text-slate-300">
          <code data-language={language || undefined}>{code.join("\n")}</code>
        </pre>
      );
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const Tag = level === 1 ? "h1" : level === 2 ? "h2" : "h3";
      const className =
        level === 1
          ? "text-lg font-bold text-slate-100"
          : level === 2
            ? "text-base font-bold text-slate-100"
            : "text-sm font-semibold text-slate-200";
      blocks.push(
        <Tag key={`${keyPrefix}-${blocks.length}`} className={className}>
          {inlineParts(heading[2], baseUrl)}
        </Tag>
      );
      i++;
      continue;
    }

    // Standalone reference image: `![caption text](url)` alone on its own
    // line. The bracket text becomes a visible caption under the image,
    // not just the alt attribute. No heading needed above it.
    const standaloneImage = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (standaloneImage) {
      const [, caption, src] = standaloneImage;
      i++;
      blocks.push(
        <figure
          key={`${keyPrefix}-${blocks.length}`}
          className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900"
        >
          <img
            src={resolveImageSrc(src, baseUrl)}
            alt={caption}
            loading="lazy"
            className="max-h-[28rem] w-full object-contain"
          />
          {caption ? (
            <figcaption className="border-t border-slate-800 px-3 py-2 text-center text-xs italic text-slate-500">
              {caption}
            </figcaption>
          ) : null}
        </figure>
      );
      continue;
    }

    if (line.startsWith("> ")) {
      const quoteLines: string[] = [line.slice(2)];
      i++;
      while (i < lines.length && lines[i].trim().startsWith("> ")) {
        quoteLines.push(lines[i].trim().slice(2));
        i++;
      }
      blocks.push(
        <blockquote
          key={`${keyPrefix}-${blocks.length}`}
          className="border-l-2 border-slate-600 pl-3 text-sm italic leading-6 text-slate-300"
        >
          {quoteLines.map((quoteLine, qIndex) => (
            <Fragment key={qIndex}>
              {qIndex > 0 ? <br /> : null}
              {inlineParts(quoteLine, baseUrl)}
            </Fragment>
          ))}
        </blockquote>
      );
      continue;
    }

    if (
      line.includes("|") &&
      i + 1 < lines.length &&
      /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[i + 1])
    ) {
      const headers = splitTableRow(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim().includes("|") && lines[i].trim()) {
        rows.push(splitTableRow(lines[i]));
        i++;
      }
      blocks.push(
        <div key={`${keyPrefix}-${blocks.length}`} className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full table-fixed text-left text-xs">
            <thead className="bg-slate-900 text-slate-300">
              <tr>
                {headers.map((cell, index) => (
                  <th key={index} className="break-words px-3 py-2 font-semibold">{inlineParts(cell, baseUrl)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-t border-slate-800">
                  {headers.map((_, cellIndex) => (
                    <td key={cellIndex} className="break-words px-3 py-2 align-top text-slate-400">
                      {inlineParts(row[cellIndex] ?? "", baseUrl)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={`${keyPrefix}-${blocks.length}`} className="list-disc space-y-1 pl-5 text-sm leading-6 text-slate-300">
          {items.map((item, index) => <li key={index}>{inlineParts(item, baseUrl)}</li>)}
        </ul>
      );
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i++;
      }
      blocks.push(
        <ol key={`${keyPrefix}-${blocks.length}`} className="list-decimal space-y-1 pl-5 text-sm leading-6 text-slate-300">
          {items.map((item, index) => <li key={index}>{inlineParts(item, baseUrl)}</li>)}
        </ol>
      );
      continue;
    }

    const paragraph: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,3})\s+/.test(lines[i].trim()) &&
      !/^!\[([^\]]*)\]\(([^)]+)\)$/.test(lines[i].trim()) &&
      !/^[-*]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim()) &&
      !lines[i].trim().startsWith("> ") &&
      !lines[i].trim().startsWith("```")
    ) {
      paragraph.push(lines[i].trim());
      i++;
    }
    blocks.push(
      <p key={`${keyPrefix}-${blocks.length}`} className="text-sm leading-6 text-slate-300">
        {inlineParts(paragraph.join(" "), baseUrl)}
      </p>
    );
  }

  return blocks;
}

type Section = {
  level: 0 | 1 | 2;
  title?: string;
  body: string[];
};

function splitIntoSections(lines: string[]): Section[] {
  const sections: Section[] = [];
  let current: Section = { level: 0, body: [] };

  for (const raw of lines) {
    const match = raw.trim().match(/^(#{1,2})\s+(.+)$/);
    if (match) {
      sections.push(current);
      current = { level: match[1].length as 1 | 2, title: match[2], body: [] };
    } else {
      current.body.push(raw);
    }
  }
  sections.push(current);

  return sections.filter((section) => section.title || section.body.some((l) => l.trim()));
}

export default function MarkdownContent({
  content,
  baseUrl,
}: {
  content: string;
  // URL of the .md file (the same one passed to fetch). Used to resolve
  // relative image paths such as ../images/PGEN007e.webp.
  baseUrl?: string;
}) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const sections = splitIntoSections(lines);

  return (
    <div className="space-y-7">
      {sections.map((section, index) => {
        const keyPrefix = `s${index}`;

        if (section.level === 1) {
          return (
            <div key={keyPrefix} className="space-y-4">
              <h1 className="text-lg font-bold text-slate-100">{inlineParts(section.title ?? "", baseUrl)}</h1>
              {renderBlocks(section.body, keyPrefix, baseUrl)}
            </div>
          );
        }

        if (section.level === 2) {
          const style = SECTION_STYLES[(section.title ?? "").trim().toLowerCase()];
          if (style) {
            const Icon = style.icon;
            return (
              <div
                key={keyPrefix}
                className="space-y-2 rounded-r-md border-l-[3px] p-3"
                style={{ borderColor: style.border, backgroundColor: style.tint }}
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: style.text }}>
                  <Icon size={15} aria-hidden="true" />
                  {style.label}
                </div>
                {renderBlocks(section.body, keyPrefix, baseUrl)}
              </div>
            );
          }

          // Custom / topic-named section (e.g. a reference table): plain
          // heading, no colour, no icon.
          return (
            <div key={keyPrefix} className="space-y-2">
              <h2 className="text-base font-bold text-slate-100">{inlineParts(section.title ?? "", baseUrl)}</h2>
              {renderBlocks(section.body, keyPrefix, baseUrl)}
            </div>
          );
        }

        // level 0: content before the first heading (shouldn't normally occur,
        // since every file starts with "# Heading").
        return <Fragment key={keyPrefix}>{renderBlocks(section.body, keyPrefix, baseUrl)}</Fragment>;
      })}
    </div>
  );
}
