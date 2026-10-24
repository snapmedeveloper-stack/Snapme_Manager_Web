import Modal from './Modal';

/**
 * Dialog konfirmasi; dipakai lewat useConfirm(), bukan dirender langsung oleh halaman.
 * Untuk aksi berbahaya (destructive) fokus awal ada di tombol Batal, supaya Enter tidak langsung menghapus.
 */
export default function ConfirmDialog({ options, onClose }) {
  const {
    title = 'Lanjutkan?',
    message,
    confirmText = 'Ya, lanjutkan',
    cancelText = 'Batal',
    destructive = false,
  } = options;

  return (
    <Modal
      open
      size="sm"
      title={title}
      onClose={() => onClose(false)}
      footer={
        <>
          <button type="button" className="btn" onClick={() => onClose(false)} autoFocus={destructive}>
            {cancelText}
          </button>
          <button
            type="button"
            className={`btn ${destructive ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => onClose(true)}
            autoFocus={!destructive}
          >
            {confirmText}
          </button>
        </>
      }
    >
      {message}
    </Modal>
  );
}
