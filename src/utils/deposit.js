// DP (uang muka), Snapme_Desktop/docs/RENCANA_DP.md. Salinan identik di Snapme_Desktop/src/utils/deposit.js: ubah keduanya bersamaan.
// Setiap DP = satu dokumen transactions { kind: 'dp', items: [{ id: 'dp', ... }], total: nominal DP } supaya rekap
// menghitungnya di hari diterima. Pelunasan memotong DP dengan item negatif { id: 'dp', name: 'Potong DP' } sehingga
// total pelunasan = sisa bayar. DP booking juga dicatat di booking.deposits (Desktop tidak boleh mengubah/membaca
// transaksi lama), dan itulah sumber potongan di Kasir.

export const DEPOSIT_KIND = 'dp';
export const DEPOSIT_ITEM_ID = 'dp';

export const isDepositTransaction = (tx) => tx?.kind === DEPOSIT_KIND;
export const isDepositItem = (item) => item?.id === DEPOSIT_ITEM_ID;

const toInt = (value) => Math.max(0, Math.round(Number(value) || 0));

/** Nomor transaksi DP. */
export const depositNumber = (now = Date.now()) => `DP-${now}`;

/** Jumlah DP tercatat (booking.deposits atau daftar sejenis [{ amount }]). */
export const depositTotal = (deposits) =>
  (Array.isArray(deposits) ? deposits : []).reduce((sum, d) => sum + toInt(d?.amount), 0);

/** DP booking yang belum terpakai: 0 bila booking sudah lunas (DP-nya sudah dipotong saat pelunasan). */
export const bookingDepositDue = (booking) => (booking && !booking.paid ? depositTotal(booking.deposits) : 0);

/** Jumlah item tanpa baris DP (harga pesanan sebenarnya). */
export const grossItemsTotal = (items) =>
  (items || []).filter((i) => !isDepositItem(i)).reduce((sum, i) => sum + (i.price || 0) * (i.qty || 1), 0);

/**
 * Potongan DP saat pelunasan: { amount, excess }. amount dibatasi total pesanan (total tidak boleh negatif);
 * excess = kelebihan DP yang harus dikembalikan ke customer.
 */
export function depositDeduction(orderTotal, deposit) {
  const order = toInt(orderTotal);
  const dp = toInt(deposit);
  return { amount: Math.min(order, dp), excess: Math.max(0, dp - order) };
}

/** Baris item "Potong DP" untuk transaksi pelunasan. */
export const depositDeductionItem = (amount) => ({
  id: DEPOSIT_ITEM_ID,
  name: 'Potong DP',
  price: -toInt(amount),
  qty: 1,
});

/**
 * Pesan kesalahan nominal DP (atau null bila sah). paid = DP yang sudah tercatat sebelumnya.
 * DP harus > 0 dan bersama DP sebelumnya masih kurang dari total pesanan (kalau sudah penuh, itu pelunasan).
 */
export function depositError({ amount, orderTotal, paid = 0 }) {
  const dp = toInt(amount);
  const order = toInt(orderTotal);
  if (dp <= 0) return 'Isi nominal DP.';
  if (order <= 0) return 'Total pesanan masih kosong.';
  if (dp + toInt(paid) >= order) return 'DP harus kurang dari total pesanan. Kalau dibayar penuh, pakai Lunas.';
  return null;
}

/**
 * Field dokumen transaksi DP (tanpa createdAt/createdBy, diisi pemanggil).
 * label = paket / nama pekerjaan untuk nama item; amountPaid = uang diterima (tunai), bawaan = nominal DP.
 * order = rencana transaksi custom (hanya Manager), bookingId/bookingDate = DP booking.
 */
export function depositTransactionFields({
  transactionNumber,
  customerName,
  label,
  amount,
  orderTotal,
  paidBefore = 0,
  paymentMethod,
  amountPaid,
  bookingId = null,
  bookingDate = null,
  source,
  managerId = null,
  order = null,
}) {
  const dp = toInt(amount);
  const method = paymentMethod === 'transfer' ? 'transfer' : 'cash';
  const received = method === 'cash' ? Math.max(dp, toInt(amountPaid)) : dp;
  return {
    kind: DEPOSIT_KIND,
    transactionNumber,
    customerName: String(customerName || '').trim(),
    items: [{ id: DEPOSIT_ITEM_ID, name: `DP · ${label || 'pesanan'}`, price: dp, qty: 1 }],
    total: dp,
    paymentMethod: method,
    amountPaid: received,
    change: received - dp,
    orderTotal: toInt(orderTotal),
    depositBefore: toInt(paidBefore),
    bookingId,
    bookingDate,
    source,
    managerId,
    ...(order && { order }),
  };
}

/** Entri booking.deposits untuk DP yang baru dicatat. */
export const depositEntry = ({ transactionId, transactionNumber, amount, paymentMethod, source, paidAt }) => ({
  transactionId,
  transactionNumber,
  amount: toInt(amount),
  method: paymentMethod === 'transfer' ? 'transfer' : 'cash',
  source,
  paidAt,
});

/** Sisa bayar setelah DP transaksi ini (untuk nota & pesan). */
export const depositRemaining = (tx) =>
  Math.max(0, toInt(tx?.orderTotal) - toInt(tx?.depositBefore) - toInt(tx?.total));

/** Baris tambahan nota: DP = total pesanan + sisa bayar; pelunasan = tidak ada (baris Potong DP sudah di item). */
export function depositReceiptRows(tx) {
  if (!isDepositTransaction(tx) || !tx.orderTotal) return [];
  const rows = [{ label: 'Total pesanan', value: toInt(tx.orderTotal) }];
  if (toInt(tx.depositBefore) > 0) rows.push({ label: 'DP sebelumnya', value: toInt(tx.depositBefore) });
  rows.push({ label: 'Sisa bayar', value: depositRemaining(tx) });
  return rows;
}
