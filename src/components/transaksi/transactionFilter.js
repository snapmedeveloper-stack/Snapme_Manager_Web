// Pencarian & filter paket halaman Transaksi (khusus Manager, fungsi murni).

const normalize = (value) => String(value ?? '').toLowerCase();

/**
 * Transaksi cocok dengan kata kunci? Dicari di nama customer, no. transaksi, nama item, dan penanggung jawab paket.
 * Beberapa kata = semuanya harus ada (urutan bebas), huruf besar/kecil diabaikan. Kata kunci kosong = semua cocok.
 */
export function matchesSearch(tx, query) {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const haystack = [
    tx.customerName,
    tx.transactionNumber,
    ...(tx.items || []).map((item) => item.name),
    ...(tx.handlers || []).map((h) => h.name),
  ].map(normalize);
  return words.every((word) => haystack.some((text) => text.includes(word)));
}

/** Jumlah paket packageId di transaksi (0 = tidak ada). */
export const packageQtyOf = (tx, packageId) =>
  (tx.items || []).filter((item) => item.id === packageId).reduce((sum, item) => sum + (item.qty || 1), 0);

/** Pilihan filter paket: paket aktif urut tampilan, lalu yang sudah diarsipkan (transaksi lama tetap bisa dicari). */
export const packageOptions = (packages) => {
  const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.name).localeCompare(String(b.name));
  return [
    ...packages.filter((p) => !p.archived).sort(byOrder),
    ...packages.filter((p) => p.archived).sort(byOrder),
  ];
};
