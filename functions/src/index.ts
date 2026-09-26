import { initializeApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import * as nodemailer from "nodemailer";

initializeApp();

// Set these once via:
//   firebase functions:secrets:set GMAIL_USER
//   firebase functions:secrets:set GMAIL_APP_PASSWORD
//   firebase functions:secrets:set REPORT_TO_EMAIL
// GMAIL_USER is the Gmail address that sends the mail (yours).
// GMAIL_APP_PASSWORD is a 16-char App Password from
// Google Account → Security → 2-Step Verification → App Passwords.
// REPORT_TO_EMAIL is who receives the notification — or defaults to
// GMAIL_USER (i.e. you email yourself).
const gmailUser = defineSecret("GMAIL_USER");
const gmailAppPassword = defineSecret("GMAIL_APP_PASSWORD");
const reportToEmail = defineSecret("REPORT_TO_EMAIL");

interface BugReport {
  category: string;
  description: string;
  imageUrl?: string | null;
  questionId?: string | null;
  questionUrl?: string | null;
  userId: string;
  userEmail?: string | null;
  userDisplayName?: string | null;
  status: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  question: "Question error",
  explanation: "Explanation error",
  factual: "Factual error",
  technical: "Technical error",
};

// Badge colors per category — text/background pair, kept readable in both
// light and dark Gmail themes.
const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  question: { bg: "#fee2e2", text: "#991b1b" },
  explanation: { bg: "#fef3c7", text: "#92400e" },
  factual: { bg: "#ede9fe", text: "#5b21b6" },
  technical: { bg: "#dbeafe", text: "#1e40af" },
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Pulls the report's image out of Storage by parsing its download-URL path,
 * so it can be embedded inline (cid:) rather than just linked. Returns null
 * on any failure — a missing/unfetchable image should never block the email.
 */
async function fetchImageBuffer(imageUrl: string): Promise<Buffer | null> {
  try {
    const match = imageUrl.match(/\/o\/(.+?)\?/);
    if (!match) return null;
    const path = decodeURIComponent(match[1]);
    const bucket = getStorage().bucket();
    const [buffer] = await bucket.file(path).download();
    return buffer;
  } catch (err) {
    console.error("Could not fetch report image from Storage", err);
    return null;
  }
}

export const onBugReportCreated = onDocumentCreated(
  {
    document: "bugReports/{reportId}",
    secrets: [gmailUser, gmailAppPassword, reportToEmail],
    region: "asia-south2",
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const report = snap.data() as BugReport;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser.value(),
        pass: gmailAppPassword.value(),
      },
    });

    const to = reportToEmail.value() || gmailUser.value();
    const categoryLabel = CATEGORY_LABELS[report.category] ?? report.category;
    const colors = CATEGORY_COLORS[report.category] ?? { bg: "#e2e8f0", text: "#1e293b" };

    const attachments: { filename: string; content: Buffer; cid: string }[] = [];
    let imageHtml = "";
    if (report.imageUrl) {
      const buffer = await fetchImageBuffer(report.imageUrl);
      if (buffer) {
        attachments.push({
          filename: "screenshot.jpg",
          content: buffer,
          cid: "report-screenshot",
        });
        imageHtml = `
          <tr>
            <td style="padding: 0 24px 20px;">
              <img src="cid:report-screenshot" alt="Attached screenshot"
                style="max-width: 100%; border-radius: 12px; border: 1px solid #e2e8f0; display: block;" />
            </td>
          </tr>`;
      } else {
        // Fallback: still give a working link if we couldn't fetch the bytes.
        imageHtml = `
          <tr>
            <td style="padding: 0 24px 20px;">
              <a href="${report.imageUrl}" style="color: #2563eb; font-size: 14px;">View attached screenshot</a>
            </td>
          </tr>`;
      }
    }

    const questionLineHtml = report.questionId
      ? `<p style="margin: 0 0 16px; font-size: 13px; color: #64748b;">Question: ${escapeHtml(report.questionId)}</p>`
      : "";

    const viewLiveHtml = report.questionUrl
      ? `
        <tr>
          <td style="padding: 0 24px 20px;">
            <a href="${report.questionUrl}"
              style="display: inline-block; background: #0f172a; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 10px 18px; border-radius: 10px;">
              View live question
            </a>
          </td>
        </tr>`
      : "";

    const html = `
      <div style="background: #f1f5f9; padding: 24px 0; font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">
          <tr>
            <td style="padding: 24px 24px 0;">
              <span style="display: inline-block; background: ${colors.bg}; color: ${colors.text}; font-size: 12px; font-weight: 700; letter-spacing: 0.02em; text-transform: uppercase; padding: 5px 12px; border-radius: 999px;">
                ${escapeHtml(categoryLabel)}
              </span>
              ${questionLineHtml ? `<div style="margin-top: 12px;">${questionLineHtml}</div>` : ""}
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 24px 20px;">
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px;">
                <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #0f172a; white-space: pre-wrap;">${escapeHtml(report.description)}</p>
              </div>
            </td>
          </tr>
          ${imageHtml}
          ${viewLiveHtml}
          <tr>
            <td style="padding: 16px 24px 24px; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.7;">
                Reported by ${escapeHtml(report.userDisplayName ?? "Unknown")}
                (${escapeHtml(report.userEmail ?? report.userId)})<br/>
                Report ID: ${escapeHtml(event.params.reportId)}
              </p>
            </td>
          </tr>
        </table>
      </div>`;

    await transporter.sendMail({
      from: gmailUser.value(),
      to,
      subject: `[${categoryLabel}] medicetamol${report.questionId ? ` — ${report.questionId}` : ""}`,
      html,
      attachments,
    });
  }
);
