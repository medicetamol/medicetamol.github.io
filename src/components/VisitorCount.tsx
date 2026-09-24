import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { countVisitIfNeeded, subscribeVisitorCount } from "../lib/visitorCount";

export default function VisitorCount() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    countVisitIfNeeded();
    const unsubscribe = subscribeVisitorCount(setCount);
    return unsubscribe;
  }, []);

  if (count === null) return null;

  return (
    <div className="inline-flex items-center gap-1.5 text-xs text-slate-500">
      <Users size={14} />
      <span>{count.toLocaleString()} visitors</span>
    </div>
  );
}
