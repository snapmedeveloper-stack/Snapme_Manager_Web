import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { CircleCheck, TriangleAlert } from 'lucide-react';
import { Card, EmptyState, Spinner } from '../ui';
import ActivityList from './ActivityList';
import { useLogRange } from './useLogData';
import { buildActivityRows, deviceState, formatFull, latestVersionOf, periodRange, seqGaps, toMs } from './logModel';

/**
 * Rincian satu PC: kondisi, kesinambungan log 7 hari (lompatan nomor urut = catatan yang hilang), dan aktivitas & error
 * dari PC ini saja.
 */
export default function LogDeviceDetail({ orgId, devices, onOpenRow }) {
  const machineId = decodeURIComponent(useParams().machineId || '');
  const device = devices.find((d) => d.id === machineId);
  const week = useMemo(() => periodRange('7hari'), []);
  const activities = useLogRange({ orgId, type: 'activity', machineId, from: week.from, to: week.to, pageSize: 1000 });
  const errors = useLogRange({ orgId, type: 'error', machineId, from: week.from, to: week.to, pageSize: 500 });
  const rows = useMemo(() => buildActivityRows(activities.docs), [activities.docs]);
  const gaps = useMemo(() => seqGaps([...activities.docs, ...errors.docs]), [activities.docs, errors.docs]);
  // Lompatan hanya bisa dinilai bila semua catatan rentang ini termuat
  const complete = !activities.hasMore && !errors.hasMore;

  if (!device) {
    return (
      <div className="page-body">
        <EmptyState title="PC tidak ditemukan" />
      </div>
    );
  }
  const st = deviceState(device, { latestVersion: latestVersionOf(devices) });

  return (
    <div className="page-body">
      <Card title={device.machineName || device.id} description={`Versi ${device.appVersion} · ${device.studioEmail}`}>
        <dl className="log-fields">
          <div className="log-field">
            <dt>Status</dt>
            <dd>
              {st.online ? 'Online' : 'Offline'} · terakhir aktif {formatFull(st.lastSeen)}
            </dd>
          </div>
          <div className="log-field">
            <dt>Server WhatsApp</dt>
            <dd>{device.isWaHost ? (device.waConnected ? 'Ya, tersambung' : 'Ya, terputus') : 'Bukan'}</dd>
          </div>
          <div className="log-field">
            <dt>Log di PC</dt>
            <dd className="num">
              {device.logsQueued ?? 0} menunggu dikirim · {device.logsSent ?? 0} terkirim
              {device.oldestQueuedAt ? ` · tertua ${formatFull(toMs(device.oldestQueuedAt))}` : ''}
            </dd>
          </div>
          {Number.isFinite(device.clockSkewMs) && (
            <div className="log-field">
              <dt>Selisih jam PC</dt>
              <dd className="num">{Math.round(device.clockSkewMs / 1000)} detik</dd>
            </div>
          )}
        </dl>
        {st.issues.length > 0 && (
          <ul className="log-attention">
            {st.issues.map((i) => (
              <li key={i} className="log-attention-item is-warning">
                <TriangleAlert size={16} aria-hidden="true" />
                <span>{i}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="Kesinambungan log"
        description="7 hari terakhir, dari nomor urut catatan PC ini. Nomor yang tidak ada bisa masih tertahan di PC, milik akun studio lain, ditolak server, atau terbuang."
      >
        {!complete ? (
          <p className="log-muted">
            Terlalu banyak catatan untuk diperiksa sekaligus; buka periode yang lebih pendek di Aktivitas.
          </p>
        ) : gaps.length === 0 ? (
          <p className="log-all-good">
            <CircleCheck size={18} aria-hidden="true" />
            Semua nomor catatan lengkap.
          </p>
        ) : (
          <ul className="log-attention">
            {gaps.map((g) => (
              <li key={`${g.from}`} className="log-attention-item is-warning">
                <TriangleAlert size={16} aria-hidden="true" />
                <span>
                  {g.missing} catatan belum ada di server (#{g.from}–#{g.to})
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={`Error 7 hari (${errors.docs.length})`}>
        {errors.loading ? (
          <Spinner />
        ) : errors.docs.length === 0 ? (
          <p className="log-muted">Tidak ada error.</p>
        ) : (
          <ActivityList rows={buildActivityRows(errors.docs)} onOpen={onOpenRow} grouped={false} />
        )}
      </Card>

      <Card title="Aktivitas 7 hari">
        {activities.loading ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <p className="log-muted">Belum ada aktivitas.</p>
        ) : (
          <ActivityList rows={rows} onOpen={onOpenRow} />
        )}
      </Card>
    </div>
  );
}
