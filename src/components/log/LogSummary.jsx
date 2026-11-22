import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CircleCheck, CircleAlert, TriangleAlert } from 'lucide-react';
import { Card, EmptyState, Spinner } from '../ui';
import ActivityRow from './ActivityRow';
import { useLogCount, useLogRange, useNow } from './useLogData';
import {
  attentionItems,
  buildActivityRows,
  deviceState,
  formatAgo,
  hourlyCounts,
  latestVersionOf,
  periodRange,
  seqGaps,
} from './logModel';

const TODAY_WINDOW = 1000;

/**
 * Ringkasan (beranda mode Log, §7.2.2): apa yang perlu diperhatikan, angka hari ini, grafik per jam, kondisi PC, dan
 * aktivitas terbaru. errorGroups & devices dimuat di halaman Log; aktivitas hari ini dimuat di sini.
 */
export default function LogSummary({ orgId, managerId, devices, errorGroups, onOpenRow }) {
  const today = useMemo(() => periodRange('hari'), []);
  const activities = useLogRange({
    orgId,
    type: 'activity',
    managerId,
    from: today.from,
    to: today.to,
    pageSize: TODAY_WINDOW,
  });
  const errorsToday = useLogRange({ orgId, type: 'error', managerId, from: today.from, to: today.to, pageSize: 300 });
  const activityCount = useLogCount({ orgId, type: 'activity', managerId, from: today.from, to: today.to });
  const now = useNow();

  const rows = useMemo(() => buildActivityRows(activities.docs, now), [activities.docs, now]);
  const hours = useMemo(() => hourlyCounts(activities.docs), [activities.docs]);
  const maxHour = Math.max(1, ...hours);
  const gaps = useMemo(() => seqGaps([...activities.docs, ...errorsToday.docs]), [activities.docs, errorsToday.docs]);
  const branchDevices = managerId ? devices.filter((d) => d.managerId === managerId) : devices;
  const attention = attentionItems({ errorGroups, devices: branchDevices, gaps, now });
  const latestVersion = latestVersionOf(devices);
  const online = branchDevices.filter((d) => deviceState(d, { now, latestVersion }).online).length;
  const errorCount = errorsToday.docs.reduce((n, d) => n + (d.count || 1), 0);

  if (activities.loading) {
    return (
      <div className="page-loading">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="page-body">
      <Card title="Perlu perhatian">
        {attention.length === 0 ? (
          <p className="log-all-good">
            <CircleCheck size={18} aria-hidden="true" />
            Semua normal: tidak ada error yang belum ditangani dan semua PC sehat.
          </p>
        ) : (
          <ul className="log-attention">
            {attention.slice(0, 8).map((item) => (
              <li key={item.text}>
                <Link to={item.to} className={`log-attention-item is-${item.tone}`}>
                  {item.tone === 'danger' ? (
                    <CircleAlert size={16} aria-hidden="true" />
                  ) : (
                    <TriangleAlert size={16} aria-hidden="true" />
                  )}
                  <span>{item.text}</span>
                </Link>
              </li>
            ))}
            {attention.length > 8 && <li className="log-muted">+{attention.length - 8} lainnya</li>}
          </ul>
        )}
      </Card>

      <Card title="Hari ini">
        <dl className="log-stats">
          <div>
            <dt>Aktivitas</dt>
            <dd className="num">{activityCount ?? activities.docs.length}</dd>
          </div>
          <div className={errorCount ? 'is-danger' : ''}>
            <dt>Error</dt>
            <dd className="num">{errorCount}</dd>
          </div>
          <div>
            <dt>PC online</dt>
            <dd className="num">
              {online}/{branchDevices.length}
            </dd>
          </div>
        </dl>
        <div className="log-hours" role="img" aria-label="Jumlah aktivitas per jam hari ini">
          {hours.map((n, h) => (
            <span key={h} className="log-hour-bar" title={`${String(h).padStart(2, '0')}:00 — ${n} aktivitas`}>
              <span className="log-hour-fill" style={{ height: `${(n / maxHour) * 100}%` }} />
            </span>
          ))}
        </div>
        <div className="log-hours-axis num" aria-hidden="true">
          <span>00</span>
          <span>06</span>
          <span>12</span>
          <span>18</span>
          <span>23</span>
        </div>
      </Card>

      <Card
        title="Perangkat"
        actions={
          <Link to="perangkat" className="log-link">
            Semua
          </Link>
        }
      >
        {branchDevices.length === 0 ? (
          <EmptyState
            title="Belum ada PC yang melapor"
            description="PC muncul setelah memakai Snap Me Desktop versi dengan log aplikasi."
          />
        ) : (
          <ul className="log-device-mini">
            {branchDevices.map((d) => {
              const st = deviceState(d, { now, latestVersion });
              return (
                <li key={d.id}>
                  <Link to={`perangkat/${encodeURIComponent(d.id)}`} className="log-device-mini-row">
                    <span className={`dot ${st.online ? 'dot-success' : 'dot-danger'}`} aria-hidden="true" />
                    <span className="log-device-mini-name">{d.machineName || d.id}</span>
                    <span className="log-muted num">
                      v{d.appVersion}
                      {d.isWaHost ? ' · server WA' : ''}
                    </span>
                    <span className="log-muted num">{st.lastSeen ? formatAgo(st.lastSeen, now) : '-'}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card
        title="Aktivitas terbaru"
        actions={
          <Link to="aktivitas" className="log-link">
            Semua
          </Link>
        }
      >
        {rows.length === 0 ? (
          <EmptyState title="Belum ada aktivitas hari ini" />
        ) : (
          <ul className="log-list">
            {rows.slice(0, 6).map((r) => (
              <ActivityRow key={r.doc.id} row={r} onOpen={onOpenRow} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
