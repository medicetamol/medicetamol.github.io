import { Component, type ErrorInfo, type ReactNode } from "react";
import { safeReload } from "../lib/reloadGuard";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render-time crashes anywhere below it. Without this, React unmounts the
 * whole tree on an uncaught error and the user is left with a blank page.
 *
 * Users only ever see a calm message with Reload / Home. Technical details go to the
 * console only. A failed lazy-page download (stale tab after a new deploy, flaky
 * network) reloads the page once automatically, which fixes it.
 */
const isChunkError = (e: Error): boolean =>
  /dynamically imported module|Importing a module script failed|Loading chunk|Loading CSS chunk|ChunkLoadError/i.test(
    `${e.name} ${e.message}`
  );

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("mediCetamol crashed:", error, info.componentStack);
    if (isChunkError(error)) safeReload(); // once per minute at most; otherwise the friendly screen stays
  }

  private reload = () => window.location.reload();

  private leave = () => {
    // Full reload to the home page: clears any half-broken in-memory state,
    // and makes sure we leave fullscreen / history traps behind.
    try {
      if (document.fullscreenElement) void document.exitFullscreen();
    } catch {
      /* ignore */
    }
    window.location.assign("/");
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <main className="mx-auto max-w-lg px-4 py-14 text-center sm:px-6">
        <h1 className="text-xl font-bold text-slate-100">Something went wrong</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Your progress so far is safe. Please reload or go back home.
        </p>

        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={this.reload}
            className="rounded-xl bg-accent px-5 py-3 text-sm font-bold text-accent-ink"
          >
            Reload
          </button>
          <button
            type="button"
            onClick={this.leave}
            className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200"
          >
            Go to Home
          </button>
        </div>
      </main>
    );
  }
}
