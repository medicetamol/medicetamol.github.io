import { doc, increment, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

const COUNTER_REF = doc(db, "stats", "visitorCount");
const SESSION_FLAG = "medicetamol_visit_counted";

// Increments the shared visitor counter once per browser session (tab
// close / reopen counts again, but repeated page navigations within the
// same session don't inflate the number).
export function countVisitIfNeeded() {
  if (typeof window === "undefined") return;
  if (sessionStorage.getItem(SESSION_FLAG)) return;
  sessionStorage.setItem(SESSION_FLAG, "1");
  updateDoc(COUNTER_REF, { count: increment(1) }).catch(() => {
    // Fails silently — e.g. offline. Don't block the page on this.
    sessionStorage.removeItem(SESSION_FLAG);
  });
}

// Subscribes to live updates of the visitor count. Returns an unsubscribe fn.
export function subscribeVisitorCount(onChange: (count: number) => void) {
  return onSnapshot(COUNTER_REF, (snap) => {
    const count = snap.data()?.count;
    if (typeof count === "number") onChange(count);
  });
}
