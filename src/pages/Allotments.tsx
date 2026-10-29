import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

// The tool itself (app.js + app.css + the data) lives in the separate "allotments" repo, so it can be
// updated by pushing there only. In production both repos share one origin (medicetamol.github.io,
// later the custom domain), so a root-relative path follows the domain automatically.
// In `npm run dev` that path does not exist, so the published copy is used.
const BASE = import.meta.env.PROD ? "/allotments/" : "https://medicetamol.github.io/allotments/";

type AllotmentsApi = { mount: (el: HTMLElement) => void; unmount: () => void };

declare global {
  interface Window {
    MediAllotments?: AllotmentsApi;
  }
}

let loader: Promise<AllotmentsApi> | null = null;

function loadAllotments(): Promise<AllotmentsApi> {
  if (window.MediAllotments) return Promise.resolve(window.MediAllotments);
  if (!loader) {
    loader = new Promise<AllotmentsApi>((resolve, reject) => {
      if (!document.querySelector("link[data-allotments]")) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = `${BASE}app.css`;
        link.dataset.allotments = "1";
        document.head.appendChild(link);
      }
      const script = document.createElement("script");
      script.src = `${BASE}app.js`;
      script.async = true;
      script.onload = () =>
        window.MediAllotments ? resolve(window.MediAllotments) : reject(new Error("allotments: app.js did not register"));
      script.onerror = () => reject(new Error("allotments: could not load app.js"));
      document.head.appendChild(script);
    }).catch((err) => {
      loader = null; // allow a retry on the next visit
      throw err;
    });
  }
  return loader;
}

export default function Allotments() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "NEET-PG Seat Allotments | mediCetamol";
    let cancelled = false;
    loadAllotments()
      .then((api) => {
        if (!cancelled && hostRef.current) api.mount(hostRef.current);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      window.MediAllotments?.unmount();
      document.title = previousTitle;
    };
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <Link
        to="/"
        className="mb-2 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-200"
      >
        <ChevronLeft size={16} /> Home
      </Link>

      <div id="al-root" ref={hostRef} />

      {failed && (
        <p className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/50 p-5 text-sm text-slate-400">
          Could not load the allotment tool. Please check your connection and reload the page.
        </p>
      )}
    </main>
  );
}
