import { ArrowLeft } from "lucide-react";
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { EXAMS, SUBJECTS } from "../constants";
import { loadQuestions } from "../data/questions";
import { decodeModuleParams, subjectNamesFromIds } from "../lib/moduleShareCode";

// ─── Typewriter caption (same pattern as Step 2) ────────────────────────────

const CAPTIONS = [
  "Crafting QBank only for you…",
  "Collecting questions from stars, at speed of light…",
  "Just wait a few moments…",
  "We are still on it…",
  "Please wait a little more…",
];

function useTypewriterCaption(active: boolean): string {
  const [text, setText] = useState("");
  const orderRef = useRef<number[]>([]);

  useEffect(() => {
    if (!active) return;

    const nextOrder = () => {
      if (orderRef.current.length === 0) {
        const order = CAPTIONS.map((_, i) => i);
        for (let i = order.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [order[i], order[j]] = [order[j], order[i]];
        }
        orderRef.current = order;
      }
      return orderRef.current.shift()!;
    };

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const typeCaption = (caption: string, onDone: () => void) => {
      let i = 0;
      const tick = () => {
        if (cancelled) return;
        i++;
        setText(caption.slice(0, i));
        if (i < caption.length) {
          timeoutId = setTimeout(tick, 35);
        } else {
          timeoutId = setTimeout(onDone, 1100);
        }
      };
      tick();
    };

    const eraseCaption = (onDone: () => void) => {
      const erase = () => {
        if (cancelled) return;
        setText((current) => {
          const next = current.slice(0, -1);
          if (next.length > 0) {
            timeoutId = setTimeout(erase, 18);
          } else {
            timeoutId = setTimeout(onDone, 150);
          }
          return next;
        });
      };
      erase();
    };

    const cycle = () => {
      if (cancelled) return;
      const caption = CAPTIONS[nextOrder()];
      typeCaption(caption, () => {
        if (cancelled) return;
        eraseCaption(cycle);
      });
    };

    cycle();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [active]);

  return text;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SharedModule() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const decoded = useMemo(() => decodeModuleParams(searchParams), [searchParams]);

  const [validIds, setValidIds] = useState<string[] | null>(null); // null = still loading
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!decoded) return;
    let cancelled = false;

    // Which subjects are actually referenced in the id list
    const subjectIdsNeeded = Array.from(
      new Set(
        decoded.ids
          .map((id) => {
            const code = id.slice(2, 4);
            return SUBJECTS.find((s) => s.code === code)?.id;
          })
          .filter((x): x is string => Boolean(x))
      )
    );

    Promise.all(subjectIdsNeeded.map((sid) => loadQuestions(decoded.exam, sid)))
      .then((results) => {
        if (cancelled) return;
        const loadedIds = new Set(results.flat().map((q) => q.id));
        const stillValid = decoded.ids.filter((id) => loadedIds.has(id));
        if (stillValid.length === 0) {
          setLoadFailed(true);
        } else {
          setValidIds(stillValid);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [decoded]);

  const caption = useTypewriterCaption(!loadFailed && validIds === null && Boolean(decoded));

  if (!decoded) {
    return (
      <main className="mx-auto max-w-lg px-4 py-14 text-center sm:px-6">
        <h1 className="text-xl font-bold">Invalid Link</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          This module link looks broken or incomplete. Ask your friend to send it again.
        </p>
        <Link to="/pyqs" className="mt-6 inline-block rounded-xl bg-slate-100 px-5 py-3 text-sm font-bold text-slate-950">
          Go to PYQs
        </Link>
      </main>
    );
  }

  if (loadFailed) {
    return (
      <main className="mx-auto max-w-lg px-4 py-14 text-center sm:px-6">
        <h1 className="text-xl font-bold">Module Unavailable</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          None of the questions in this link could be found. It may be outdated.
        </p>
        <Link to="/pyqs" className="mt-6 inline-block rounded-xl bg-slate-100 px-5 py-3 text-sm font-bold text-slate-950">
          Go to PYQs
        </Link>
      </main>
    );
  }

  const subjectNames = subjectNamesFromIds(decoded.ids);
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

  const loading = validIds === null;

  const handleContinue = () => {
    if (loading || !validIds) return;
    const params = new URLSearchParams();
    params.set("source", "custom");
    params.set("mode", decoded.mode);
    params.set("ids", validIds.join(","));
    navigate(`/module/${decoded.exam}/solve?${params.toString()}`);
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <Link to="/pyqs" className="mb-6 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-200">
        <ArrowLeft size={16} /> {EXAMS.find((e) => e.id === decoded.exam)?.name}
      </Link>

      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8">
        <p className="text-xs uppercase tracking-wider text-slate-500">Shared Module</p>
        <h1 className="mt-2 text-2xl font-bold">Solve this Custom Module</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Consisting {decoded.ids.length} PYQ{decoded.ids.length === 1 ? "" : "s"}
          {subjectSummary ? ` from ${subjectSummary}` : ""}
        </p>

        {loading && (
          <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3.5 text-center text-sm text-slate-400">
            <span>{caption}</span>
            <span
              className="ml-0.5 inline-block w-px animate-pulse bg-slate-500 align-middle"
              style={{ height: "1em" }}
            />
          </div>
        )}

        <button
          type="button"
          disabled={loading}
          onClick={handleContinue}
          className="mt-6 w-full rounded-xl bg-slate-100 px-5 py-3.5 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "LOADING…" : "CONTINUE"}
        </button>
      </div>
    </main>
  );
}
