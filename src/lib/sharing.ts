import type { PYQQuestion } from "../types";

const SITE_ORIGIN = "https://medicetamol.github.io";

export function getSiteUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_ORIGIN}${normalizedPath}`;
}

export function formatQuestionForShare(
  question: PYQQuestion,
  options?: { includeBranding?: boolean }
): string {
  const includeBranding = options?.includeBranding ?? true;

  const optionsList = question.options
    .map((option, index) => `${String.fromCharCode(65 + index)}. ${option}`)
    .join("\n");

  if (!includeBranding) {
    return `${question.question}\n\n${optionsList}`;
  }

  return `🩺 mediceTaMol\n\n${question.question}\n\n${optionsList}\n\n📌 Directly solve here:`;
}

export type ShareResult = "shared" | "copied" | "failed";

interface SharePayload {
  title: string;
  text: string;
  url?: string;
  /** Attached as a native file share (e.g. an image) when the platform supports it. */
  files?: File[];
}

export async function shareOrCopy({
  title,
  text,
  url,
  files,
}: SharePayload): Promise<ShareResult> {
  const shareText = url ? `${text}\n${url}` : text;

  try {
    const canShareFiles = files?.length && navigator.canShare?.({ files });
    if (navigator.share && (!files?.length || canShareFiles)) {
      await navigator.share({
        title,
        text: shareText,
        ...(canShareFiles ? { files } : {}),
      });
      return "shared";
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return "failed";
    }
  }

  try {
    await navigator.clipboard.writeText(shareText);
    return "copied";
  } catch {
    return "failed";
  }
}

/**
 * Best-effort fetch of a same-origin question/explanation image as a File,
 * ready to attach to a native share or write to the clipboard. Returns null
 * on any failure (offline, 404, unsupported) — callers degrade gracefully.
 */
export async function fetchImageFile(imageUrl: string, fileName = "question-image.webp"): Promise<File | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new File([blob], fileName, { type: blob.type || "image/webp" });
  } catch {
    return null;
  }
}