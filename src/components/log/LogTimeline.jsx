import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { EmptyState, Spinner } from '../ui';
import ActivityList from './ActivityList';
import { useSubjectTimeline } from './useLogData';
import { buildActivityRows } from './logModel';

/**
 * Linimasa satu booking/transaksi (§7.2.6): semua catatan dari semua PC untuk objek itu, urut waktu dari awal —
 * termasuk error yang terkait.
 */
export default function LogTimeline({ orgId, onOpenRow }) {
  const subjectId = decodeURIComponent(useParams().subjectId || '');
  const { docs, loading, error } = useSubjectTimeline(orgId, subjectId);
  const rows = useMemo(() => buildActivityRows(docs).reverse(), [docs]);
  const name = docs.find((d) => d.subject?.name)?.subject.name || subjectId;

  return (
    <div className="page-body">
      <h2 className="log-timeline-title">Linimasa {name}</h2>
      {loading ? (
        <div className="page-loading">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <EmptyState title="Gagal memuat linimasa" description={error} />
      ) : rows.length === 0 ? (
        <EmptyState title="Belum ada catatan untuk objek ini" />
      ) : (
        <ActivityList rows={rows} onOpen={onOpenRow} />
      )}
    </div>
  );
}
