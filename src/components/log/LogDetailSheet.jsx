import { useNavigate } from 'react-router-dom';
import { CircleCheck, CircleX, GitBranch, Loader } from 'lucide-react';
import { Badge, Button, Modal } from '../ui';
import { useCrossCheck } from './useLogData';
import { explainError } from './errorExplain';
import {
  CATEGORY_LABEL,
  OP_STATUS,
  SOURCE_LABEL,
  ackSummary,
  contextRows,
  crossCheckFor,
  formatFull,
  toMs,
} from './logModel';

function Field({ label, children }) {
  return (
    <div className="log-field">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/**
 * Rincian satu baris aktivitas/error: kalimat, status bukti (hasil operasi, centang WhatsApp, pemeriksaan silang dengan
 * data nyata), penjelasan sehari-hari untuk error, waktu persis, PC & akun, isi konteks, dan tautan ke linimasa objeknya.
 */
export default function LogDetailSheet({ row, orgId, branchName, onClose }) {
  const navigate = useNavigate();
  const doc = row.doc;
  const op = row.kind === 'op' ? OP_STATUS[row.status] : null;
  const ack = row.kind === 'op' ? ackSummary(row.acks) : null;
  const check = useCrossCheck(orgId, crossCheckFor(doc));
  const subject = doc.subject;
  const context = { ...(row.started?.context || {}), ...(doc.context || {}) };
  const rows = contextRows(context);
  const explain = doc.type === 'error' ? explainError(doc) : null;

  return (
    <Modal open title={CATEGORY_LABEL[doc.category] || doc.category} onClose={onClose}>
      <div className="form-stack">
        <p className="log-detail-message">{explain ? explain.title : doc.message}</p>
        <div className="log-row-badges">
          {op && <Badge tone={op.tone}>{op.label}</Badge>}
          {ack && <Badge tone={ack.tone}>{ack.label}</Badge>}
          {doc.level === 'warn' && <Badge tone="warning">Peringatan</Badge>}
          {doc.level === 'error' && <Badge tone="danger">Error</Badge>}
          <Badge tone="neutral">{SOURCE_LABEL[doc.source] || doc.source}</Badge>
        </div>

        {explain && (
          <div>
            <p className="log-explain-text">{explain.meaning}</p>
            <p className="log-explain-label log-explain-gap">Yang perlu dilakukan</p>
            <p className="log-explain-text">{explain.action}</p>
          </div>
        )}

        {check && (
          <p className={`log-check is-${check.status}`}>
            {check.status === 'checking' && <Loader size={16} aria-hidden="true" />}
            {check.status === 'match' && <CircleCheck size={16} aria-hidden="true" />}
            {(check.status === 'mismatch' || check.status === 'error') && <CircleX size={16} aria-hidden="true" />}
            {check.label}
            {check.status === 'match' && ' (dicek dengan data)'}
          </p>
        )}

        <dl className="log-fields">
          {explain && explain.title !== doc.message && <Field label="Pesan asli">{doc.message}</Field>}
          <Field label="Waktu">{formatFull(row.at)}</Field>
          {row.kind === 'op' && row.started && row.result && (
            <Field label="Lama proses">
              <span className="num">
                {Math.max(0, Math.round((toMs(row.result.occurredAt) - toMs(row.started.occurredAt)) / 100) / 10)} detik
              </span>
            </Field>
          )}
          <Field label="PC">{doc.machineName || doc.machineId}</Field>
          <Field label="Akun studio">{doc.studioEmail}</Field>
          {branchName && <Field label="Cabang">{branchName}</Field>}
          <Field label="Versi aplikasi">{doc.appVersion || '-'}</Field>
          {doc.count > 1 && <Field label="Terjadi">{doc.count}× (digabung)</Field>}
          {context.error && <Field label="Error">{context.error}</Field>}
          {rows.map((r) => (
            <Field key={r.key} label={r.label}>
              {r.value}
            </Field>
          ))}
        </dl>

        {row.kind === 'op' && row.acks.length > 0 && (
          <section aria-label="Status centang WhatsApp">
            <h3 className="log-section-title">Bukti dari WhatsApp</h3>
            <ul className="log-mini-list">
              {row.acks.map((a) => (
                <li key={a.id}>
                  <span className="num">{formatFull(toMs(a.occurredAt))}</span> · {a.message}
                </li>
              ))}
            </ul>
          </section>
        )}

        {row.folded?.length > 0 && (
          <section aria-label="Kejadian serupa">
            <h3 className="log-section-title">{row.folded.length + 1}× berturut-turut</h3>
            <ul className="log-mini-list">
              {[row, ...row.folded].map((r) => (
                <li key={r.doc.id}>
                  <span className="num">{formatFull(r.at)}</span> · {r.doc.message}
                </li>
              ))}
            </ul>
          </section>
        )}

        {context.stack && (
          <details className="log-tech">
            <summary>Detail teknis</summary>
            <pre>{context.stack}</pre>
          </details>
        )}

        {subject && (
          <Button
            icon={GitBranch}
            onClick={() => {
              onClose();
              navigate(`/log/linimasa/${encodeURIComponent(subject.id)}`);
            }}
          >
            Lihat linimasa {subject.name || subject.id}
          </Button>
        )}
      </div>
    </Modal>
  );
}
