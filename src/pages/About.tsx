import { ArrowLeft, BookOpen, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from 'react-router-dom';

export default function About() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-200"
      >
        <ArrowLeft size={16} /> Home
      </Link>

      <h1 className="text-2xl font-bold sm:text-3xl">About mediCetamol</h1>
      <p className="mt-3 text-sm leading-6 text-slate-400 sm:text-base">
        mediCetamol is a focused PYQ practice platform built for medical
        students preparing for NEET PG, INI-CET and FMGE. It exists for one
        reason: solving real, previously-asked exam questions is one of the
        most effective ways to prepare — so we built a place to do that
        without the clutter.
      </p>

      <section className="mt-8 space-y-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
            <BookOpen size={17} className="text-slate-400" />
            What's on the platform
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Previous Year Questions organised by exam, subject and topic —
            with explanations, bookmarking, custom practice modules and
            progress tracking. No sign-up wall, no ads, no distractions.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
            <ShieldCheck size={17} className="text-slate-400" />
            Where the questions come from
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Every question on mediCetamol is a genuine previously-asked exam
            question, not an AI-generated approximation. Explanations are
            written to be exam-relevant and concise, aimed at helping you
            reason through the answer rather than just memorise it.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
            <Sparkles size={17} className="text-slate-400" />
            Who's behind it
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            mediCetamol is an independent, small project built by people who
            understand what exam prep actually needs — not a large company,
            just a focused tool built with care.
          </p>
        </div>
      </section>

      <p className="mt-8 text-xs leading-6 text-slate-600">
        mediCetamol is an educational resource intended to support exam
        preparation. Always cross-check important medical facts with standard
        textbooks and current official guidelines.
      </p>
    </main>
  );
}
