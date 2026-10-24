// Salinan Snapme_Desktop/src/utils/receipt.js: ubah keduanya bersamaan.
// Data nota (Desktop: window.electronAPI.generateReceiptPdf; Manager: jendela cetak browser).

/** Pengaturan nota dengan nilai bawaan bila belum diisi di Setting. */
export const receiptSettings = (kasirSettings = {}) => ({
  businessName: kasirSettings.businessName || 'Snapme Studio',
  address: kasirSettings.address || '',
  phone: kasirSettings.phone || '',
  footerNote: kasirSettings.footerNote || 'Terima kasih atas kunjungannya',
  paperSize: kasirSettings.paperSize || '80mm',
});

/** Nama kasir yang dicetak di nota. */
export const kasirNameOf = (user, userMeta) => userMeta?.name || user?.displayName || 'Kasir';

/** Tanggal nota, mis. "07/10/2026 14.30". */
export const formatReceiptDate = (millis) =>
  new Date(millis).toLocaleString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

/** Data transaksi + kelengkapan nota. Nama folder nota mengikuti tanggal booking bila ada. */
export const buildReceiptData = (tx, { date, kasirName, kasirSettings }) => ({
  ...tx,
  date,
  kasirName,
  folderName: tx.bookingDate ? `${tx.customerName} - ${tx.bookingDate}` : tx.customerName,
  settings: receiptSettings(kasirSettings),
});
