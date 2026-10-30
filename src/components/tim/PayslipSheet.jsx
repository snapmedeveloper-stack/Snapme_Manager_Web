import { CircleCheck, FileDown, Pencil, Plus, Trash2, TriangleAlert, Undo2 } from 'lucide-react';
import { Badge, Button, Modal } from '../ui';
import { formatRupiah } from '../../utils/format';
import { addMonths, formatMonth } from '../../utils/attendance';
import { allowanceDetail, hoursDetail, packageNamesOf } from './gajiUtils';

const formatDateTime = (ts) =>
  ts?.toMillis
    ? new Date(ts.toMillis()).toLocaleString('id-ID', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-';

/** Satu baris rincian: judul, keterangan hitungan (mis. "45j × Rp 15.000"), dan jumlahnya. */
function PayLine({ label, detail, amount }) {
  return (
    <div className="tim-pay-line">
      <span>
        {label} {detail && <span className="tim-pay-muted num">{detail}</span>}
      </span>
      <span className="num">{formatRupiah(amount)}</span>
    </div>
  );
}

/**
 * Rincian gaji satu staff satu bulan (row dari gajiUtils.buildPayroll): upah jam kerja, uang makan, tunjangan label
 * (beserta alasan bila belum masuk; label diatur di Tim → Staff), fee per transaksi (penanggung jawabnya bisa
 * dikoreksi), bonus (tambah/hapus), total, dan tanda dibayar. Angka saat ditandai dibayar dibekukan di payrolls; bila
 * data kemudian berubah, selisihnya ditampilkan. settings: tarif yang berlaku bulan ini. onDownload: unduh slip PDF.
 */
export default function PayslipSheet({
  row,
  month,
  settings,
  packages,
  onEditHandlers,
  onAddBonus,
  onDeleteBonus,
  onDownload,
  onMarkPaid,
  onUnmarkPaid,
  onClose,
}) {
  const { staff, days, hoursPay, mealPay, allowances, fees, feeTotal, bonuses, bonusTotal, total, payroll, changed } =
    row;

  return (
    <Modal
      open
      title={staff.name}
      onClose={onClose}
      footer={
        <>
          <Button icon={FileDown} onClick={onDownload}>
            Unduh slip
          </Button>
          {payroll ? (
            <Button icon={Undo2} onClick={onUnmarkPaid}>
              Batalkan tanda dibayar
            </Button>
          ) : (
            <Button variant="primary" icon={CircleCheck} onClick={onMarkPaid}>
              Tandai sudah dibayar
            </Button>
          )}
        </>
      }
    >
      <div className="form-stack">
        <p className="form-hint">
          Periode {formatMonth(month)}, dibayar awal {formatMonth(addMonths(month, 1))}.
        </p>

        <PayLine label="Jam kerja" detail={hoursDetail(row, settings)} amount={hoursPay} />
        <PayLine
          label="Uang makan"
          detail={`${days} hari × ${formatRupiah(settings.mealAllowance)}`}
          amount={mealPay}
        />
        {allowances.map((a) => (
          <PayLine key={a.key} label={`Tunjangan ${a.label}`} detail={allowanceDetail(a, days)} amount={a.amount} />
        ))}

        <section className="tim-pay-fees" aria-label="Rincian fee">
          <PayLine label="Fee paket" detail={`${fees.length} transaksi`} amount={feeTotal} />
          {fees.length > 0 && (
            <ul className="tim-pay-list">
              {fees.map(({ tx, amount, shareCount }) => (
                <li key={tx.id} className="tim-pay-item">
                  <span className="tim-row-main">
                    <span className="tim-row-title">{tx.customerName || 'Tanpa nama'}</span>
                    <span className="tim-row-meta">
                      <span className="num">{formatDateTime(tx.createdAt)}</span> · {packageNamesOf(tx, packages)}
                      {shareCount > 1 && ` · dibagi ${shareCount}`}
                    </span>
                  </span>
                  <span className="num tim-pay-amount">{formatRupiah(amount)}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    icon={Pencil}
                    aria-label={`Ubah penanggung jawab ${tx.customerName || 'transaksi'}`}
                    onClick={() => onEditHandlers(tx)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="tim-pay-fees" aria-label="Rincian bonus">
          <div className="tim-pay-line">
            <span>
              Bonus <span className="tim-pay-muted num">{bonuses.length} bonus</span>
            </span>
            <span className="tim-pay-bonus-total">
              <span className="num">{formatRupiah(bonusTotal)}</span>
              <Button size="sm" icon={Plus} onClick={onAddBonus}>
                Tambah
              </Button>
            </span>
          </div>
          {bonuses.length > 0 && (
            <ul className="tim-pay-list">
              {bonuses.map((bonus) => (
                <li key={bonus.id} className="tim-pay-item">
                  <span className="tim-row-main">
                    <span className="tim-row-title">{bonus.note || 'Bonus'}</span>
                    <span className="tim-row-meta num">{formatDateTime(bonus.createdAt)}</span>
                  </span>
                  <span className="num tim-pay-amount">{formatRupiah(bonus.amount)}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    icon={Trash2}
                    aria-label={`Hapus bonus ${bonus.note || formatRupiah(bonus.amount)}`}
                    onClick={() => onDeleteBonus(bonus)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="tim-pay-line is-total">
          <span>Total diterima</span>
          <span className="num">{formatRupiah(total)}</span>
        </div>

        {payroll && (
          <p className="tim-pay-status">
            <Badge tone="success" icon={CircleCheck}>
              Dibayar {formatRupiah(payroll.total)}
            </Badge>
            <span>
              {formatDateTime(payroll.paidAt)} oleh {payroll.paidBy}
            </span>
          </p>
        )}
        {changed && (
          <p className="tim-pay-warning">
            <TriangleAlert size={16} aria-hidden="true" />
            Ada perubahan setelah ditandai dibayar (jam kerja, tarif, fee, atau bonus): tercatat{' '}
            {formatRupiah(payroll.total)}, sekarang {formatRupiah(total)}. Batalkan tanda dibayar lalu tandai lagi bila
            selisihnya sudah dibayarkan.
          </p>
        )}
      </div>
    </Modal>
  );
}
