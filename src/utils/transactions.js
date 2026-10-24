// Salinan Snapme_Desktop/src/components/transaksi/transactionUtils.js: ubah keduanya bersamaan.
// Perhitungan murni halaman Transaksi (tanpa React): tahap booking dan rekap pendapatan.

import { bookingStage, PHOTOBOOTH_STAGES, STUDIO_STAGES, stageLabel } from './bookingStage';

export const PAYMENT_LABEL = { cash: 'Tunai', transfer: 'Transfer' };

/**
 * Tahap proses booking untuk badge: { stage, label, status }, atau null bila transaksi tanpa booking.
 * status adalah kunci STATUS_TONE: done (tahap terakhir), waiting (photobooth belum datang), active (lainnya).
 */
export function getStageInfo(booking, isPhotobooth) {
  if (!booking) return null;
  const stage = bookingStage(booking, { isPhotobooth });
  const lastStage = (isPhotobooth ? PHOTOBOOTH_STAGES : STUDIO_STAGES).length;
  let status = 'active';
  if (stage === lastStage) status = 'done';
  else if (isPhotobooth && stage === 1) status = 'waiting';
  return { stage, label: stageLabel(stage, isPhotobooth), status };
}

/**
 * Rekap transaksi (yang sudah difilter): pendapatan, jumlah, metode bayar, dan pendapatan per kategori item.
 * Kategori ditebak dari katalog: paket, item tambahan, cetak (id "cetak_…" atau template), sisanya "lainnya".
 */
export function summarizeTransactions(transactions, { packages, addOns, templates }) {
  const packageIds = new Set(packages.map((p) => p.id));
  const addOnIds = new Set(addOns.map((a) => a.id));
  const templateIds = new Set(templates.map((t) => t.id));
  const summary = {
    revenue: 0,
    count: 0,
    bookingCount: 0,
    cash: 0,
    transfer: 0,
    byCategory: { paket: 0, tambahan: 0, cetak: 0, lainnya: 0 },
  };

  for (const tx of transactions) {
    const txTotal = tx.total || 0;
    summary.count += 1;
    if (tx.bookingId) summary.bookingCount += 1;
    summary.revenue += txTotal;
    if (tx.paymentMethod === 'transfer') summary.transfer += txTotal;
    else summary.cash += txTotal;

    for (const item of tx.items || []) {
      const itemTotal = (item.price || 0) * (item.qty || 1);
      let category = 'lainnya';
      if (packageIds.has(item.id)) category = 'paket';
      else if (addOnIds.has(item.id)) category = 'tambahan';
      else if (item.id.startsWith('cetak_') || templateIds.has(item.id)) category = 'cetak';
      summary.byCategory[category] += itemTotal;
    }
  }

  summary.average = summary.count > 0 ? Math.round(summary.revenue / summary.count) : 0;
  return summary;
}
