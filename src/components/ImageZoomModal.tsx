import { X } from "lucide-react";
import { useRef, useState } from "react";

interface Props {
  src: string;
  onClose: () => void;
}

const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;

type T = { s: number; x: number; y: number };

// Full-screen image viewer with its own pinch / double-tap / drag zoom, so it keeps
// working while page zoom is locked app-wide (Android meta tag + iOS JS lock).
export default function ImageZoomModal({ src, onClose }: Props) {
  const [t, setT] = useState<T>({ s: 1, x: 0, y: 0 });
  const box = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; t: T; mid: { x: number; y: number } } | null>(null);
  const pan = useRef<{ px: number; py: number; t: T } | null>(null);
  const tap = useRef<{ time: number; x: number; y: number; moved: boolean } | null>(null);
  const lastTap = useRef(0);

  const clamp = (n: T): T => {
    const s = Math.min(MAX_SCALE, Math.max(1, n.s));
    if (s === 1) return { s: 1, x: 0, y: 0 };
    const r = box.current?.getBoundingClientRect();
    const mx = r ? ((s - 1) * r.width) / 2 : 0;
    const my = r ? ((s - 1) * r.height) / 2 : 0;
    return { s, x: Math.max(-mx, Math.min(mx, n.x)), y: Math.max(-my, Math.min(my, n.y)) };
  };

  const dist = () => {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  const mid = () => {
    const [a, b] = [...pointers.current.values()];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      pinch.current = { dist: dist(), t, mid: mid() };
      pan.current = null;
      tap.current = null;
    } else if (pointers.current.size === 1) {
      pan.current = { px: e.clientX, py: e.clientY, t };
      tap.current = { time: Date.now(), x: e.clientX, y: e.clientY, moved: false };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size >= 2 && pinch.current) {
      const p = pinch.current;
      const m = mid();
      setT(clamp({ s: p.t.s * (dist() / p.dist), x: p.t.x + (m.x - p.mid.x), y: p.t.y + (m.y - p.mid.y) }));
    } else if (pan.current) {
      const dx = e.clientX - pan.current.px;
      const dy = e.clientY - pan.current.py;
      if (tap.current && Math.hypot(e.clientX - tap.current.x, e.clientY - tap.current.y) > 8) tap.current.moved = true;
      if (pan.current.t.s > 1) setT(clamp({ ...pan.current.t, x: pan.current.t.x + dx, y: pan.current.t.y + dy }));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const wasTap = tap.current && !tap.current.moved && Date.now() - tap.current.time < 300;
    pointers.current.delete(e.pointerId);
    pinch.current = null;
    pan.current = null;
    if (pointers.current.size === 1) {
      const [p] = [...pointers.current.values()];
      pan.current = { px: p.x, py: p.y, t };
    }
    if (wasTap && pointers.current.size === 0) {
      const now = Date.now();
      if (now - lastTap.current < 300) {
        setT((cur) => (cur.s > 1 ? { s: 1, x: 0, y: 0 } : clamp({ s: DOUBLE_TAP_SCALE, x: 0, y: 0 })));
        lastTap.current = 0;
      } else {
        lastTap.current = now;
        // Single tap on the empty backdrop (not the image) closes when not zoomed.
        if (e.target === e.currentTarget && t.s === 1) {
          window.setTimeout(() => { if (lastTap.current === now) onClose(); }, 320);
        }
      }
    }
    tap.current = null;
  };

  const onWheel = (e: React.WheelEvent) => {
    setT((cur) => clamp({ ...cur, s: cur.s * (e.deltaY < 0 ? 1.15 : 1 / 1.15) }));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" data-allow-zoom>
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white backdrop-blur"
        aria-label="Close image"
      >
        <X size={20} />
      </button>
      <div
        ref={box}
        className="absolute inset-0 flex items-center justify-center overflow-hidden"
        style={{ touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        <img
          src={src}
          alt="Question"
          draggable={false}
          className="max-h-full max-w-full select-none object-contain"
          style={{
            pointerEvents: "none",
            transform: `translate(${t.x}px, ${t.y}px) scale(${t.s})`,
            transition: pointers.current.size ? "none" : "transform 0.15s ease-out",
          }}
        />
      </div>
    </div>
  );
}
