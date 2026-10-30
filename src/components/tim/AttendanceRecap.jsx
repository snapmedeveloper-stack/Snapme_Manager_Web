// Salinan Snapme_Desktop/src/components/absensi/AttendanceRecap.jsx: ubah keduanya bersamaan.
import { useMemo } from 'react';
import { Users } from 'lucide-react';
import { Badge, EmptyState } from '../ui';
import { attendanceRecap, formatDuration, formatElapsed, monthRange } from '../../utils/attendance';

/**
 * Rekap per staff dalam satu bulan: hari bekerja, berapa kali membuka studio terlambat, total lembur (lewat jam tutup),
 * dan total jam kerja. Dinilai dari jam buka cabang, bukan jadwal mingguan. Staff nonaktif hanya tampil bila punya
 * catatan di bulan ini.
 */
export default function AttendanceRecap({ month, staff, records, openingHours, toleranceMin }) {
  const recap = useMemo(() => {
    const { from, to } = monthRange(month);
    return attendanceRecap({ records, from, to, openingHours, toleranceMin });
  }, [month, records, openingHours, toleranceMin]);

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
                  <Badge tone="success">Hadir {r.days} hari</Badge>
                  {r.lateOpen > 0 && <Badge tone="warning">Buka terlambat {r.lateOpen}×</Badge>}
                  {r.overtimeMin > 0 && <Badge tone="accent">Lembur {formatElapsed(r.overtimeMin)}</Badge>}
                </span>
              ) : (
                <span className="abs-recap-empty">Belum ada catatan bulan ini</span>
              )}
            </div>
            <span className="abs-recap-hours num">{formatDuration(r?.minutes || 0)}</span>
          </li>
        );
      })}
    </ul>
  );
}
