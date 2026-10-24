import { Banknote, ChevronDown, CircleCheck, Landmark, MessageCircle, Package, Printer, RotateCcw, Trash2 } from 'lucide-react';
import { Badge, Button } from '../ui';
import { STATUS_TONE } from '../../constants/status';
import { formatRupiah } from '../../utils/format';
import { PAYMENT_LABEL, getStageInfo } from '../../utils/transactions';

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
 * cetak nota, chat WA (wa.me, karena Manager tidak punya halaman Message), hapus/pulihkan.
 */
export default function TransactionCard({ tx, booking, isPhotobooth, expanded, onToggle, onPrint, onToggleDeleted }) {
  const PaymentIcon = tx.paymentMethod === 'transfer' ? Landmark : Banknote;
  const chat = waLink(booking?.waNumber || booking?.customerPhone);

  return (
    <article className={`trx-card${expanded ? ' is-expanded' : ''}${tx.isDeleted ? ' is-deleted' : ''}`}>
      <button type="button" className="trx-card-head" onClick={onToggle} aria-expanded={expanded}>
        <span className="trx-card-main">
          <span className="trx-card-name">{tx.customerName || 'Tanpa nama'}</span>
          <span className="trx-card-sub num">
            {formatDateTime(tx.createdAt)} · {tx.transactionNumber}
          </span>
          <span className="trx-card-badges">
            <StageBadge info={getStageInfo(booking, isPhotobooth)} />
            {isPhotobooth && <Badge tone="neutral">Photobooth</Badge>}
            {tx.isDeleted && <Badge tone="danger">Dihapus</Badge>}
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
          </dl>
          <div className="trx-card-actions">
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
                Hapus
              </Button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
