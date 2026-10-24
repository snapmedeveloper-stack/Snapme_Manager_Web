// Salinan Snapme_Desktop/src/components/absensi/AttendanceRecap.jsx: ubah keduanya bersamaan.
import { useMemo } from 'react';
import { Users } from 'lucide-react';
import { Badge, EmptyState } from '../ui';
import { attendanceRecap, formatDuration, monthRange } from '../../utils/attendance';

/**
 * Rekap performa per staff dalam satu bulan (sampai hari ini): hadir dari jadwal, tidak hadir, terlambat, pulang
 * cepat, shift tambahan, dan total jam kerja. Staff nonaktif hanya tampil bila punya data di bulan ini.
 */
export default function AttendanceRecap({ month, today, staff, versions, records, toleranceMin }) {
  const recap = useMemo(() => {
    const { from, to } = monthRange(month);
    return attendanceRecap({
      versions,
      records,
      from,
      to,
      today,
      toleranceMin,
    });
  }, [month, versions, records, today, toleranceMin]);

  const rows = staff.filter((s) => s.active !== false || recap[s.id]);
  if (!rows.length) {
    return <EmptyState icon={Users} title="Belum ada staff" description="Staff didaftarkan oleh owner." />;
  }

  return (
    <ul className="abs-recap">
      {rows.map((s) => {
        const r = recap[s.id];
        return (
          <li key={s.id} className="abs-recap-row">
            <div className="abs-recap-main">
              <span className="abs-recap-name">
                {s.name}
                {s.active === false && <Badge>Nonaktif</Badge>}
              </span>
              {r ? (
                <span className="abs-recap-badges">
                  <Badge tone={r.absent ? 'neutral' : 'success'}>
                    Hadir {r.present - r.extra}/{r.scheduled}
                  </Badge>
                  {r.absent > 0 && <Badge tone="danger">Tidak hadir {r.absent}</Badge>}
                  {r.late > 0 && <Badge tone="warning">Terlambat {r.late}</Badge>}
                  {r.earlyLeave > 0 && <Badge tone="warning">Pulang cepat {r.earlyLeave}</Badge>}
                  {r.extra > 0 && <Badge tone="accent">Tambahan {r.extra}</Badge>}
                </span>
              ) : (
                <span className="abs-recap-empty">Belum ada jadwal atau catatan bulan ini</span>
              )}
            </div>
            <span className="abs-recap-hours num">{formatDuration(r?.minutes || 0)}</span>
          </li>
        );
      })}
    </ul>
  );
}
