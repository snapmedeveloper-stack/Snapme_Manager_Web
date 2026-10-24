import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// Modal yang sedang terbuka, urut dari bawah ke atas: Esc hanya menutup yang paling atas
// (mis. dialog konfirmasi yang dibuka dari dalam modal lain tidak ikut menutup modal di bawahnya).
const openStack = [];

/**
 * Modal standar (docs/STANDAR_UI.md §5). Dirender ke document.body.
 * size: 'sm' (400) | 'md' (560) | 'lg' (800). footer: tombol aksi, primary paling kanan.
 * Esc (modal paling atas saja) dan klik di luar modal memanggil onClose (kecuali closeOnOverlay=false).
 */
export default function Modal({ open, onClose, title, size = 'md', footer, closeOnOverlay = true, children }) {
  const panelRef = useRef(null);
  // onClose disimpan di ref supaya fungsi inline dari pemanggil tidak memicu ulang efek (dan merebut fokus)
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return undefined;
    const token = {};
    openStack.push(token);
    const onKey = (e) => {
      if (e.key === 'Escape' && openStack[openStack.length - 1] === token) onCloseRef.current?.();
    };
    window.addEventListener('keydown', onKey);
    // Fokus ke panel, kecuali elemen di dalamnya sudah mengambil fokus (autoFocus)
    if (panelRef.current && !panelRef.current.contains(document.activeElement)) panelRef.current.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      openStack.splice(openStack.indexOf(token), 1);
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (closeOnOverlay && onClose && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className={`modal${size !== 'md' ? ` modal-${size}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
      >
        {(title || onClose) && (
          <div className="modal-header">
            <span className="modal-title">{title}</span>
            {onClose && (
              <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Tutup">
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </div>
        )}
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-actions">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
