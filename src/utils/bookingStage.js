// Salinan Snapme_Desktop/src/utils/bookingStage.js: ubah keduanya bersamaan.
// Tahap proses satu booking: satu sumber untuk kartu proses (ProcessCard) dan halaman Transaksi.
// Keputusan pemilik (2026-10-08, Paket 10):
// - "sudah print" = receiptPrintedAt (hanya ditulis halaman Print). receiptPrinted juga ditulis Kasir saat bayar,
//   sehingga dulu bayar di Kasir ikut melewati tahap Print.
// - Photobooth tahap 3 = driveLink (folder Drive dibuat saat datang). driveFolderId tidak pernah ditulis.

export const STUDIO_STAGES = ['Transfer', 'Edit & Print', 'Kasir', 'Tautkan WA', 'Caption & Upload', 'Selesai'];
export const PHOTOBOOTH_STAGES = ['Belum Datang', 'Folder Dibuat', 'Pemotretan & Upload', 'Selesai'];

/** Bagian upload Drive yang selesai (0–1). upload = { uploadedCount, totalDetected }. */
export function uploadRatioOf(upload) {
  const total = upload?.totalDetected || 0;
  return total > 0 ? (upload.uploadedCount || 0) / total : 0;
}

/**
 * Nomor tahap (mulai 1). Studio: 1 Transfer → 2 Edit & Print → 3 Kasir → 4 Tautkan WA → 5 Caption & Upload → 6 Selesai.
 * Photobooth: 1 Belum datang → 2 Folder dibuat → 3 Pemotretan & Upload → 4 Selesai.
 * options.upload: progres upload yang dipakai (mis. gabungan database + uploader PC ini); default booking.uploadProgress.
 * options.transferDone: transfer selesai menurut PC ini (sebelum booking.transferDone sampai dari database).
 */
export function bookingStage(
  booking,
  { isPhotobooth = false, upload = booking?.uploadProgress, transferDone = false } = {},
) {
  const b = booking || {};
  const uploadDone = uploadRatioOf(upload) >= 1 || !!b.uploadForceCompleted;

  if (isPhotobooth) {
    let stage = 1;
    if (b.arrivedAt) stage = 2;
    if (stage === 2 && b.driveLink) stage = 3;
    if (stage === 3 && uploadDone) stage = 4;
    if (b.processCompleted) stage = 4;
    return stage;
  }

  const transferred = !!b.transferDone || transferDone;
  const hasWa = !!(b.waNumber || b.customerPhone);
  let stage = 1;
  if (transferred) stage = 2;
  if (transferred && (b.receiptPrintedAt || b.printSkipped)) stage = 3;
  if (stage === 3 && b.paid) stage = 4;
  if (stage === 4 && (hasWa || b.captionCopied)) stage = 5;
  if (stage === 5 && (b.waSent || b.captionCopied) && uploadDone) stage = 6;
  if (b.processCompleted) stage = 6;
  return stage;
}

/** Label tahap untuk nomor tahap dari bookingStage. */
export const stageLabel = (stage, isPhotobooth) => (isPhotobooth ? PHOTOBOOTH_STAGES : STUDIO_STAGES)[stage - 1];
