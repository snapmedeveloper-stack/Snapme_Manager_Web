import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react';
import { Badge, EmptyState, Spinner, Tabs } from '../ui';
import { formatClock } from './logModel';
import { markErrorsSeen } from './useLogData';

/**
 * Error (§7.2.4): satu kartu per masalah (sidik jari), bukan banjir baris. Tab Belum ditangani / Sudah ditangani;
 * masalah yang muncul lagi setelah ditandai kembali ke Belum ditangani dengan label "Muncul lagi".
 * Selama halaman ini terbuka, error yang tampil dianggap sudah dilihat (tanda di menu Profil hilang).
 */
export default function LogErrors({ orgId, groups, loading, error }) {
  const [tab, setTab] = useState('open');
  useEffect(() => {
    if (!loading) markErrorsSeen(orgId);
  }, [orgId, loading, groups.length]);
  const open = groups.filter((g) => g.status !== 'resolved');
  const resolved = groups.filter((g) => g.status === 'resolved');
  const shown = tab === 'open' ? open : resolved;

  return (
    <div className="page-body">
      <Tabs
        ariaLabel="Status error"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'open', label: `Belum ditangani (${open.length})` },
          { value: 'resolved', label: `Sudah ditangani (${resolved.length})` },
        ]}
      />
      {loading ? (
        <div className="page-loading">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <EmptyState icon={CircleAlert} title="Gagal memuat error" description={error} />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={CircleCheck}
          title={tab === 'open' ? 'Tidak ada error yang perlu ditangani' : 'Belum ada error yang ditandai ditangani'}
        />
      ) : (
        <ul className="log-error-list">
          {shown.map((g) => {
            const Icon = g.level === 'error' ? CircleAlert : TriangleAlert;
            return (
              <li key={g.fingerprint}>
                <Link to={encodeURIComponent(g.fingerprint)} className={`log-error-card is-${g.level}`}>
                  <Icon size={18} aria-hidden="true" className="log-error-icon" />
                  <span className="log-error-main">
                    <span className="log-error-title">{g.message}</span>
                    <span className="log-row-badges">
                      {g.count > 1 && <Badge tone={g.level === 'error' ? 'danger' : 'warning'}>×{g.count}</Badge>}
                      {g.status === 'reopened' && <Badge tone="danger">Muncul lagi</Badge>}
                      {g.status === 'resolved' && <Badge tone="success">Ditangani</Badge>}
                    </span>
                    <span className="log-row-meta">
                      {g.machines.join(', ')}
                      {g.versions.length > 0 && ` · v${g.versions.join(', v')}`}
                    </span>
                    <span className="log-row-meta num">
                      Pertama {formatClock(g.firstAt)} · terakhir {formatClock(g.lastAt)}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
