import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { countVisitIfNeeded, subscribeVisitorCount } from "../lib/visitorCount";
import { afterFirstPaint } from "../lib/afterFirstPaint";

export default function VisitorCount() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    // Deferred so the Firestore write + live listener don't compete with
    // the initial paint — see afterFirstPaint.ts.
    const cancel = afterFirstPaint(() => {
      countVisitIfNeeded();
      unsubscribe = subscribeVisitorCount(setCount);
    });
    return () => {
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
