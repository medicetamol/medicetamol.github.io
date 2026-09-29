// Defers `fn` until the browser has painted at least one frame, so non-essential
// network work (Firebase Auth, Firestore listeners) doesn't compete with the
// initial render for bandwidth/CPU right after the JS bundle boots.
// Two rAFs (not requestIdleCallback, which Safari/iOS doesn't support) guarantee
// a paint has happened before `fn` runs. Returns a cancel function for cleanup.
export function afterFirstPaint(fn: () => void): () => void {
  let cancelled = false;
  let raf2 = 0;

  const raf1 = requestAnimationFrame(() => {
    raf2 = requestAnimationFrame(() => {
      if (!cancelled) fn();
    });
  });

  return () => {
    cancelled = true;
    cancelAnimationFrame(raf1);
    if (raf2) cancelAnimationFrame(raf2);
  };
}
