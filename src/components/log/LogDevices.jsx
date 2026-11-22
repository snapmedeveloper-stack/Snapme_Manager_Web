import { Link } from 'react-router-dom';
import { MonitorSmartphone, TriangleAlert } from 'lucide-react';
import { Badge, EmptyState, Spinner } from '../ui';
import { deviceState, formatAgo, latestVersionOf } from './logModel';
import { useNow } from './useLogData';

/**
 * Perangkat (§7.2.5): satu kartu per PC — online/offline, versi (ditandai bila tertinggal), server WA, cabang, terakhir
 * aktif, error hari ini, dan masalah kesehatan log (antrian tertahan, jam meleset, log terbuang/ditolak).
 */
export default function LogDevices({ devices, loading, managerId, branchName }) {
  const shown = managerId ? devices.filter((d) => d.managerId === managerId) : devices;
  const latestVersion = latestVersionOf(devices);
  const now = useNow();

  if (loading) {
    return (
      <div className="page-loading">
        <Spinner size="lg" />
      </div>
    );
  }
  return (
    <div className="page-body">
      {shown.length === 0 ? (
        <EmptyState
          icon={MonitorSmartphone}
          title="Belum ada PC yang melapor"
          description="PC muncul setelah memakai Snap Me Desktop versi dengan log aplikasi dan login akun studio."
        />
      ) : (
        <ul className="log-device-list">
          {shown.map((d) => {
            const st = deviceState(d, { now, latestVersion });
            return (
              <li key={d.id}>
                <Link to={encodeURIComponent(d.id)} className="log-device-card">
                  <span className="log-device-head">
                    <span className={`dot ${st.online ? 'dot-success' : 'dot-danger'}`} aria-hidden="true" />
                    <span className="log-device-name">{d.machineName || d.id}</span>
                    <Badge tone={st.online ? 'success' : 'danger'}>{st.online ? 'Online' : 'Offline'}</Badge>
                  </span>
                  <span className="log-row-badges">
                    <Badge tone={st.outdated ? 'warning' : 'neutral'}>v{d.appVersion}</Badge>
                    {d.isWaHost && (
                      <Badge tone={d.waConnected ? 'success' : 'warning'}>
                        {d.waConnected ? 'Server WA tersambung' : 'Server WA terputus'}
                      </Badge>
                    )}
                    {d.errorsToday > 0 && <Badge tone="danger">{d.errorsToday} error hari ini</Badge>}
                  </span>
                  <span className="log-row-meta">
                    {branchName(d.managerId)} · {d.studioEmail} ·{' '}
                    {st.lastSeen ? `aktif ${formatAgo(st.lastSeen, now)}` : 'belum aktif'}
                  </span>
                  {st.issues
                    .filter((i) => !i.startsWith('Offline'))
                    .map((issue) => (
                      <span key={issue} className="log-device-issue">
                        <TriangleAlert size={14} aria-hidden="true" />
                        {issue}
                      </span>
                    ))}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
