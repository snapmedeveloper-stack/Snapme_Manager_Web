// Cetak nota transaksi lewat jendela cetak browser (Desktop memakai PDF dari aplikasi; isinya sama: utils/receipt).

import { formatRupiah } from '../../utils/format';
import { buildReceiptData, formatReceiptDate, kasirNameOf } from '../../utils/receipt';
import { escapeHtml, openPrintWindow } from '../../utils/printWindow';
import { PAYMENT_LABEL } from '../../utils/transactions';

const row = (label, value, bold = false) =>
  `<div class="row${bold ? ' bold' : ''}"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`;

/**
 * Buka jendela cetak berisi nota tx. Mengembalikan false bila pop-up diblokir browser.
 * Lebar kertas mengikuti pengaturan kasir (settings/kasir.paperSize, bawaan 80mm).
 */
export function printReceipt(tx, { user, userMeta, kasirSettings }) {
  const millis = tx.createdAt?.toMillis ? tx.createdAt.toMillis() : Date.now();
  const data = buildReceiptData(tx, {
    date: formatReceiptDate(millis),
    kasirName: kasirNameOf(user, userMeta),
    kasirSettings,
  });
  const { settings } = data;
  const items = (data.items || [])
    .map(
      (item) =>
        `${row(item.name, formatRupiah(item.price * item.qty))}<div class="muted">${item.qty}x @ ${escapeHtml(formatRupiah(item.price))}</div>`,
    )
    .join('');

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Nota ${escapeHtml(data.transactionNumber || data.id)}</title>
<style>
  @page { margin: 0; size: ${settings.paperSize} auto; }
  body { width: ${settings.paperSize}; margin: 0 auto; padding: 10px; box-sizing: border-box; font: 12px 'Courier New', monospace; color: #000; }
  .center { text-align: center; } .bold { font-weight: bold; } .muted { font-size: 11px; color: #555; margin-bottom: 6px; }
  .row { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
  .divider { border-bottom: 1px dashed #000; margin: 10px 0; }
</style></head><body>
  <div class="center bold" style="font-size:16px">${escapeHtml(settings.businessName)}</div>
  ${settings.address ? `<div class="center">${escapeHtml(settings.address)}</div>` : ''}
  ${settings.phone ? `<div class="center">Telp: ${escapeHtml(settings.phone)}</div>` : ''}
  <div class="divider"></div>
  ${row('No', data.transactionNumber || data.id)}
  ${row('Tgl', data.date)}
  ${row('Kasir', data.kasirName)}
  ${row('Pelanggan', data.customerName || '-')}
  ${row('Folder', data.folderName || '-')}
  <div class="divider"></div>
  ${items}
  <div class="divider"></div>
  ${row('Total', formatRupiah(data.total), true)}
  ${row('Metode', PAYMENT_LABEL[data.paymentMethod] || data.paymentMethod || '-')}
  ${row('Dibayar', formatRupiah(data.amountPaid))}
  ${row('Kembali', formatRupiah(data.change))}
  <div class="divider"></div>
  <div class="center">${escapeHtml(settings.footerNote)}</div>
</body></html>`;

  return openPrintWindow(html);
}
