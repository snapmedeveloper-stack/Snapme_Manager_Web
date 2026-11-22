import { useMemo, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import LogShell from '../components/log/LogShell';
import LogSummary from '../components/log/LogSummary';
import LogActivities from '../components/log/LogActivities';
import LogErrors from '../components/log/LogErrors';
import LogErrorDetail from '../components/log/LogErrorDetail';
import LogDevices from '../components/log/LogDevices';
import LogDeviceDetail from '../components/log/LogDeviceDetail';
import LogTimeline from '../components/log/LogTimeline';
import LogDetailSheet from '../components/log/LogDetailSheet';
import { useDevices, useLogIssues, useRecentErrors } from '../components/log/useLogData';
import { groupErrors } from '../components/log/logModel';
import './Log.css';

const TITLES = [
  [/^\/log\/aktivitas/, 'Aktivitas'],
  [/^\/log\/error\/.+/, 'Rincian error'],
  [/^\/log\/error/, 'Error'],
  [/^\/log\/perangkat\/.+/, 'Rincian PC'],
  [/^\/log\/perangkat/, 'Perangkat'],
  [/^\/log\/linimasa/, 'Linimasa'],
];

/**
 * Mode Log (Snapme_Desktop/docs/RENCANA_LOG_APLIKASI.md §7.2): pemantauan log aplikasi Snap Me Desktop, khusus owner.
 * Dibuka dari Profil → Log aplikasi dengan kerangka & navbar sendiri. managerId = cabang yang dipilih (kosong = semua).
 */
export default function Log({ orgId, user, managerId, branches = [], onViewManagerChange }) {
  const { pathname } = useLocation();
  const { devices, loading: devicesLoading } = useDevices(orgId);
  const issues = useLogIssues(orgId);
  const errors = useRecentErrors({ orgId, managerId });
  const errorGroups = useMemo(() => groupErrors(errors.docs, issues), [errors.docs, issues]);
  const openErrors = errorGroups.filter((g) => g.status !== 'resolved').length;
  const [detailRow, setDetailRow] = useState(null);

  const branchName = (id) => branches.find((b) => b.managerId === id)?.name || 'Cabang';
  const title = TITLES.find(([re]) => re.test(pathname))?.[1] || 'Log aplikasi';
  const shared = { orgId, user, managerId, devices, onOpenRow: setDetailRow };

  return (
    <LogShell
      title={title}
      branches={branches}
      managerId={managerId}
      onViewManagerChange={onViewManagerChange}
      badges={{ errors: openErrors }}
    >
      <Routes>
        <Route index element={<LogSummary {...shared} errorGroups={errorGroups} />} />
        <Route path="aktivitas" element={<LogActivities {...shared} />} />
        <Route
          path="error"
          element={<LogErrors orgId={orgId} groups={errorGroups} loading={errors.loading} error={errors.error} />}
        />
        <Route path="error/:fingerprint" element={<LogErrorDetail orgId={orgId} user={user} issues={issues} />} />
        <Route
          path="perangkat"
          element={
            <LogDevices devices={devices} loading={devicesLoading} managerId={managerId} branchName={branchName} />
          }
        />
        <Route path="perangkat/:machineId" element={<LogDeviceDetail {...shared} />} />
        <Route path="linimasa/:subjectId" element={<LogTimeline {...shared} />} />
        <Route path="*" element={<Navigate to="/log" replace />} />
      </Routes>
      {detailRow && (
        <LogDetailSheet
          row={detailRow}
          orgId={orgId}
          branchName={detailRow.doc.managerId ? branchName(detailRow.doc.managerId) : ''}
          onClose={() => setDetailRow(null)}
        />
      )}
    </LogShell>
  );
}
