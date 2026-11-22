// Perhitungan murni bagian Gaji per staff per bulan kerja:
// - upah jam kerja = harga per jam × total jam kerja sebulan di Absensi, dibulatkan ke atas ke jam penuh (45j 30m →
//   46 jam; jaga yang belum selesai belum dihitung). Harga per jam bisa diatur khusus per staff (staffHourlyRates);
//   staff tanpa harga khusus memakai harga per jam bawaan cabang;
// - uang makan = uang makan per hari × jumlah hari jaga (satu kali per hari, berapa pun catatan kerjanya);
// - tunjangan label staff: Admin tetap per bulan, CS per hari hadir (staffLabels.js);
// - fee penanggung jawab paket dari transaksi yang dibuat di bulan itu (createdAt);
// - bonus yang ditambahkan owner untuk staff itu di bulan itu (payrollBonuses).
// Semua dibayar awal bulan berikutnya.
import { activeRecords, formatDuration, shiftMinutes } from '../../utils/attendance';
import { formatRupiah } from '../../utils/format';
import { handlerShares, transactionFee } from '../../utils/handlerFee';
import { labelsOf } from './staffLabels';

/** "2026-10" → awal bulan itu dan awal bulan berikutnya (waktu lokal), untuk query createdAt. */
export function monthBounds(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) };
}

const toMillis = (ts) => (ts?.toMillis ? ts.toMillis() : 0);

/** Nama paket di transaksi (untuk rincian fee). */
export const packageNamesOf = (tx, packages) => {
  const ids = new Set(packages.map((p) => p.id));
  return (tx.items || [])
    .filter((item) => ids.has(item.id))
    .map((item) => (item.qty > 1 ? `${item.name} ×${item.qty}` : item.name))
    .join(', ');
};

/** Hitungan upah jam kerja, mis. "46 jam (45j 30m dibulatkan ke atas) × Rp 15.000 (harga khusus)". */
export const hoursDetail = (row) =>
  `${row.hours} jam${row.minutes % 60 ? ` (${formatDuration(row.minutes)} dibulatkan ke atas)` : ''} × ${formatRupiah(row.hourlyRate)}${row.customRate ? ' (harga khusus)' : ''}`;

/** Harga per jam satu staff: harga khusus staff itu bila diatur (0 juga berlaku), selain itu harga bawaan cabang. */
export const hourlyRateOf = (settings, staffId) => {
  const custom = settings.staffHourlyRates?.[staffId];
  return Number.isFinite(custom) ? { rate: custom, custom: true } : { rate: settings.hourlyRate, custom: false };
};

/**
 * Isian harga per jam per staff di form Atur: staff aktif, ditambah staff nonaktif yang sudah punya harga khusus (supaya
 * harganya tidak hilang diam-diam). Hasil { staff: [...], drafts: { staffId: '15000' | '' } }; '' = ikut harga bawaan.
 */
export function staffRateDrafts(settings, staff) {
  const saved = settings.staffHourlyRates || {};
  const list = staff.filter((p) => p.active !== false || Number.isFinite(saved[p.id]));
  return {
    staff: list,
    drafts: Object.fromEntries(list.map((p) => [p.id, Number.isFinite(saved[p.id]) ? String(saved[p.id]) : ''])),
  };
}

/** Draf isian → staffHourlyRates yang disimpan: hanya yang diisi (0 juga disimpan), angka bulat ≥ 0. */
export const staffRatesFromDrafts = (drafts) =>
  Object.fromEntries(
    Object.entries(drafts)
      .filter(([, text]) => String(text ?? '').trim() !== '')
      .map(([staffId, text]) => [staffId, Math.max(0, Math.round(Number(text) || 0))]),
  );

export const EMPTY_PAYROLL_SETTINGS = {
  hourlyRate: 0,
  staffHourlyRates: {},
  mealAllowance: 0,
  adminAllowance: 0,
  csAllowance: 0,
  month: null,
};

/**
 * Pengaturan gaji yang berlaku di bulan itu: dokumen payrollSettings cabang untuk bulan itu, atau bulan terakhir
 * sebelumnya (tarif terbawa sampai diubah). { hourlyRate, staffHourlyRates: { staffId: harga per jam khusus },
 * mealAllowance, adminAllowance, csAllowance, month: bulan asal pengaturan | null }.
 */
export function payrollSettingsFor(docs, month) {
  const found = docs
    .filter((d) => d.month <= month)
    .reduce((latest, d) => (!latest || d.month > latest.month ? d : latest), null);
  if (!found) return EMPTY_PAYROLL_SETTINGS;
  return {
    hourlyRate: found.hourlyRate || 0,
    staffHourlyRates: found.staffHourlyRates || {},
    mealAllowance: found.mealAllowance || 0,
    adminAllowance: found.adminAllowance || 0,
    csAllowance: found.csAllowance || 0,
    month: found.month,
  };
}

/**
 * Hitungan tunjangan label, mis. "22 hari × Rp 10.000" (CS) atau "per bulan" (Admin); alasan bila belum masuk
 * (mis. "nominal belum diatur").
 */
export const allowanceDetail = (allowance, days) => {
  if (allowance.note) return allowance.note;
  return allowance.perDay ? `${days} hari × ${formatRupiah(allowance.rate)}` : 'per bulan';
};

/**
 * Tunjangan label staff (staffLabels):
 * - Admin: tetap per bulan tanpa melihat absensi, selama staff aktif (staff nonaktif hanya bila masih bekerja di bulan
 *   itu, supaya yang sudah berhenti tidak terus mendapat tunjangan);
 * - CS: nominal × hari hadir (0 bila belum hadir).
 * Satu entri per label yang terpasang: [{ key, label, perDay, rate, amount, note }]; note = alasan amount masih 0, supaya
 * owner tahu kenapa tunjangan belum masuk.
 */
export function labelAllowances(person, days, settings) {
  return labelsOf(person).map((l) => {
    const rate = settings[l.settingKey] || 0;
    let note = '';
    if (!rate) note = 'nominal belum diatur di Atur';
    else if (l.perDay && !days) note = 'belum ada hari hadir bulan ini';
    else if (!l.perDay && !days && person.active === false) note = 'staff nonaktif';
    return {
      key: l.key,
      label: l.label,
      perDay: l.perDay,
      rate,
      amount: note ? 0 : l.perDay ? rate * days : rate,
      note,
    };
  });
}

/** Jam kerja (menit) dan hari jaga per staff dari catatan kerja bulan itu: { staffId: { minutes, days } }. */
export function workByStaff(records) {
  const work = {};
  activeRecords(records).forEach((r) => {
    const w = (work[r.staffId] ||= { minutes: 0, dates: new Set() });
    w.minutes += shiftMinutes(r.start, r.end);
    w.dates.add(r.date);
  });
  return Object.fromEntries(Object.entries(work).map(([id, w]) => [id, { minutes: w.minutes, days: w.dates.size }]));
}

/**
 * Rekap gaji satu cabang untuk satu bulan.
 * - transactions: transaksi bulan itu (yang dihapus diabaikan); inBranch(tx): transaksi dibuat di cabang ini;
 * - records: catatan kerja cabang bulan itu; settings: hasil payrollSettingsFor;
 * - bonuses: dokumen payrollBonuses bulan itu ({ staffId, amount, note, createdAt });
 * - payrolls: { staffId: dokumen payrolls bulan itu (angka yang dibekukan saat ditandai dibayar) }.
 * Hasil:
 * - rows: [{ staff, minutes, hours (dibulatkan ke atas), hourlyRate, customRate (harga khusus staff), hoursPay, days, mealPay, fees: [{ tx, amount, shareCount }],
 *   feeTotal, allowances: [{ key, label, perDay, rate, amount, note }], allowanceTotal, bonuses, bonusTotal, total, payroll,
 *   changed }] untuk staff aktif, ditambah staff nonaktif yang masih
 *   punya kerja/fee/bonus/tanda dibayar di bulan itu;
 * - unassigned: transaksi cabang ini yang punya fee tetapi belum ada penanggung jawabnya.
 */
export function buildPayroll({ staff, transactions, packages, records, settings, bonuses = [], payrolls, inBranch }) {
  const live = transactions.filter((tx) => !tx.isDeleted).sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
  const feesByStaff = new Map(staff.map((s) => [s.id, []]));
  const unassigned = [];

  for (const tx of live) {
    if (!tx.handlers?.length) {
      if (transactionFee(tx, packages) > 0 && inBranch(tx)) unassigned.push(tx);
      continue;
    }
    for (const share of handlerShares(tx, packages)) {
      // Staff cabang lain (bila satu transaksi ditangani lintas cabang) masuk rekap cabangnya sendiri
      feesByStaff.get(share.staffId)?.push({ tx, amount: share.amount, shareCount: tx.handlers.length });
    }
  }

  const work = workByStaff(records);
  const sortedBonuses = [...bonuses].sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
  const rows = staff
    .map((person) => {
      const { minutes = 0, days = 0 } = work[person.id] || {};
      const fees = feesByStaff.get(person.id).filter((f) => f.amount > 0);
      const ownBonuses = sortedBonuses.filter((b) => b.staffId === person.id);
      const hours = Math.ceil(minutes / 60);
      const { rate: hourlyRate, custom: customRate } = hourlyRateOf(settings, person.id);
      const hoursPay = hours * hourlyRate;
      const mealPay = days * settings.mealAllowance;
      const feeTotal = fees.reduce((sum, f) => sum + f.amount, 0);
      const bonusTotal = ownBonuses.reduce((sum, b) => sum + (b.amount || 0), 0);
      const allowances = labelAllowances(person, days, settings);
      const allowanceTotal = allowances.reduce((sum, a) => sum + a.amount, 0);
      const total = hoursPay + mealPay + allowanceTotal + feeTotal + bonusTotal;
      const payroll = payrolls[person.id] || null;
      return {
        staff: person,
        minutes,
        hours,
        hourlyRate,
        customRate,
        hoursPay,
        days,
        mealPay,
        fees,
        feeTotal,
        bonuses: ownBonuses,
        allowances,
        allowanceTotal,
        bonusTotal,
        total,
        payroll,
        // Ada perubahan setelah ditandai dibayar (catatan kerja, tarif, penanggung jawab, atau bonus)
        changed: !!payroll && payroll.total !== total,
      };
    })
    .filter(
      (row) =>
        row.staff.active !== false || row.days > 0 || row.fees.length > 0 || row.bonuses.length > 0 || row.payroll,
    );

  return { rows, unassigned };
}

/** Jumlah seluruh baris: upah jam kerja, uang makan, tunjangan, fee, bonus, total, dan berapa staff yang sudah dibayar. */
export const payrollTotals = (rows) =>
  rows.reduce(
    (acc, row) => ({
      hoursPay: acc.hoursPay + row.hoursPay,
      mealPay: acc.mealPay + row.mealPay,
      feeTotal: acc.feeTotal + row.feeTotal,
      allowanceTotal: acc.allowanceTotal + row.allowanceTotal,
      bonusTotal: acc.bonusTotal + row.bonusTotal,
      total: acc.total + row.total,
      paid: acc.paid + (row.payroll ? 1 : 0),
    }),
    { hoursPay: 0, mealPay: 0, allowanceTotal: 0, feeTotal: 0, bonusTotal: 0, total: 0, paid: 0 },
  );
