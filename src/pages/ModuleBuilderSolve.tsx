import { ArrowLeft, Check, Copy, Share2 } from "lucide-react";
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import React, { useMemo, useState } from 'react';
import { getSiteUrl, shareOrCopy } from "../lib/sharing";
import { encodeModuleParams, subjectNamesFromIds } from "../lib/moduleShareCode";
import { clearModuleBuilderState } from "../lib/moduleBuilderState";
import { isStandalone } from "../lib/pwa";
import { saveCustomModuleHistory } from "../lib/db";
import { clearModuleDraft } from "../lib/moduleDraft";
import type { Exam } from "../types";
import ModuleFooterBar from "../components/ModuleFooterBar";

export default function ModuleBuilderSolve() {
  const { exam } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const examId = exam as Exam;

  const mode = searchParams.get("mode") === "quiz" ? "quiz" : "guide";
  const ids = useMemo(
    () => (searchParams.get("ids") ?? "").split(",").filter(Boolean),
    [searchParams]
  );

  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  if (ids.length === 0) {
    return <Navigate to={`/module/${examId}`} replace />;
  }

  const subjectNames = subjectNamesFromIds(ids);
  const subjectSummary =
    subjectNames.length === 0
      ? ""
      : subjectNames.length === 1
        ? subjectNames[0]
        : subjectNames.length === 2
          ? `${subjectNames[0]} and ${subjectNames[1]}`
          : subjectNames.length <= 4
            ? `${subjectNames.slice(0, -1).join(", ")}, and ${subjectNames[subjectNames.length - 1]}`
            : `${subjectNames.slice(0, 3).join(", ")}, and ${subjectNames.length - 3} more`;

  const durationMinutes = ids.length; // 1 min/question, matches existing quiz timer default

  const generateLink = () => {
    if (generating || shareUrl) return;
    setGenerating(true);
    try {
      // Build manually (not via URLSearchParams.toString()) so commas in the
      // "i" param stay literal — a shorter, more readable link to share.
      const query = encodeModuleParams({ exam: examId, mode, ids });
      const decodedQuery = query.replace(/%2C/gi, ",");
      setShareUrl(getSiteUrl(`/custom/module?${decodedQuery}`));
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    const result = await shareOrCopy({
      title: "mediCetamol Custom Module",
      text: `Solve this custom module — ${ids.length} PYQs from ${subjectSummary}.`,
      url: shareUrl,
    });
    if (result === "copied") {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  };

  const beginQuiz = () => {
    clearModuleBuilderState(examId);

    const startedAt = new Date().toISOString();
    const params = new URLSearchParams();
    params.set("source", "custom");
    params.set("mode", mode);
    params.set("ids", ids.join(","));
    params.set("moduleId", startedAt); // ties this session to its history row

    // Fresh history row immediately, before the quiz even mounts — so it
    // shows up in Solved Modules (as "Resume available") even if the user
    // never answers a single question before closing the tab.
    void saveCustomModuleHistory({
      id: startedAt,
      exam: examId,
      mode,
      startedAt,
      finishedAt: null,
      subjectLabel: subjectSummary || "Custom module",
      questionIds: ids,
      answers: ids.map(() => null),
      correctCount: 0,
      incorrectCount: 0,
      skippedCount: ids.length,
    });
    clearModuleDraft(); // any stale draft from a previous (now-expired) module

    const el = document.documentElement;
    // Installed app already runs in its own window — don't force fullscreen there.
    if (!isStandalone() && el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    }
    navigate(`/quiz/${examId}/custom?${params.toString()}`);
  };

  return (
    <main className="mx-auto max-w-2xl px-4 pb-28 pt-8 sm:px-6">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-6 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-200"
      >
        <ArrowLeft size={16} /> BACK
      </button>

      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8">
        <p className="text-xs uppercase tracking-wider text-slate-500">Custom Module</p>
        <h1 className="mt-2 text-2xl font-bold">
          {ids.length} PYQ{ids.length === 1 ? "" : "s"}
        </h1>
        {subjectSummary && (
          <p className="mt-1 text-sm leading-6 text-slate-400">From {subjectSummary}</p>
        )}
        <p className="mt-3 text-xs text-slate-500">
          {mode === "quiz" ? "Exam Mode" : "Guide Mode"}
        </p>

        <div className="mt-6">
          {!shareUrl ? (
            <button
              type="button"
              onClick={generateLink}
              disabled={generating}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50"
            >
              <Share2 size={16} /> Generate Link to Share
            </button>
          ) : (
            <div className="space-y-3">
              <p className="truncate rounded-lg bg-slate-950 px-3 py-2 text-xs text-slate-400">{shareUrl}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? "Copied" : "Copy"}
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-950"
                >
                  <Share2 size={14} /> Share
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-16 text-center sm:mt-20">
        <p className="mb-1 text-sm text-slate-400">
          Start solving this module with {ids.length} Question{ids.length === 1 ? "" : "s"}
        </p>
        {mode === "quiz" && (
          <p className="text-xs text-slate-600">Total Duration: {durationMinutes} minutes</p>
        )}
      </div>

      <ModuleFooterBar>
        <button
          type="button"
          onClick={beginQuiz}
          className="w-full rounded-xl bg-slate-100 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-slate-50"
        >
          Solve Module
        </button>
      </ModuleFooterBar>
    </main>
  );
}
