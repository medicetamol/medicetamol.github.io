import { Component, type ErrorInfo, type ReactNode } from "react";

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
 * The technical details are tucked behind "Show details" so normal users see a calm
 * message, while a screenshot of the details is enough to diagnose the crash.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("mediCetamol crashed:", error, info.componentStack);
  }

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
          Your progress so far is safe. Please go back and try again.
        </p>

        <button
          type="button"
          onClick={this.leave}
          className="mt-6 inline-block rounded-xl bg-slate-100 px-5 py-3 text-sm font-bold text-slate-950"
        >
          Go to Home
        </button>

        <details className="mt-8 text-left">
          <summary className="cursor-pointer text-center text-xs text-slate-500">
            Show details
          </summary>
          <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-slate-800 bg-slate-950 p-3 text-[11px] leading-5 text-slate-400">
            {error.name}: {error.message}
            {error.stack ? `\n\n${error.stack.split("\n").slice(0, 8).join("\n")}` : ""}
          </pre>
        </details>
      </main>
    );
  }
}
