// App-shell touch behaviour: no page zoom (pinch / double-tap) and no rubber-band
// pull on iOS/iPadOS, in both the browser and the installed app.
// The viewport meta tag already blocks zoom on Android, but iOS Safari ignores
// user-scalable=no, so it is enforced here. Anything inside an element with
// [data-allow-zoom] (the question image modal) is exempt and handles its own zoom.

const inZoomZone = (t: EventTarget | null) =>
  t instanceof Element && t.closest("[data-allow-zoom]") !== null;

function canScrollInDirection(el: Element, dy: number): boolean {
  const { scrollTop, scrollHeight, clientHeight } = el;
  if (scrollHeight <= clientHeight + 1) return false;
  if (dy > 0) return scrollTop > 0;               // finger moving down → content moves down → needs room above
  return scrollTop + clientHeight < scrollHeight - 1; // finger moving up → needs room below
}

export function installViewportLock(): void {
  if (typeof document === "undefined") return;

  // iOS pinch gesture events
  const blockGesture = (e: Event) => { if (!inZoomZone(e.target)) e.preventDefault(); };
  document.addEventListener("gesturestart", blockGesture, { passive: false });
  document.addEventListener("gesturechange", blockGesture, { passive: false });
  document.addEventListener("gestureend", blockGesture, { passive: false });

  let startY = 0;
  document.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) startY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener("touchmove", (e) => {
    if (inZoomZone(e.target)) return;

    // Two-finger pinch anywhere else
    if (e.touches.length > 1) { e.preventDefault(); return; }

    // Stop the page rubber-banding (pulls the sticky header down on iPad/iPhone,
    // browser and installed app). Only cancels the move when NO ancestor — including
    // the document — can actually scroll in that direction, so normal scrolling and
    // nested scroll areas are untouched.
    const dy = e.touches[0].clientY - startY;
    if (dy === 0) return;
    let el: Element | null = e.target instanceof Element ? e.target : null;
    while (el && el !== document.body && el !== document.documentElement) {
      const oy = getComputedStyle(el).overflowY;
      if ((oy === "auto" || oy === "scroll") && canScrollInDirection(el, dy)) return;
      el = el.parentElement;
    }
    const root = document.scrollingElement ?? document.documentElement;
    if (!canScrollInDirection(root, dy)) e.preventDefault();
  }, { passive: false });
}
