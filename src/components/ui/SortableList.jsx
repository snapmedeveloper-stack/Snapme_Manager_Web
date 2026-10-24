import { useLayoutEffect, useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';

// API sama dengan SortableList Snapme_Desktop, tetapi menyeret memakai pointer event pada pegangan (jalan di layar
// sentuh; HTML5 drag & drop yang dipakai Desktop tidak andal di HP). Baris lain meluncur ke posisi barunya.
const SHIFT_MS = 200;
const SHIFT_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

const prefersReducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Sesuaikan urutan id dengan items terbaru: id yang sudah hilang dibuang, id baru ditaruh di belakang. */
function resolveOrder(order, items) {
  const ids = new Set(items.map((item) => item.id));
  const kept = order.filter((id) => ids.has(id));
  const known = new Set(kept);
  return [...kept, ...items.map((item) => item.id).filter((id) => !known.has(id))];
}

function moveTo(order, id, index) {
  const next = order.filter((x) => x !== id);
  next.splice(index, 0, id);
  return next;
}

/**
 * Daftar yang urutannya diubah dengan menyeret pegangan (jari atau mouse), atau keyboard (panah atas/bawah pada
 * pegangan). items: [{ id, ... }] urutan sekarang, referensi stabil (mis. state dari snapshot). renderItem(item) → isi
 * baris. getLabel(item) → nama baris untuk pembaca layar. onReorder(itemsBaru) dipanggil sekali saat dilepas dan boleh
 * async; urutan baru ditahan sampai `items` berubah (snapshot datang) dan dikembalikan bila onReorder gagal.
 * disabled: tanpa pegangan (mis. role yang hanya boleh melihat).
 */
export default function SortableList({
  items,
  onReorder,
  renderItem,
  getLabel = (item) => item.name,
  disabled = false,
  className = '',
  itemClassName = '',
}) {
  const [drag, setDrag] = useState(null); // { id, order } selama menyeret
  const [pending, setPending] = useState(null); // { items, order } setelah dilepas, sampai items berubah
  const dragRef = useRef(null);
  const nodes = useRef(new Map());
  const shiftFrom = useRef(null);
  const focusId = useRef(null);

  const sortable = !disabled && items.length > 1;
  const byId = new Map(items.map((item) => [item.id, item]));
  const pendingOrder = pending && pending.items === items ? pending.order : null;
  const order = resolveOrder(drag?.order ?? pendingOrder ?? [], items);

  // FLIP: baris yang berpindah digeser dari posisi lamanya ke posisi baru
  useLayoutEffect(() => {
    if (focusId.current != null) {
      nodes.current.get(focusId.current)?.querySelector('.sortable-handle')?.focus();
      focusId.current = null;
    }
    const from = shiftFrom.current;
    shiftFrom.current = null;
    if (!from || prefersReducedMotion()) return;
    nodes.current.forEach((el, id) => {
      const dy = (from.get(id) ?? el.offsetTop) - el.offsetTop;
      if (dy) el.animate?.([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: SHIFT_MS, easing: SHIFT_EASE });
    });
  });

  const rememberPositions = () => {
    shiftFrom.current = new Map([...nodes.current].map(([id, el]) => [id, el.offsetTop]));
  };

  const commit = (nextOrder) => {
    dragRef.current = null;
    setDrag(null);
    if (nextOrder.every((id, i) => id === items[i]?.id)) {
      setPending(null);
      return;
    }
    setPending({ items, order: nextOrder });
    Promise.resolve()
      .then(() => onReorder(nextOrder.map((id) => byId.get(id))))
      .catch(() => setPending((p) => (p?.order === nextOrder ? null : p)));
  };

  const handlePointerDown = (e, id) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { id, order };
    setDrag(dragRef.current);
  };

  // Posisi baru = jumlah baris lain yang titik tengahnya ada di atas jari/kursor
  const handlePointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const to = d.order.filter((rid) => {
      if (rid === d.id) return false;
      const rect = nodes.current.get(rid)?.getBoundingClientRect();
      return rect && e.clientY > rect.top + rect.height / 2;
    }).length;
    if (d.order.indexOf(d.id) === to) return;
    rememberPositions();
    dragRef.current = { id: d.id, order: moveTo(d.order, d.id, to) };
    setDrag(dragRef.current);
  };

  const handlePointerUp = () => {
    if (dragRef.current) commit(dragRef.current.order);
  };

  const handlePointerCancel = () => {
    dragRef.current = null;
    setDrag(null);
  };

  const handleKeyDown = (e, id) => {
    const step = { ArrowUp: -1, ArrowDown: 1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const to = order.indexOf(id) + step;
    if (to < 0 || to >= order.length) return;
    rememberPositions();
    focusId.current = id;
    commit(moveTo(order, id, to));
  };

  return (
    <ul className={`sortable${className ? ` ${className}` : ''}`}>
      {order.map((id) => {
        const item = byId.get(id);
        return (
          <li
            key={id}
            ref={(el) => {
              if (el) nodes.current.set(id, el);
              else nodes.current.delete(id);
            }}
            className={`sortable-item${itemClassName ? ` ${itemClassName}` : ''}${drag?.id === id ? ' is-dragging' : ''}`}
          >
            {sortable && (
              <button
                type="button"
                className="sortable-handle"
                aria-label={`Ubah urutan ${getLabel(item)} (seret, atau panah atas/bawah)`}
                title="Seret untuk mengubah urutan"
                onPointerDown={(e) => handlePointerDown(e, id)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
                onKeyDown={(e) => handleKeyDown(e, id)}
              >
                <GripVertical size={18} aria-hidden="true" />
              </button>
            )}
            {renderItem(item)}
          </li>
        );
      })}
    </ul>
  );
}
