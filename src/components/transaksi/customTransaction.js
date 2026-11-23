// Transaksi custom (khusus Snapme Manager, diisi owner): pekerjaan di luar Kasir, mis. job foto event. Disimpan di
// koleksi transactions yang sama dengan transaksi Kasir supaya ikut rekap pendapatan, pencarian, nota, dan Gaji:
//   kind: 'custom', customerName (= nama transaksi), items: [{ id: 'custom', name, price: total, qty: 1 }], total,
//   paymentMethod, amountPaid = total, change 0, createdAt (tanggal pilihan), managerId (cabang staff), note,
//   handlers: [{ staffId, name, amount }] (fee per staff, boleh berbeda) + handlerFee (jumlahnya), createdBy.
// Snapme Desktop tidak menampilkan transaksi ini (nominal & fee hanya untuk owner).
// DP (Snapme_Desktop/docs/RENCANA_DP.md §4.3): pekerjaan yang baru DP disimpan sebagai transaksi kind 'dp' dengan
// order = rencana pekerjaan (nama, total, fee, cabang, catatan). Pelunasan = transaksi custom dengan baris Potong DP
// (total = sisa) + depositNumbers, dan transaksi DP diberi settledBy. Fee masuk Gaji di bulan pelunasan.
import { getLocalDateString } from '../../utils/format';
import { splitFee } from '../../utils/handlerFee';
import {
  depositDeductionItem,
  depositError,
  depositTransactionFields,
  isDepositItem,
  isDepositTransaction,
} from '../../utils/deposit';

export const CUSTOM_KIND = 'custom';
export const CUSTOM_ITEM_ID = 'custom';
export const MAX_NAME = 80;
export const MAX_NOTE = 200;

export const isCustomTransaction = (tx) => tx?.kind === CUSTOM_KIND;
/** DP pekerjaan custom (dibuat di Manager, punya rencana order). */
export const isCustomDeposit = (tx) => isDepositTransaction(tx) && !!tx.order;

const toInt = (value) => Math.max(0, Math.round(Number(value) || 0));

/**
 * Waktu transaksi untuk tanggal 'YYYY-MM-DD': hari ini = jam sekarang; tanggal lain = 12.00 (tengah hari, supaya
 * tidak bergeser hari/bulan). keepTime = waktu transaksi lama (saat diubah tanpa ganti tanggal, jamnya dipertahankan).
 */
export function createdAtFor(date, now = new Date(), keepTime = null) {
  if (keepTime && getLocalDateString(keepTime) === date) return keepTime;
  if (date === getLocalDateString(now)) return now;
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

/** Bagi total fee rata ke staff terpilih (urutan daftar): { [staffId]: '<rupiah>' } untuk isian. */
export function evenShares(totalFee, staffIds) {
  const amounts = splitFee(toInt(totalFee), staffIds.length);
  return Object.fromEntries(staffIds.map((id, i) => [id, String(amounts[i])]));
}

/** Jumlah fee dari isian per staff. */
export const sharesTotal = (shares) => Object.values(shares).reduce((sum, v) => sum + toInt(v), 0);

/**
 * Pesan kesalahan isian (atau null bila sah). draft: { name, date, total, shares: { staffId: rupiah } }.
 * Fee tidak boleh melebihi total harga (sama seperti fee paket); staff terpilih wajib punya fee > 0.
 */
export function customTransactionError({ name, date, total, shares }) {
  if (!String(name || '').trim()) return 'Isi nama transaksi.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return 'Pilih tanggal transaksi.';
  if (toInt(total) <= 0) return 'Isi total harga.';
  if (Object.values(shares).some((v) => toInt(v) <= 0)) return 'Isi fee setiap staff yang dipilih (lebih dari Rp 0).';
  if (sharesTotal(shares) > toInt(total)) return 'Total fee tidak boleh melebihi total harga.';
  return null;
}

/** Kesalahan isian saat disimpan sebagai DP (isian custom + nominal DP < total harga). */
export function customDepositError(draft) {
  return customTransactionError(draft) || depositError({ amount: draft.deposit, orderTotal: draft.total });
}

const handlersOf = (shares, staff) =>
  staff.filter((s) => shares[s.id] !== undefined).map((s) => ({ staffId: s.id, name: s.name, amount: toInt(shares[s.id]) }));

/**
 * Field dokumen transaksi custom (tanpa createdAt/createdBy/transactionNumber, yang diisi pemanggil saat membuat).
 * staff: daftar staff ({ id, name }) untuk nama penanggung jawab; urutan handlers mengikuti daftar itu.
 * draft.deduction = { amount, numbers } bila ini pelunasan DP: baris Potong DP, total = sisa bayar.
 */
export function customTransactionFields({ name, total, paymentMethod, shares, note, managerId, deduction }, staff) {
  const cleanName = String(name).trim().slice(0, MAX_NAME);
  const price = toInt(total);
  const handlers = handlersOf(shares, staff);
  const dp = Math.min(price, toInt(deduction?.amount));
  return {
    kind: CUSTOM_KIND,
    customerName: cleanName,
    items: [{ id: CUSTOM_ITEM_ID, name: cleanName, price, qty: 1 }, ...(dp > 0 ? [depositDeductionItem(dp)] : [])],
    total: price - dp,
    paymentMethod: paymentMethod === 'transfer' ? 'transfer' : 'cash',
    amountPaid: price - dp,
    change: 0,
    handlers,
    handlerFee: handlers.reduce((sum, h) => sum + h.amount, 0),
    managerId: managerId || null,
    note: String(note || '')
      .trim()
      .slice(0, MAX_NOTE),
    bookingId: null,
    bookingDate: null,
    ...(dp > 0 && { depositNumbers: deduction.numbers || [] }),
  };
}

/** Field transaksi DP pekerjaan custom (tanpa createdAt/createdBy). Fee belum dicatat: hanya rencana di order. */
export function customDepositFields(draft, staff, transactionNumber) {
  const cleanName = String(draft.name).trim().slice(0, MAX_NAME);
  const handlers = handlersOf(draft.shares, staff);
  return depositTransactionFields({
    transactionNumber,
    customerName: cleanName,
    label: cleanName,
    amount: draft.deposit,
    orderTotal: draft.total,
    paymentMethod: draft.paymentMethod,
    amountPaid: draft.deposit,
    source: 'manager',
    managerId: draft.managerId || null,
    order: {
      name: cleanName,
      total: toInt(draft.total),
      managerId: draft.managerId || null,
      handlers,
      note: String(draft.note || '')
        .trim()
        .slice(0, MAX_NOTE),
    },
  });
}

const sharesOf = (handlers) => Object.fromEntries((handlers || []).map((h) => [h.staffId, String(h.amount ?? 0)]));

/**
 * Isian awal form: kosong (tanggal hari ini), dari transaksi custom yang diubah (tx), atau pelunasan DP (settle =
 * transaksi DP custom: isian dari order-nya, tanggal hari ini, DP dipotong).
 */
export function draftOf(tx, { today, managerId, settle = null }) {
  const blank = { name: '', date: today, total: '', paymentMethod: 'cash', shares: {}, note: '', managerId, deposit: '' };
  if (settle) {
    const order = settle.order || {};
    return {
      ...blank,
      name: order.name || settle.customerName || '',
      total: String(order.total || settle.orderTotal || ''),
      shares: sharesOf(order.handlers),
      note: order.note || '',
      managerId: order.managerId || settle.managerId || managerId,
      deduction: { amount: toInt(settle.total), numbers: [settle.transactionNumber].filter(Boolean) },
    };
  }
  if (!tx) return blank;
  const created = tx.createdAt?.toDate ? tx.createdAt.toDate() : null;
  const deductionItem = (tx.items || []).find(isDepositItem);
  const customItem = (tx.items || []).find((i) => i.id === CUSTOM_ITEM_ID);
  return {
    ...blank,
    name: tx.customerName || '',
    date: created ? getLocalDateString(created) : today,
    // Pelunasan DP: total harga = harga pekerjaan (item custom), bukan total yang sudah dipotong DP
    total: String((customItem ? customItem.price : tx.total) || ''),
    paymentMethod: tx.paymentMethod === 'transfer' ? 'transfer' : 'cash',
    shares: sharesOf(tx.handlers),
    note: tx.note || '',
    managerId: tx.managerId || managerId,
    ...(deductionItem && {
      deduction: { amount: toInt(-deductionItem.price), numbers: tx.depositNumbers || [] },
    }),
  };
}
