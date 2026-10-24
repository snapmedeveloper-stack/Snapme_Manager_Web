// Laporan PDF transaksi: dibuat Cloud Function generateReport (functions/index.js), lalu dibagikan atau diunduh.

const FUNCTION_URL = 'https://asia-southeast2-snapme-database.cloudfunctions.net/generateReport';

const base64ToBlob = (base64) => {
  const bytes = atob(base64);
  const array = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) array[i] = bytes.charCodeAt(i);
  return new Blob([array], { type: 'application/pdf' });
};

const download = (url, filename) => {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
};

/**
 * Minta laporan periode { startDate, endDate } untuk kategori filterTab, lalu buka menu bagikan HP (Web Share).
 * Bila tidak didukung, atau ditolak karena pembuatan laporan terlalu lama (izin gesture habis), PDF diunduh.
 * Melempar Error dengan pesan yang bisa ditampilkan bila gagal.
 */
export async function shareReport({ user, orgId, range, filterTab, label }) {
  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` },
    body: JSON.stringify({
      orgId,
      startMillis: range.startDate ? range.startDate.getTime() : null,
      endMillis: range.endDate ? range.endDate.getTime() : null,
      filterTab,
      periodeLabel: label,
    }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Server error: ${response.status}`);
  }
  const result = await response.json();
  if (!result.pdfBase64) throw new Error('Tidak ada data PDF dari server.');

  const blob = base64ToBlob(result.pdfBase64);
  const filename = result.filename || 'Laporan_Snapme.pdf';
  const url = URL.createObjectURL(blob);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  const file = new File([blob], filename, { type: 'application/pdf' });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Laporan Snapme', text: `Laporan periode ${label}` });
    } catch (err) {
      if (err.name === 'NotAllowedError') download(url, filename);
      // AbortError = dibatalkan user dari menu bagikan
    }
    return;
  }
  download(url, filename);
}
