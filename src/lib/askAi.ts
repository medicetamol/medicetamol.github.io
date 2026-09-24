import { shareOrCopy } from "./sharing";

export type AiApp = "chatgpt" | "claude" | "gemini" | "google" | "others";

export interface AskAiParams {
  text: string;
  shareTitle: string;
}

export interface AskAiResult {
  message: string;
}

const GEMINI_WEB_URL = "https://gemini.google.com/app";

function openTab(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}

function copyBestEffort(text: string): void {
  navigator.clipboard?.writeText(text).catch(() => {});
}

export async function openAiApp(app: AiApp, { text, shareTitle }: AskAiParams): Promise<AskAiResult> {
  switch (app) {
    case "chatgpt":
      openTab(`https://chatgpt.com/?q=${encodeURIComponent(text)}`);
      return { message: "Opening ChatGPT…" };

    case "claude":
      openTab(`https://claude.ai/new?q=${encodeURIComponent(text)}`);
      return { message: "Opening Claude…" };

    case "google":
      openTab(`https://www.google.com/search?q=${encodeURIComponent(text)}`);
      return { message: "Opening Google…" };

    case "gemini":
      copyBestEffort(text);
      openTab(GEMINI_WEB_URL);
      return { message: "Prompt copied, paste it in Gemini" };

    case "others":
    default: {
      const result = await shareOrCopy({ title: shareTitle, text });
      return {
        message:
          result === "copied" ? "AI prompt link copied"
          : result === "shared" ? "Share sheet opened"
          : "Unable to share",
      };
    }
  }
}
