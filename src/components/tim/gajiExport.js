// Unduhan bagian Gaji: slip gaji per staff (jendela cetak → "Simpan sebagai PDF") dan rekap semua staff satu bulan
// (CSV yang terbuka di Excel). Angka diambil dari baris gajiUtils.buildPayroll, sama dengan yang tampil di layar.
import {
  activeRecords,
  addMonths,
  formatDay,
  formatDuration,
  formatMonth,
  recordRange,
  shiftMinutes,
} from '../../utils/attendance';
import { shareOrDownload } from '../../utils/download';
import { formatRupiah } from '../../utils/format';
import { escapeHtml, openPrintWindow } from '../../utils/printWindow';
import { allowanceDetail, hoursDetail, packageNamesOf } from './gajiUtils';
import { STAFF_LABELS } from './staffLabels';

const DATE_TIME = { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' };
/** Timestamp Firestore → "25 Okt 2026 14.30"; '-' bila belum ada (mis. tulisan yang belum sampai server). */
const formatDate = (ts) => (ts?.toMillis ? new Date(ts.toMillis()).toLocaleString('id-ID', DATE_TIME) : '-');

const paidText = (row) => (row.payroll ? `Dibayar ${formatDate(row.payroll.paidAt)}` : 'Belum dibayar');

/** Catatan kerja staff per tanggal: [{ date, ranges, minutes }] urut tanggal. */
function workDays(records, staffId) {
  const byDate = new Map();
  activeRecords(records)
    .filter((r) => r.staffId === staffId)
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
    .forEach((r) => {
      const day = byDate.get(r.date) || { date: r.date, ranges: [], minutes: 0 };
      day.ranges.push(recordRange(r));
      day.minutes += shiftMinutes(r.start, r.end);
      byDate.set(r.date, day);
    });
  return [...byDate.values()];
}

const table = (headers, rows, alignRight = []) =>
  `<table><thead><tr>${headers
    .map((h, i) => `<th${alignRight.includes(i) ? ' class="r"' : ''}>${escapeHtml(h)}</th>`)
    .join('')}</tr></thead><tbody>${rows
    .map(
      (cells) =>
        `<tr>${cells.map((c, i) => `<td${alignRight.includes(i) ? ' class="r"' : ''}>${escapeHtml(c)}</td>`).join('')}</tr>`,
    )
    .join('')}</tbody></table>`;

/**
 * Slip gaji satu staff (row dari buildPayroll) di jendela cetak: ringkasan upah, rincian fee per transaksi, bonus, dan
 * jam kerja per tanggal. Judul jendela menjadi nama file PDF. false bila pop-up diblokir browser.
 */
export function printPayslip(row, { month, settings, packages, records, branchName }) {
  const title = `Slip Gaji ${row.staff.name} ${formatMonth(month)}`;
  const days = workDays(records, row.staff.id);
  const summary = table(
    ['Komponen', 'Hitungan', 'Jumlah'],
    [
      ['Jam kerja', hoursDetail(row, settings), formatRupiah(row.hoursPay)],
      ['Uang makan', `${row.days} hari × ${formatRupiah(settings.mealAllowance)}`, formatRupiah(row.mealPay)],
      ...row.allowances.map((a) => [`Tunjangan ${a.label}`, allowanceDetail(a, row.days), formatRupiah(a.amount)]),
      ['Fee paket', `${row.fees.length} transaksi`, formatRupiah(row.feeTotal)],
      ['Bonus', `${row.bonuses.length} bonus`, formatRupiah(row.bonusTotal)],
    ],
    [2],
  );
  const bonuses = row.bonuses.length
    ? table(
        ['Tanggal', 'Keterangan', 'Bonus'],
        row.bonuses.map((b) => [formatDate(b.createdAt), b.note || 'Bonus', formatRupiah(b.amount)]),
        [2],
      )
    : '';
  const fees = row.fees.length
    ? table(
        ['Tanggal', 'Customer', 'Paket', 'Dibagi', 'Fee'],
        row.fees.map(({ tx, amount, shareCount }) => [
          formatDate(tx.createdAt),
          tx.customerName || 'Tanpa nama',
          packageNamesOf(tx, packages),
          shareCount > 1 ? `${shareCount} orang` : '-',
          formatRupiah(amount),
        ]),
        [4],
      )
    : '<p class="muted">Tidak ada fee bulan ini.</p>';
  const work = days.length
    ? table(
        ['Tanggal', 'Jam', 'Lama'],
        days.map((d) => [formatDay(d.date, { short: true }), d.ranges.join(', '), formatDuration(d.minutes)]),
        [2],
      )
    : '<p class="muted">Tidak ada catatan kerja bulan ini.</p>';

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  @page { size: A4; margin: 16mm; }
  body { margin: 0; font: 12px/1.5 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color: #0f172a; }
  h1 { margin: 0; font-size: 20px; } h2 { margin: 20px 0 6px; font-size: 14px; }
  .muted { color: #5b6b82; } .head { display: flex; justify-content: space-between; gap: 16px; padding-bottom: 12px; border-bottom: 2px solid #0058b3; }
  table { width: 100%; border-collapse: collapse; } th, td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; text-align: left; vertical-align: top; }
  th { background: #f1f5f9; font-weight: 600; } .r { text-align: right; white-space: nowrap; }
  .total { display: flex; justify-content: space-between; margin-top: 10px; padding: 10px 12px; background: #e3edf9; font-size: 16px; font-weight: 700; color: #0058b3; }
  .foot { margin-top: 24px; font-size: 11px; }
</style></head><body>
  <div class="head">
    <div><h1>Slip Gaji</h1><div class="muted">${escapeHtml(branchName || 'Snap Me')}</div></div>
    <div style="text-align:right"><strong>${escapeHtml(row.staff.name)}</strong>
      <div class="muted">Periode ${escapeHtml(formatMonth(month))} · dibayar awal ${escapeHtml(formatMonth(addMonths(month, 1)))}</div>
      <div class="muted">${escapeHtml(paidText(row))}</div></div>
  </div>
  <h2>Ringkasan</h2>${summary}
  <div class="total"><span>Total diterima</span><span>${escapeHtml(formatRupiah(row.total))}</span></div>
  <h2>Rincian fee paket</h2>${fees}
  ${bonuses && `<h2>Rincian bonus</h2>${bonuses}`}
  <h2>Jam kerja per tanggal</h2>${work}
  <div class="foot muted">Dibuat dari Snap Me Manager, ${escapeHtml(new Date().toLocaleString('id-ID', DATE_TIME))}.</div>
</body></html>`;

  return openPrintWindow(html, 'width=900,height=700');
}

/** Satu sel CSV: diapit kutip bila berisi pemisah, kutip, atau baris baru. */
const csvCell = (value) => {
  const text = String(value ?? '');
  return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const csvLine = (cells) => cells.map(csvCell).join(';');

/**
 * Isi CSV rekap gaji satu bulan: tabel per staff (angka mentah supaya bisa dijumlah di Excel), baris total, lalu
 * rincian fee per transaksi dan rincian bonus. Pemisah titik koma (bawaan Excel berbahasa Indonesia).
 */
export function payrollCsv(rows, { month, settings, packages, branchName }) {
  const lines = [
    csvLine([`Rekap gaji ${branchName || 'Snap Me'}`, formatMonth(month)]),
    csvLine([
      'Harga per jam',
      settings.hourlyRate,
      'Uang makan per hari',
      settings.mealAllowance,
      'Tunjangan Admin per bulan',
      settings.adminAllowance,
      'Tunjangan CS per hari hadir',
      settings.csAllowance,
    ]),
    '',
    csvLine([
      'Nama',
      'Jam kerja (dibulatkan)',
      'Jam kerja asli',
      'Upah jam kerja',
      'Hari jaga',
      'Uang makan',
      ...STAFF_LABELS.map((l) => `Tunjangan ${l.label}`),
      'Transaksi fee',
      'Fee',
      'Bonus',
      'Total',
      'Status',
    ]),
    ...rows.map((r) =>
      csvLine([
        r.staff.name,
        r.hours,
        formatDuration(r.minutes),
        r.hoursPay,
        r.days,
        r.mealPay,
        ...STAFF_LABELS.map((l) => r.allowances.find((a) => a.key === l.key)?.amount || 0),
        r.fees.length,
        r.feeTotal,
        r.bonusTotal,
        r.total,
        paidText(r),
      ]),
    ),
    csvLine([
      'TOTAL',
      rows.reduce((s, r) => s + r.hours, 0),
      '',
      rows.reduce((s, r) => s + r.hoursPay, 0),
      rows.reduce((s, r) => s + r.days, 0),
      rows.reduce((s, r) => s + r.mealPay, 0),
      ...STAFF_LABELS.map((l) =>
        rows.reduce((s, r) => s + (r.allowances.find((a) => a.key === l.key)?.amount || 0), 0),
      ),
      rows.reduce((s, r) => s + r.fees.length, 0),
      rows.reduce((s, r) => s + r.feeTotal, 0),
      rows.reduce((s, r) => s + r.bonusTotal, 0),
      rows.reduce((s, r) => s + r.total, 0),
      '',
    ]),
    '',
    csvLine(['Rincian fee']),
    csvLine(['Nama', 'Tanggal', 'Customer', 'Paket', 'Dibagi', 'Fee']),
    ...rows.flatMap((r) =>
      r.fees.map(({ tx, amount, shareCount }) =>
        csvLine([
          r.staff.name,
          formatDate(tx.createdAt),
          tx.customerName || 'Tanpa nama',
          packageNamesOf(tx, packages),
          shareCount,
          amount,
        ]),
      ),
    ),
    '',
    csvLine(['Rincian bonus']),
    csvLine(['Nama', 'Tanggal', 'Keterangan', 'Bonus']),
    ...rows.flatMap((r) =>
      r.bonuses.map((b) => csvLine([r.staff.name, formatDate(b.createdAt), b.note || 'Bonus', b.amount])),
    ),
  ];
  return lines.join('\r\n');
}

/** Bagikan (HP) atau unduh rekap gaji sebagai file CSV. */
export function downloadPayrollCsv(rows, options) {
  const name = `Rekap Gaji ${options.branchName || 'Snap Me'} ${formatMonth(options.month)}`.replace(
    /[\\/:*?"<>|]/g,
    '',
  );
  // BOM supaya Excel membaca UTF-8 (nama dengan huruf non-ASCII)
  const blob = new Blob(['﻿', payrollCsv(rows, options)], { type: 'text/csv;charset=utf-8' });
  return shareOrDownload(blob, `${name}.csv`, { title: name });
}
