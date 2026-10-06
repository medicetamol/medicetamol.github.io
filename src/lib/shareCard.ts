import type { PYQQuestion } from "../types";
import { getSiteUrl } from "./sharing";

// Logical layout units — multiplied by SCALE at render time for a crisp,
// retina-ready PNG without touching any of the numbers below.
const CARD_WIDTH = 1080;
const PAD = 48;
const SCALE = 1.5;

// Cards shorter than this (short question, no image, few options) get a
// branded footer stretched to fill the gap, so no card ever looks squat —
// every share always reads as a proper portrait card. Footer height is
// simply `max(0, CARD_WIDTH * MIN_ASPECT - contentHeight)`, so it shrinks
// to 0 and disappears entirely once real content is already tall enough.
const MIN_ASPECT = 1.4;

const BG = "#0b0f14";
const CARD_BG = "#0f172a";
const BORDER = "#1e293b";
const TEXT_MAIN = "#f1f5f9";
const TEXT_SUB = "#cbd5e1";
const ACCENT = "#2dd4bf";
const META_COLOR = "#64748b";
const OPT_LETTER_BG = "#1e293b";

// Same font stack as the site's own CSS (index.css / index.html) — on
// device this resolves to the system sans-serif (e.g. Roboto on Android),
// matching the app's own look rather than a generic fallback.
const FONT_STACK =
  "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth || !current) {
      current = test;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Renders a branded share card for a question — logo header, question text,
 * the question image (if any, letterboxed to the full content width so it
 * always lines up with the options below it), the options, a faint logo
 * watermark behind the options block, a meta line, and (for shorter cards)
 * a branded footer that stretches to keep every card at a consistent
 * portrait aspect ratio — as a PNG File.
 *
 * Used by both the plain Share button (every question) and Ask AI (image
 * questions only). Returns null on any failure (canvas unsupported, image
 * load/network failure, toBlob failure) — callers should fall back to a
 * text-only share rather than silently showing a broken attachment.
 */
export async function buildShareCardFile(question: PYQQuestion): Promise<File | null> {
  try {
    const measureCanvas = document.createElement("canvas");
    const mCtx = measureCanvas.getContext("2d");
    if (!mCtx) return null;

    const contentW = CARD_WIDTH - PAD * 2;

    // --- question text wrap ---
    mCtx.font = `bold 46px ${FONT_STACK}`;
    const qLines = wrapText(mCtx, question.question, contentW);
    const qLineHeight = 58;
    const qBlockH = qLines.length * qLineHeight;

    // --- load logo + question image (if any) up front, so layout height is known before drawing ---
    const [logo, qImg] = await Promise.all([
      loadImage("/logo.png"),
      question.image ? loadImage(question.image) : Promise.resolve(null),
    ]);

    const MAX_IMG_H = 520;
    let boxH = 0, dispW = 0, dispH = 0, offX = 0, offY = 0;
    if (qImg) {
      const naturalHAtFullWidth = qImg.height * (contentW / qImg.width);
      boxH = Math.min(naturalHAtFullWidth, MAX_IMG_H);
      const scale = Math.min(contentW / qImg.width, boxH / qImg.height);
      dispW = qImg.width * scale;
      dispH = qImg.height * scale;
      offX = (contentW - dispW) / 2;
      offY = (boxH - dispH) / 2;
    }

    // --- options: wrap each option's text, since option length varies a lot across questions ---
    const optFontSize = 38;
    const optLineHeight = 44;
    const chip = 64;
    const optTextMaxWidth = contentW - 20 - chip - 26 - 26;
    mCtx.font = `${optFontSize}px ${FONT_STACK}`;
    const optionRows = question.options.map((text, i) => {
      const lines = wrapText(mCtx, text, optTextMaxWidth);
      const rowH = Math.max(108, lines.length * optLineHeight + 48);
      return { letter: String.fromCharCode(65 + i), lines, rowH };
    });
    const optGap = 22;
    const optionsBlockH = optionRows.reduce((sum, r) => sum + r.rowH + optGap, 0);

    const headerH = 126, stripH = 6, topPad = 46, bottomPad = 54, metaH = 64;
    const imgSectionH = qImg ? boxH + 42 : 0;

    const contentTotalH = Math.round(
      headerH + stripH + topPad + qBlockH + 42 + imgSectionH + optionsBlockH + metaH + bottomPad
    );

    const minTotalH = Math.round(CARD_WIDTH * MIN_ASPECT);
    const footerH = Math.max(0, minTotalH - contentTotalH);
    const totalH = contentTotalH + footerH;

    // --- real canvas, scaled for crispness ---
    const canvas = document.createElement("canvas");
    canvas.width = CARD_WIDTH * SCALE;
    canvas.height = totalH * SCALE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.scale(SCALE, SCALE);
    ctx.textBaseline = "alphabetic";

    // background
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, CARD_WIDTH, totalH);

    // header: logo + wordmark
    const logoH = 74;
    if (logo) ctx.drawImage(logo, PAD, 28, logoH, logoH);
    ctx.fillStyle = TEXT_MAIN;
    ctx.font = `bold 50px ${FONT_STACK}`;
    ctx.fillText("mediCetamol", PAD + logoH + 20, 28 + logoH / 2 + 17);

    // turquoise strip
    ctx.fillStyle = ACCENT;
    ctx.fillRect(0, headerH, CARD_WIDTH, stripH);

    let y = headerH + stripH + topPad;

    // question text
    ctx.fillStyle = TEXT_MAIN;
    ctx.font = `bold 46px ${FONT_STACK}`;
    for (const line of qLines) {
      ctx.fillText(line, PAD, y + 40);
      y += qLineHeight;
    }
    y += 42;

    // question image box (white-filled, letterboxed, full content width)
    if (qImg) {
      roundedRectPath(ctx, PAD, y, contentW, boxH, 20);
      ctx.save();
      ctx.clip();
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(PAD, y, contentW, boxH);
      ctx.drawImage(qImg, PAD + offX, y + offY, dispW, dispH);
      ctx.restore();
      ctx.strokeStyle = BORDER;
      ctx.lineWidth = 2;
      roundedRectPath(ctx, PAD, y, contentW, boxH, 20);
      ctx.stroke();
      y += boxH + 42;
    }

    // faint logo watermark behind the options block
    if (logo) {
      const wmSize = optionsBlockH;
      ctx.save();
      ctx.globalAlpha = 0.09;
      ctx.drawImage(logo, CARD_WIDTH / 2 - wmSize / 2, y, wmSize, wmSize);
      ctx.restore();
    }

    // options
    for (const { letter, lines, rowH } of optionRows) {
      roundedRectPath(ctx, PAD, y, contentW, rowH, 18);
      ctx.fillStyle = CARD_BG;
      ctx.fill();
      ctx.strokeStyle = BORDER;
      ctx.lineWidth = 2;
      ctx.stroke();

      const chipY = y + (rowH - chip) / 2;
      roundedRectPath(ctx, PAD + 20, chipY, chip, chip, 14);
      ctx.fillStyle = OPT_LETTER_BG;
      ctx.fill();

      ctx.fillStyle = TEXT_SUB;
      ctx.font = `bold 32px ${FONT_STACK}`;
      const letterW = ctx.measureText(letter).width;
      ctx.fillText(letter, PAD + 20 + chip / 2 - letterW / 2, chipY + chip / 2 + 11);

      ctx.font = `${optFontSize}px ${FONT_STACK}`;
      const textBlockH = lines.length * optLineHeight;
      let lineY = y + rowH / 2 - textBlockH / 2 + optLineHeight - 13;
      for (const line of lines) {
        ctx.fillText(line, PAD + 20 + chip + 26, lineY);
        lineY += optLineHeight;
      }

      y += rowH + optGap;
    }

    // meta line
    y += 12;
    ctx.fillStyle = META_COLOR;
    ctx.font = `28px ${FONT_STACK}`;
    const metaParts = [question.id, String(question.year), question.topicName ?? question.topicId].filter(Boolean);
    ctx.fillText(metaParts.join("  •  "), PAD, y + 20);
    y += metaH;

    // branded footer — only present when content falls short of the portrait minimum
    if (footerH > 0 && logo) {
      ctx.strokeStyle = BORDER;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(PAD, y + 10);
      ctx.lineTo(CARD_WIDTH - PAD, y + 10);
      ctx.stroke();

      const remaining = totalH - (y + 10) - bottomPad;
      const centerY = y + 10 + remaining / 2;
      const bigLogoSize = 130;
      ctx.drawImage(logo, CARD_WIDTH / 2 - bigLogoSize / 2, centerY - 95, bigLogoSize, bigLogoSize);

      ctx.font = `28px ${FONT_STACK}`;
      ctx.fillStyle = META_COLOR;
      const tag = "Practice NEET-PG • INI-CET • FMGE PYQs";
      const tagW = ctx.measureText(tag).width;
      ctx.fillText(tag, CARD_WIDTH / 2 - tagW / 2, centerY + 42);

      ctx.fillStyle = ACCENT;
      const siteLabel = getSiteUrl("/").replace(/^https?:\/\//, "").replace(/\/$/, "");
      const siteW = ctx.measureText(siteLabel).width;
      ctx.fillText(siteLabel, CARD_WIDTH / 2 - siteW / 2, centerY + 82);
    }

    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
    if (!blob) return null;
    return new File([blob], `${question.id}.png`, { type: "image/png" });
  } catch {
    return null;
  }
}
