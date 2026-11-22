import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ScrollText } from 'lucide-react';
import { Badge, Card } from '../ui';
import { useLogIssues, useRecentErrors } from './useLogData';
import { groupErrors } from './logModel';

/** Pintu masuk mode Log di Profil, dengan jumlah error yang belum ditangani (semua cabang). */
export default function LogEntryCard({ orgId }) {
  const errors = useRecentErrors({ orgId });
  const issues = useLogIssues(orgId);
  const open = useMemo(
    () => groupErrors(errors.docs, issues).filter((g) => g.status !== 'resolved').length,
    [errors.docs, issues],
  );

  return (
    <Card>
      <Link to="/log" className="profile-log-link">
        <ScrollText size={20} aria-hidden="true" />
        <span className="profile-log-text">
          <span className="profile-log-title">Log aplikasi</span>
          <span className="profile-log-desc">Aktivitas, error, dan kondisi PC Snap Me Desktop</span>
        </span>
        {open > 0 && <Badge tone="danger">{open} error</Badge>}
        <ChevronRight size={18} aria-hidden="true" />
      </Link>
    </Card>
  );
}
