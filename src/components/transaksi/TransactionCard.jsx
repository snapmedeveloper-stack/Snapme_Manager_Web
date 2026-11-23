import {
  Banknote,
  ChevronDown,
  CircleCheck,
  HandCoins,
  Landmark,
  MessageCircle,
  Package,
  Pencil,
  Printer,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { Badge, Button } from '../ui';
import { STATUS_TONE } from '../../constants/status';
import { formatRupiah } from '../../utils/format';
import { PAYMENT_LABEL, getStageInfo } from '../../utils/transactions';
import { isCustomDeposit, isCustomTransaction } from './customTransaction';
import { depositRemaining, isDepositTransaction } from '../../utils/deposit';

const formatDateTime = (ts) =>
  ts?.toMillis
    ? new Date(ts.toMillis()).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-';

const paymentLabel = (method) => PAYMENT_LABEL[method] || method || '-';

/** Link chat WhatsApp dari nomor booking ("08…" / "62…" / ID "62…@c.us"); null bila bukan nomor (mis. ID @lid). */
function waLink(phone) {
  if (!phone || phone.includes('@lid')) return null;
  const digits = phone.split('@')[0].replace(/\D/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits.startsWith('0') ? `62${digits.slice(1)}` : digits}`;
}

function StageBadge({ info }) {
  if (!info) return <Badge tone="neutral">Tanpa booking</Badge>;
  return (
    <Badge tone={STATUS_TONE[info.status]} icon={info.status === 'done' ? CircleCheck : undefined}>
      Tahap {info.stage}: {info.label}
    </Badge>
  );
}

function ItemThumb({ item }) {
  if (item.image) return <img src={item.image} alt="" className="trx-item-thumb" />;
  return (
    <span className="trx-item-thumb">
      <Package size={16} aria-hidden="true" />
    </span>
  );
}

/**
 * Satu transaksi (kartu, versi HP dari TransactionRow Snapme_Desktop): ringkasan, dan bila dibuka: item, pembayaran,
 * cetak nota, chat WA (wa.me, karena Manager tidak punya halaman Message), hapus/pulihkan. Transaksi custom: badge
 * Custom, rincian fee per staff & catatan, dan tombol Ubah (onEdit, hanya owner).
 * Transaksi DP (utils/deposit.js): badge DP + status lunas, sisa bayar, Lunasi (onSettle, DP custom) dan Refund
 * (lewat onToggleDeleted; halaman yang mengurus booking.deposits).
 */
export default function TransactionCard({
  tx,
  booking,
  isPhotobooth,
  expanded,
  onToggle,
  onPrint,
  onToggleDeleted,
  onEdit,
  onSettle,
}) {
  const PaymentIcon = tx.paymentMethod === 'transfer' ? Landmark : Banknote;
  const chat = waLink(booking?.waNumber || booking?.customerPhone);
  const isCustom = isCustomTransaction(tx);
  const isDeposit = isDepositTransaction(tx);
  const customDeposit = isCustomDeposit(tx);
  // DP lunas: DP custom diberi settledBy saat dilunasi; DP booking mengikuti status bayar booking
  const depositSettled = customDeposit ? !!tx.settledBy : !!booking?.paid;
  const hasOrder = isDeposit && tx.orderTotal > 0;
  const plannedHandlers = customDeposit ? tx.order?.handlers || [] : [];

  return (
    <article className={`trx-card${expanded ? ' is-expanded' : ''}${tx.isDeleted ? ' is-deleted' : ''}`}>
      <button type="button" className="trx-card-head" onClick={onToggle} aria-expanded={expanded}>
        <span className="trx-card-main">
          <span className="trx-card-name">{tx.customerName || 'Tanpa nama'}</span>
          <span className="trx-card-sub num">
            {formatDateTime(tx.createdAt)} · {tx.transactionNumber}
          </span>
          <span className="trx-card-badges">
            {isCustom || customDeposit ? (
              <Badge tone="accent">Custom</Badge>
            ) : (
              <StageBadge info={getStageInfo(booking, isPhotobooth)} />
            )}
            {isDeposit && <Badge tone="accent">DP</Badge>}
            {isDeposit && !tx.isDeleted && hasOrder && (
              <Badge tone={depositSettled ? 'success' : 'warning'}>{depositSettled ? 'Lunas' : 'Belum lunas'}</Badge>
            )}
            {isPhotobooth && <Badge tone="neutral">Photobooth</Badge>}
            {tx.isDeleted && <Badge tone="danger">{isDeposit ? 'Refund' : 'Dihapus'}</Badge>}
          </span>
        </span>
        <span className="trx-card-side">
          <span className="trx-card-total num">{formatRupiah(tx.total)}</span>
          <span className="trx-method">
            <PaymentIcon size={14} aria-hidden="true" />
            {paymentLabel(tx.paymentMethod)}
          </span>
          <ChevronDown size={18} className="trx-chevron" aria-hidden="true" />
        </span>
      </button>

      {expanded && (
        <div className="trx-card-detail">
          <ul className="trx-items">
            {(tx.items || []).map((item, idx) => (
              <li key={idx} className="trx-item">
                <ItemThumb item={item} />
                <span className="trx-item-text">
                  <span className="trx-item-name">{item.name}</span>
                  <span className="trx-card-sub num">
                    {item.qty}× @ {formatRupiah(item.price)}
                  </span>
                </span>
                <span className="num trx-item-total">{formatRupiah(item.price * item.qty)}</span>
              </li>
            ))}
          </ul>
          <dl className="trx-payment">
            <div>
              <dt>Metode</dt>
              <dd>{paymentLabel(tx.paymentMethod)}</dd>
            </div>
            <div>
              <dt>Dibayar</dt>
              <dd className="num">{formatRupiah(tx.amountPaid)}</dd>
            </div>
            <div>
              <dt>Kembalian</dt>
              <dd className="num">{formatRupiah(tx.change)}</dd>
            </div>
            {hasOrder && (
              <div>
                <dt>Total pesanan</dt>
                <dd className="num">{formatRupiah(tx.orderTotal)}</dd>
              </div>
            )}
            {hasOrder && (
              <div>
                <dt>{depositSettled ? 'Sisa (sudah dilunasi)' : 'Sisa bayar'}</dt>
                <dd className="num">{formatRupiah(depositRemaining(tx))}</dd>
              </div>
            )}
          </dl>
          {customDeposit && (
            <div className="trx-custom-detail">
              <span className="form-label">Rencana fee staff (masuk gaji saat dilunasi)</span>
              {plannedHandlers.length ? (
                <ul className="trx-fee-summary">
                  {plannedHandlers.map((h) => (
                    <li key={h.staffId}>
                      <span>{h.name}</span>
                      <span className="num">{formatRupiah(h.amount)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="form-hint">Tanpa fee</p>
              )}
              {tx.order?.note && <p className="trx-custom-note">{tx.order.note}</p>}
            </div>
          )}
          {isCustom && (
            <div className="trx-custom-detail">
              <span className="form-label">Fee staff</span>
              {tx.handlers?.length ? (
                <ul className="trx-fee-summary">
                  {tx.handlers.map((h) => (
                    <li key={h.staffId}>
                      <span>{h.name}</span>
                      <span className="num">{formatRupiah(h.amount)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="form-hint">Tanpa fee</p>
              )}
              {tx.note && <p className="trx-custom-note">{tx.note}</p>}
            </div>
          )}
          <div className="trx-card-actions">
            {isCustom && onEdit && !tx.isDeleted && (
              <Button icon={Pencil} onClick={() => onEdit(tx)}>
                Ubah
              </Button>
            )}
            {customDeposit && onSettle && !tx.isDeleted && !tx.settledBy && (
              <Button variant="primary" icon={HandCoins} onClick={() => onSettle(tx)}>
                Lunasi
              </Button>
            )}
            <Button icon={Printer} onClick={() => onPrint(tx)}>
              Cetak nota
            </Button>
            {chat && (
              <a className="btn" href={chat} target="_blank" rel="noopener noreferrer">
                <MessageCircle size={16} aria-hidden="true" />
                Chat WA
              </a>
            )}
            {tx.isDeleted ? (
              <Button icon={RotateCcw} onClick={() => onToggleDeleted(tx)}>
                Pulihkan
              </Button>
            ) : (
              <Button variant="danger" icon={Trash2} onClick={() => onToggleDeleted(tx)}>
                {isDeposit ? 'Refund' : 'Hapus'}
              </Button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
