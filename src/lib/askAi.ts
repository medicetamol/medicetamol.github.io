import { shareOrCopy } from "./sharing";

export type AiApp = "chatgpt" | "claude" | "gemini" | "google" | "others";

export interface AskAiParams {
  text: string;
  shareTitle: string;
  /**
   * Pre-fetched image file for image-based questions (fetched once when the
   * sheet opens, reused across every app tap). Undefined for text-only questions.
   */
  imageFile?: File | null;
}

export interface AskAiResult {
  message: string;
}

const GEMINI_WEB_URL = "https://gemini.google.com/app";

function openTab(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}

function copyTextBestEffort(text: string): void {
  navigator.clipboard?.writeText(text).catch(() => {});
}

// Best-effort image clipboard copy for the four deep-link apps (ChatGPT, Claude,
// Google, Gemini): none of these can receive a file via URL, so the image is
// placed on the clipboard for the user to paste manually once the app opens.
// Silently does nothing on failure/unsupported — the red caption in AskAiSheet
// tells the user to screenshot-paste as a fallback.
function copyImageBestEffort(imageFile?: File | null): void {
  if (!imageFile || !navigator.clipboard?.write || typeof ClipboardItem === "undefined") return;
  try {
    const item = new ClipboardItem({ [imageFile.type]: imageFile });
    navigator.clipboard.write([item]).catch(() => {});
  } catch {
    // best-effort only
  }
}

export async function openAiApp(app: AiApp, { text, shareTitle, imageFile }: AskAiParams): Promise<AskAiResult> {
  switch (app) {
    case "chatgpt":
      copyImageBestEffort(imageFile);
      openTab(`https://chatgpt.com/?q=${encodeURIComponent(text)}`);
      return { message: "Opening ChatGPT…" };

    case "claude":
      copyImageBestEffort(imageFile);
      openTab(`https://claude.ai/new?q=${encodeURIComponent(text)}`);
      return { message: "Opening Claude…" };

    case "google":
      copyImageBestEffort(imageFile);
      openTab(`https://www.google.com/search?q=${encodeURIComponent(text)}`);
      return { message: "Opening Google…" };

    case "gemini":
      copyImageBestEffort(imageFile);
      copyTextBestEffort(text);
      openTab(GEMINI_WEB_URL);
      return { message: "Prompt copied, paste it in Gemini" };

    case "others":
    default: {
      // "Others" routes through the native OS share sheet, which can carry the
      // image as a real file attachment (more reliable than clipboard-paste).
      const result = await shareOrCopy({
        title: shareTitle,
        text,
        ...(imageFile ? { files: [imageFile] } : {}),
      });
      return {
        message:
          result === "copied" ? "AI prompt link copied"
          : result === "shared" ? "Share sheet opened"
          : "Unable to share",
      };
    }
  }
}
