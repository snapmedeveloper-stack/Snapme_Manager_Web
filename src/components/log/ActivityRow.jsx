import { Badge } from '../ui';
import { CategoryIcon } from './logIcons';
import { OP_STATUS, SOURCE_LABEL, ackSummary, formatClock } from './logModel';

// Aktivitas yang menghapus sesuatu ditandai supaya cepat terlihat
const isRemoval = (event) => /delete|deleted|removed|logged_out/.test(event);

/**
 * Satu baris aktivitas (hasil logModel.buildActivityRows): ikon kategori, kalimat, status operasi & centang WhatsApp,
 * lalu PC & jam. Baris yang dilipat menampilkan ×N. onOpen(row) membuka rincian.
 */
export default function ActivityRow({ row, onOpen, showDate = false }) {
  const doc = row.doc;
  const op = row.kind === 'op' ? OP_STATUS[row.status] : null;
  const ack = row.kind === 'op' ? ackSummary(row.acks) : null;
  const folded = row.folded?.length || 0;
  const warn = doc.level === 'warn' || doc.level === 'error' || (op && op.tone !== 'success' && op.tone !== 'neutral');

  return (
    <li>
      <button
        type="button"
        className={`log-row${isRemoval(doc.event) ? ' is-removal' : ''}${warn ? ' is-warn' : ''}`}
        onClick={() => onOpen(row)}
      >
        <span className={`log-row-icon log-cat-${doc.category}`} aria-hidden="true">
          <CategoryIcon category={doc.category} />
        </span>
        <span className="log-row-main">
          <span className="log-row-text">{doc.message}</span>
          {(op || ack || doc.source !== 'user' || folded > 0) && (
            <span className="log-row-badges">
              {op && row.status !== 'succeeded' && <Badge tone={op.tone}>{op.label}</Badge>}
              {ack && <Badge tone={ack.tone}>{ack.label}</Badge>}
              {doc.source !== 'user' && <Badge tone="neutral">{SOURCE_LABEL[doc.source] || doc.source}</Badge>}
              {folded > 0 && <Badge tone="neutral">×{folded + 1}</Badge>}
            </span>
          )}
          <span className="log-row-meta num">
            {doc.machineName || doc.machineId} ·{' '}
            {showDate ? formatClock(row.at) : new Date(row.at).toTimeString().slice(0, 5)}
          </span>
        </span>
      </button>
    </li>
  );
}
