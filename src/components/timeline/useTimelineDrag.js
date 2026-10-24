import { useEffect, useRef, useState } from 'react';
import { dragStep, timelineMin } from '../../utils/timeline';

// Sama dengan Snapme_Desktop: tahan 400 ms untuk mulai menggeser (di HP juga membedakan geser blok dari scroll)
const HOLD_TO_DRAG_MS = 400;
const MOUSE_DRAG_PX = 5;
const TOUCH_SCROLL_PX = 10;

const dragStart = (booking, type, startX) => {
  const min = timelineMin(booking);
  return {
    id: booking.id,
    type,
    startX,
    initialMin: min,
    initialDuration: booking.duration,
    originalStudio: booking.studio,
    targetStudio: booking.studio,
    hoverStudio: booking.studio,
    currentMin: min,
    currentDuration: booking.duration,
    pushes: {},
  };
};

/** Baris ruangan di bawah titik layar (data-place pada track), untuk pindah ruangan saat digeser. */
const placeAt = (x, y) => document.elementFromPoint(x, y)?.closest('[data-place]')?.dataset.place;

/**
 * Geser & ubah durasi blok dengan mouse dan sentuhan (Desktop hanya mouse).
 * - Mouse: klik = buka detail; tekan lalu geser = pindah (boleh ke ruangan lain); handle kanan = ubah durasi.
 * - Sentuh: ketuk = buka detail; tahan 400 ms lalu geser = pindah; geser sebelum itu = scroll biasa;
 *   handle kanan = ubah durasi.
 * canEdit false (owner) = hanya membuka detail. onDrop(drag) dipanggil saat dilepas; halaman yang memvalidasi & menyimpan.
 */
export function useTimelineDrag({ canEdit, bookings, pixelsPerMinute, onOpen, onDrop }) {
  const [drag, setDragState] = useState(null);
  const dragRef = useRef(null);
  // Nilai terbaru untuk listener window (dipasang sekali per gerakan)
  const latest = useRef({});
  useEffect(() => {
    latest.current = { bookings, pixelsPerMinute, onOpen, onDrop };
  });

  const setDrag = (next) => {
    dragRef.current = next;
    setDragState(next);
  };
  const moveTo = (x, y) => {
    const d = dragRef.current;
    if (!d) return;
    const hoverStudio = d.type === 'move' ? placeAt(x, y) || d.hoverStudio : d.hoverStudio;
    setDrag(dragStep({ ...d, hoverStudio }, x, latest.current.pixelsPerMinute, latest.current.bookings));
  };
  const finish = () => {
    const d = dragRef.current;
    setDrag(null);
    if (d) latest.current.onDrop(d);
  };

  /** Pasang listener window selama satu gerakan; mengembalikan fungsi pelepasnya. */
  const listen = (pairs) => {
    pairs.forEach(([type, fn, opts]) => window.addEventListener(type, fn, opts));
    return () => pairs.forEach(([type, fn]) => window.removeEventListener(type, fn));
  };

  const onBlockMouseDown = (e, booking) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    let dragging = false;
    const stop = listen([
      [
        'mousemove',
        (ev) => {
          if (!dragging) {
            if (!canEdit || Math.hypot(ev.clientX - startX, ev.clientY - startY) < MOUSE_DRAG_PX) return;
            dragging = true;
            setDrag(dragStart(booking, 'move', startX));
          }
          moveTo(ev.clientX, ev.clientY);
        },
      ],
      [
        'mouseup',
        () => {
          stop();
          if (dragging) finish();
          else latest.current.onOpen(booking);
        },
      ],
    ]);
  };

  const onBlockTouchStart = (e, booking) => {
    e.stopPropagation();
    const { clientX: startX, clientY: startY } = e.touches[0];
    let dragging = false;
    let scrolled = false;
    const timer = canEdit
      ? setTimeout(() => {
          if (scrolled) return;
          dragging = true;
          navigator.vibrate?.(15);
          setDrag(dragStart(booking, 'move', startX));
        }, HOLD_TO_DRAG_MS)
      : null;
    const stop = listen([
      [
        'touchmove',
        (ev) => {
          const t = ev.touches[0];
          if (dragging) {
            if (ev.cancelable) ev.preventDefault(); // halaman tidak ikut scroll selama blok digeser
            moveTo(t.clientX, t.clientY);
          } else if (Math.hypot(t.clientX - startX, t.clientY - startY) > TOUCH_SCROLL_PX) {
            scrolled = true;
            clearTimeout(timer);
          }
        },
        { passive: false },
      ],
      [
        'touchend',
        (ev) => {
          clearTimeout(timer);
          stop();
          // Cegah klik mouse tiruan dari browser (membuka detail dua kali)
          if (ev.cancelable) ev.preventDefault();
          if (dragging) finish();
          else if (!scrolled) latest.current.onOpen(booking);
        },
      ],
      [
        'touchcancel',
        () => {
          clearTimeout(timer);
          stop();
          setDrag(null);
        },
      ],
    ]);
  };

  // Handle kanan: langsung ubah durasi (handle memakai touch-action: none, jadi tidak memicu scroll)
  const onResizeStart = (e, booking) => {
    if (!canEdit) return;
    e.stopPropagation();
    const isTouch = e.type === 'touchstart';
    if (!isTouch) {
      if (e.button !== 0) return;
      e.preventDefault();
    }
    const point = (ev) => (isTouch ? ev.touches[0] : ev);
    setDrag(dragStart(booking, 'resize', point(e).clientX));
    const stop = listen([
      [
        isTouch ? 'touchmove' : 'mousemove',
        (ev) => {
          if (isTouch && ev.cancelable) ev.preventDefault();
          moveTo(point(ev).clientX, point(ev).clientY);
        },
        { passive: false },
      ],
      [
        isTouch ? 'touchend' : 'mouseup',
        (ev) => {
          stop();
          if (isTouch && ev.cancelable) ev.preventDefault();
          finish();
        },
      ],
    ]);
  };

  return { drag, onBlockMouseDown, onBlockTouchStart, onResizeStart };
}
