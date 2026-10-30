// Salinan Snapme_Desktop/src/utils/handlerFee.js: ubah keduanya bersamaan.
// Fee penanggung jawab paket. Paket boleh punya handlerFee (rupiah), paling besar sama dengan harganya. Saat bayar di
// Kasir Desktop, fee bawaan itu boleh diubah (maksimal harga paket berfee di keranjang), lalu staff yang menangani
// disimpan di transaksi (handlers: [{ staffId, name }]) bersama total fee saat itu (handlerFee), supaya perubahan fee
// paket kemudian tidak mengubah transaksi lama. Fee dibagi rata ke semua yang menangani, lalu dibayar bersama gaji
// bulan berikutnya (halaman Gaji Snapme Manager).

const feeOfPackage = (packages) => new Map(packages.map((p) => [p.id, Number(p.handlerFee) || 0]));

/** Total fee bawaan item keranjang/transaksi: handlerFee paket × qty. Item selain paket diabaikan. */
export function packageFeeOf(items = [], packages = []) {
  const feeById = feeOfPackage(packages);
  return items.reduce((sum, item) => sum + (feeById.get(item.id) || 0) * (item.qty || 1), 0);
}

/** Batas fee yang boleh diisi di Kasir: harga paket berfee di keranjang (harga item × qty). */
export function feeLimitOf(items = [], packages = []) {
  const feeById = feeOfPackage(packages);
  return items.reduce((sum, item) => sum + (feeById.get(item.id) > 0 ? (item.price || 0) * (item.qty || 1) : 0), 0);
}

/** Fee transaksi: yang tersimpan saat dicatat, atau dihitung dari fee paket sekarang untuk transaksi lama. */
export const transactionFee = (tx, packages) => tx.handlerFee ?? packageFeeOf(tx.items, packages);

/** Bagi rata dalam rupiah bulat; sisa pembagian diberikan satu rupiah per orang mulai dari urutan pertama. */
export function splitFee(total, count) {
  if (count <= 0) return [];
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

/** Bagian fee tiap penanggung jawab transaksi: [{ staffId, name, amount }]. */
export function handlerShares(tx, packages) {
  const handlers = tx.handlers || [];
  const amounts = splitFee(transactionFee(tx, packages), handlers.length);
  return handlers.map((h, i) => ({ ...h, amount: amounts[i] }));
}
