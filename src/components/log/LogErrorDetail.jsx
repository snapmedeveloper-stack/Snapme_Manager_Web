import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CircleCheck, ClipboardCopy, Undo2 } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Spinner, useToast } from '../ui';
import { lastActionsBefore, reopenIssue, resolveIssue, useFingerprintDocs } from './useLogData';
import { contextRows, developerReport, formatClock, formatFull, groupErrors, toMs } from './logModel';

/** Jumlah kejadian per hari selama 7 hari terakhir (grafik kecil). */
function dailyCounts(docs, now = Date.now()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, i) => ({ from: start.getTime() - (6 - i) * 86400000, n: 0 }));
  for (const d of docs) {
    const at = toMs(d.lastAt) ?? toMs(d.occurredAt);
    const day = days.find((x) => at >= x.from && at < x.from + 86400000);
    if (day) day.n += d.count || 1;
  }
  return days;
}

/**
 * Rincian satu masalah (§7.2.4): penjelasan, kapan saja terjadi, aksi terakhir di PC sebelum error, detail teknis,
 * salin untuk developer, dan tandai sudah ditangani.
 */
export default function LogErrorDetail({ orgId, user, issues }) {
  const toast = useToast();
  const fingerprint = decodeURIComponent(useParams().fingerprint || '');
  const { docs, loading, error } = useFingerprintDocs(orgId, fingerprint);
  const group = useMemo(() => groupErrors(docs, issues)[0] || null, [docs, issues]);
  const latest = useMemo(
    () => [...docs].sort((a, b) => (toMs(b.lastAt) ?? 0) - (toMs(a.lastAt) ?? 0))[0] || null,
    [docs],
  );
  const [lastActions, setLastActions] = useState({ key: null, docs: [] });
  const actionsKey = latest ? `${latest.machineId}|${toMs(latest.lastAt)}` : null;

  useEffect(() => {
    if (!latest) return undefined;
    let cancelled = false;
    lastActionsBefore(orgId, latest.machineId, toMs(latest.lastAt) ?? toMs(latest.occurredAt))
      .then((found) => !cancelled && setLastActions({ key: actionsKey, docs: found }))
      .catch((err) => {
        console.error('[Log] Gagal memuat aksi sebelum error', err);
        if (!cancelled) setLastActions({ key: actionsKey, docs: [], error: err.message });
      });
    return () => {
      cancelled = true;
    };
    // actionsKey mewakili PC & waktu error terakhir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, actionsKey]);

  if (loading) {
    return (
      <div className="page-loading">
        <Spinner size="lg" />
      </div>
    );
  }
  if (error || !group) {
    return (
      <div className="page-body">
        <EmptyState title="Error tidak ditemukan" description={error || 'Mungkin sudah dihapus.'} />
      </div>
    );
  }

  const actions = lastActions.key === actionsKey ? lastActions.docs : [];
  const days = dailyCounts(docs);
  const maxDay = Math.max(1, ...days.map((d) => d.n));
  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(developerReport(group, actions));
      toast.success('Laporan disalin', 'Tempel ke chat developer.');
    } catch (err) {
      toast.error('Gagal menyalin', err.message);
    }
  };
  const toggleResolved = async () => {
    try {
      if (group.status === 'resolved') await reopenIssue(orgId, fingerprint);
      else await resolveIssue(orgId, fingerprint, user);
    } catch (err) {
      toast.error('Gagal menyimpan status', err.message);
    }
  };

  return (
    <div className="page-body">
      <Card>
        <div className="form-stack">
          <p className="log-detail-message">{group.message}</p>
          <div className="log-row-badges">
            <Badge tone={group.level === 'error' ? 'danger' : 'warning'}>
              {group.level === 'error' ? 'Error' : 'Peringatan'}
            </Badge>
            <Badge tone="neutral">×{group.count}</Badge>
            {group.status === 'reopened' && <Badge tone="danger">Muncul lagi setelah ditangani</Badge>}
            {group.status === 'resolved' && <Badge tone="success">Sudah ditangani</Badge>}
          </div>
          <p className="log-muted">
            Terjadi di {group.machines.join(', ')} · pertama {formatFull(group.firstAt)} · terakhir{' '}
            {formatFull(group.lastAt)}
          </p>
          <div className="log-actions">
            <Button icon={ClipboardCopy} onClick={copyReport}>
              Salin untuk developer
            </Button>
            <Button
              variant={group.status === 'resolved' ? 'default' : 'primary'}
              icon={group.status === 'resolved' ? Undo2 : CircleCheck}
              onClick={toggleResolved}
            >
              {group.status === 'resolved' ? 'Batalkan tanda ditangani' : 'Tandai sudah ditangani'}
            </Button>
          </div>
        </div>
      </Card>

      <Card title="Kapan saja terjadi" description="7 hari terakhir">
        <div className="log-days-chart" role="img" aria-label="Jumlah kejadian per hari">
          {days.map((d) => (
            <span
              key={d.from}
              className="log-day-bar"
              title={`${new Date(d.from).toLocaleDateString('id-ID')} — ${d.n}×`}
            >
              <span className="log-hour-fill" style={{ height: `${(d.n / maxDay) * 100}%` }} />
            </span>
          ))}
        </div>
        <ul className="log-mini-list">
          {docs.slice(0, 20).map((d) => (
            <li key={d.id}>
              <span className="num">{formatClock(toMs(d.lastAt) ?? toMs(d.occurredAt))}</span> ·{' '}
              {d.machineName || d.machineId} · v{d.appVersion}
              {d.count > 1 && ` · ${d.count}× dalam 10 menit`}
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Aksi terakhir di PC itu sebelum error" description={latest ? latest.machineName : ''}>
        {actions.length === 0 ? (
          <p className="log-muted">
            {lastActions.error
              ? `Gagal memuat: ${lastActions.error}`
              : 'Tidak ada aktivitas tercatat sebelum error ini.'}
          </p>
        ) : (
          <ul className="log-mini-list">
            {actions.map((a) => (
              <li key={a.id}>
                <span className="num">{formatClock(toMs(a.occurredAt))}</span> · {a.message}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Detail teknis">
        <dl className="log-fields">
          <div className="log-field">
            <dt>Error asli</dt>
            <dd>{latest?.context?.error || '-'}</dd>
          </div>
          {contextRows(latest?.context).map((r) => (
            <div key={r.key} className="log-field">
              <dt>{r.label}</dt>
              <dd>{r.value}</dd>
            </div>
          ))}
          <div className="log-field">
            <dt>Sidik jari</dt>
            <dd className="num">{fingerprint}</dd>
          </div>
        </dl>
        {latest?.context?.stack && (
          <details className="log-tech">
            <summary>Stack</summary>
            <pre>{latest.context.stack}</pre>
          </details>
        )}
      </Card>
    </div>
  );
}
