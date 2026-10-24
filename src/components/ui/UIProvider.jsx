import { useCallback, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { UIContext } from './uiContext';
import Button from './Button';
import ConfirmDialog from './ConfirmDialog';

// Durasi tampil toast (ms); peringatan & error lebih lama agar sempat dibaca
const TOAST_DURATION = { success: 4000, info: 4000, warning: 6000, danger: 6000 };
const MAX_TOASTS = 4;

/**
 * Layanan UI global: toast dan dialog konfirmasi (sama dengan Snapme_Desktop, tanpa dialog isian).
 * Dipasang sekali di main.jsx; halaman memakai useToast / useConfirm dari uiContext.js.
 */
export default function UIProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmRequest, setConfirmRequest] = useState(null); // { options, resolve }
  const confirmRef = useRef(null); // permintaan konfirmasi yang sedang tampil (untuk pembatalan lewat signal)
  const nextId = useRef(0);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  /**
   * options (opsional):
   * - persistent: tidak hilang otomatis, hanya lewat tombol tutup atau aksi;
   * - action { label, onClick }: satu tombol aksi, menutup toast lalu menjalankan onClick;
   * - key: toast dengan key yang masih tampil tidak ditambahkan lagi (untuk peringatan yang berulang).
   */
  const show = useCallback(
    (tone, title, detail, { persistent = false, action, key } = {}) => {
      nextId.current += 1;
      const id = nextId.current;
      setToasts((list) =>
        key && list.some((t) => t.key === key)
          ? list
          : [...list.slice(-(MAX_TOASTS - 1)), { id, tone, title, detail, action, key }],
      );
      if (!persistent) setTimeout(() => dismiss(id), TOAST_DURATION[tone]);
      return id;
    },
    [dismiss],
  );

  const toast = useMemo(
    () => ({
      success: (title, detail, options) => show('success', title, detail, options),
      info: (title, detail, options) => show('info', title, detail, options),
      warning: (title, detail, options) => show('warning', title, detail, options),
      error: (title, detail, options) => show('danger', title, detail, options),
      dismiss,
    }),
    [show, dismiss],
  );

  /**
   * options.signal (opsional, AbortSignal): bila dibatalkan (mis. halaman pemanggil ditinggalkan), dialog ditutup
   * dan hasilnya false, sehingga aksi tidak dijalankan dari halaman lain.
   */
  const confirm = useCallback(
    ({ signal, ...options }) =>
      new Promise((resolve) => {
        if (signal?.aborted) {
          resolve(false);
          return;
        }
        const request = { options, resolve };
        signal?.addEventListener(
          'abort',
          () => {
            if (confirmRef.current !== request) return;
            confirmRef.current = null;
            resolve(false);
            setConfirmRequest(null);
          },
          { once: true },
        );
        confirmRef.current = request;
        setConfirmRequest(request);
      }),
    [],
  );
  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  const finishConfirm = (result) => {
    confirmRequest?.resolve(result);
    confirmRef.current = null;
    setConfirmRequest(null);
  };

  return (
    <UIContext.Provider value={value}>
      {children}

      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast${t.tone !== 'info' ? ` toast-${t.tone}` : ''}`}
            role={t.tone === 'danger' ? 'alert' : 'status'}
          >
            <strong>{t.title}</strong>
            {t.detail && <span>{t.detail}</span>}
            {t.action && (
              <Button
                size="sm"
                className="toast-action"
                onClick={() => {
                  dismiss(t.id);
                  t.action.onClick();
                }}
              >
                {t.action.label}
              </Button>
            )}
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm"
              onClick={() => dismiss(t.id)}
              aria-label="Tutup notifikasi"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>

      {confirmRequest && <ConfirmDialog options={confirmRequest.options} onClose={finishConfirm} />}
    </UIContext.Provider>
  );
}
