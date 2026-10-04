import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { afterFirstPaint } from "../lib/afterFirstPaint";

export default function VisitorCount() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let disposed = false;
    // Deferred so the Firestore write + live listener don't compete with
    // the initial paint — see afterFirstPaint.ts. Firestore is loaded here
    // (dynamic import) so it stays out of the entry bundle.
    const cancel = afterFirstPaint(() => {
      void import("../lib/visitorCount")
        .then(({ countVisitIfNeeded, subscribeVisitorCount }) => {
          if (disposed) return;
          countVisitIfNeeded();
          unsubscribe = subscribeVisitorCount(setCount);
        })
        .catch(() => {});
    });
    return () => {
      disposed = true;
      cancel();
      unsubscribe?.();
    };
  }, []);

  if (count === null) return null;

  return (
    <div className="inline-flex items-center gap-1.5 text-xs text-slate-500">
      <Users size={14} />
      <span>{count.toLocaleString()} visitors</span>
    </div>
  );
}
