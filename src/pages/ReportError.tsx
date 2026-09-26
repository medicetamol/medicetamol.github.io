import { AlertTriangle, ArrowLeft, ImagePlus, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { REPORT_CATEGORIES, submitReport, type ReportCategory } from "../lib/reportError";
import { findQuestion, loadExplanations } from "../data/questions";
import type { PYQQuestion } from "../types";
import AuthPromptModal from "../components/AuthPromptModal";

const OPTION_LABELS = ["A", "B", "C", "D", "E", "F"];

export default function ReportError() {
  const { questionId } = useParams<{ questionId: string }>();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [category, setCategory] = useState<ReportCategory>("question");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Display-only reference for the person filling the report — fetched
  // purely so they can see exactly what they're reporting on. None of this
  // (question text, options, explanation) is ever submitted to Firestore or
  // included in the email; only their typed description goes through.
  const [question, setQuestion] = useState<PYQQuestion | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [questionLoading, setQuestionLoading] = useState(!!questionId);

  useEffect(() => {
    if (!questionId) {
      setQuestionLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const q = await findQuestion(questionId);
        if (cancelled) return;
        setQuestion(q ?? null);
        if (q) {
          const explanations = await loadExplanations(q.exam, q.subjectId);
          if (cancelled) return;
          const match = explanations.find((e) => e.id === q.id);
          setExplanation(match?.e ?? null);
        }
      } catch (err) {
        console.error("Could not load question for report reference", err);
      } finally {
        if (!cancelled) setQuestionLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [questionId]);

  // Report-error is the one "hard" trigger: sign-in is required to submit,
  // regardless of the soft-prompt milestone/day-cap system. If not signed
  // in, block the whole form behind the prompt; dismissing just leaves.
  if (!loading && !user) {
    return (
      <AuthPromptModal
        variant="hard"
        reason="Sign in to report an error"
        onSignedIn={() => {}}
        onDismiss={() => navigate(-1)}
      />
    );
  }

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5MB.");
      return;
    }
    setError(null);
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const clearImage = () => {
    setImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!description.trim()) {
      setError("Please describe the issue.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await submitReport({
        category,
        description: description.trim(),
        image,
        questionId,
        user,
      });
      setDone(true);
    } catch (err) {
      console.error(err);
      setError("Couldn't submit the report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center sm:px-6">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-400">
          <AlertTriangle size={26} />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-slate-100">Report submitted</h1>
        <p className="mt-2 text-sm text-slate-400">
          Thanks — we'll take a look. You can close this page now.
        </p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mt-6 rounded-xl border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm font-medium text-slate-100 hover:bg-slate-800"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6 sm:px-6">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-4 flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200"
      >
        <ArrowLeft size={16} /> Back
      </button>

      <h1 className="text-lg font-semibold text-slate-100">Report an error</h1>

      {/* Read-only question reference — shown so the person can point to
          exactly what's wrong without retyping the question themselves.
          Never submitted. */}
      {questionId && (
        <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
          {questionLoading ? (
            <p className="text-sm text-slate-500">Loading question…</p>
          ) : question ? (
            <>
              <p className="text-sm leading-6 text-slate-200">{question.question}</p>
              <div className="mt-3 space-y-1.5">
                {question.options.map((opt, i) => (
                  <p
                    key={i}
                    className={`text-sm leading-5 ${
                      i === question.answer
                        ? "font-medium text-emerald-400"
                        : "text-slate-400"
                    }`}
                  >
                    {OPTION_LABELS[i]}. {opt}
                    {i === question.answer && (
                      <span className="ml-1.5 text-xs text-emerald-500">(correct)</span>
                    )}
                  </p>
                ))}
              </div>
              {explanation && (
                <div className="mt-3 border-t border-slate-800 pt-3">
                  <p className="text-xs font-medium text-slate-400">Explanation</p>
                  <p className="mt-1 text-sm leading-6 text-slate-400">{explanation}</p>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-500">
              Question: <span className="text-slate-400">{questionId}</span>
            </p>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-5 space-y-5">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-300">Category</label>
          <div className="grid grid-cols-2 gap-2">
            {REPORT_CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value)}
                className={`rounded-xl border px-3 py-2.5 text-left text-sm ${
                  category === c.value
                    ? "border-slate-400 bg-slate-800 text-slate-100"
                    : "border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-600"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-300">
            Describe the issue
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            placeholder="What's wrong, and what should it say instead?"
            className="w-full rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-slate-600 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-300">
            Add an image <span className="text-slate-600">(optional)</span>
          </label>

          {imagePreview ? (
            <div className="relative w-fit">
              <img
                src={imagePreview}
                alt="Attached"
                className="max-h-48 rounded-xl border border-slate-800"
              />
              <button
                type="button"
                onClick={clearImage}
                className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-slate-900 text-slate-300 shadow"
                aria-label="Remove image"
              >
                <X size={15} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 rounded-xl border border-dashed border-slate-700 px-4 py-3 text-sm text-slate-400 hover:border-slate-500 hover:text-slate-200"
            >
              <ImagePlus size={18} /> Attach screenshot
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImagePick}
            className="hidden"
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-page hover:bg-white disabled:opacity-60"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" /> Submitting…
            </span>
          ) : (
            "Submit report"
          )}
        </button>
      </form>
    </div>
  );
}
