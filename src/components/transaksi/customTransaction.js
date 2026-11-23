// Transaksi custom (khusus Snapme Manager, diisi owner): pekerjaan di luar Kasir, mis. job foto event. Disimpan di
// koleksi transactions yang sama dengan transaksi Kasir supaya ikut rekap pendapatan, pencarian, nota, dan Gaji:
//   kind: 'custom', customerName (= nama transaksi), items: [{ id: 'custom', name, price: total, qty: 1 }], total,
//   paymentMethod, amountPaid = total, change 0, createdAt (tanggal pilihan), managerId (cabang staff), note,
//   handlers: [{ staffId, name, amount }] (fee per staff, boleh berbeda) + handlerFee (jumlahnya), createdBy.
// Snapme Desktop tidak menampilkan transaksi ini (nominal & fee hanya untuk owner).
import { getLocalDateString } from '../../utils/format';
import { splitFee } from '../../utils/handlerFee';

export const CUSTOM_KIND = 'custom';
export const CUSTOM_ITEM_ID = 'custom';
export const MAX_NAME = 80;
export const MAX_NOTE = 200;

export const isCustomTransaction = (tx) => tx?.kind === CUSTOM_KIND;

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

/**
 * Field dokumen transaksi custom (tanpa createdAt/createdBy/transactionNumber, yang diisi pemanggil saat membuat).
 * staff: daftar staff ({ id, name }) untuk nama penanggung jawab; urutan handlers mengikuti daftar itu.
 */
export function customTransactionFields({ name, total, paymentMethod, shares, note, managerId }, staff) {
  const cleanName = String(name).trim().slice(0, MAX_NAME);
  const price = toInt(total);
  const handlers = staff
    .filter((s) => shares[s.id] !== undefined)
    .map((s) => ({ staffId: s.id, name: s.name, amount: toInt(shares[s.id]) }));
  return {
    kind: CUSTOM_KIND,
    customerName: cleanName,
    items: [{ id: CUSTOM_ITEM_ID, name: cleanName, price, qty: 1 }],
    total: price,
    paymentMethod: paymentMethod === 'transfer' ? 'transfer' : 'cash',
    amountPaid: price,
    change: 0,
    handlers,
    handlerFee: handlers.reduce((sum, h) => sum + h.amount, 0),
    managerId: managerId || null,
    note: String(note || '')
      .trim()
      .slice(0, MAX_NOTE),
    bookingId: null,
    bookingDate: null,
  };
}

/** Isian awal form: kosong (tanggal hari ini) atau dari transaksi custom yang diubah. */
export function draftOf(tx, { today, managerId }) {
  if (!tx)
    return {
      name: '',
      date: today,
      total: '',
      paymentMethod: 'cash',
      shares: {},
      note: '',
      managerId,
    };
  const created = tx.createdAt?.toDate ? tx.createdAt.toDate() : null;
  return {
    name: tx.customerName || '',
    date: created ? getLocalDateString(created) : today,
    total: String(tx.total || ''),
    paymentMethod: tx.paymentMethod === 'transfer' ? 'transfer' : 'cash',
    shares: Object.fromEntries((tx.handlers || []).map((h) => [h.staffId, String(h.amount ?? 0)])),
    note: tx.note || '',
    managerId: tx.managerId || managerId,
  };
}
