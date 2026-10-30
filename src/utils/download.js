// Menyerahkan file buatan aplikasi ke pengguna (laporan PDF transaksi, rekap gaji).

/** Unduh blob sebagai file bernama filename. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**
 * Buka menu bagikan HP (Web Share) untuk file itu; bila tidak didukung, atau ditolak karena izin gesture sudah habis
 * (file dibuat terlalu lama), file diunduh. Dibatalkan dari menu bagikan = tidak terjadi apa-apa.
 */
export async function shareOrDownload(blob, filename, { title, text } = {}) {
  const file = new File([blob], filename, { type: blob.type });
  if (!navigator.canShare?.({ files: [file] })) {
    downloadBlob(blob, filename);
    return;
  }
  try {
    await navigator.share({ files: [file], title, text });
  } catch (err) {
    if (err.name === 'NotAllowedError') downloadBlob(blob, filename);
  }
}
