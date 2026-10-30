import { useEffect, useState } from 'react';
import { UserCheck } from 'lucide-react';
import { onSnapshot, query, where } from 'firebase/firestore';
import { Badge } from '../ui';
import { getLocalDateString } from '../../utils/format';
import { dutyMinutes, formatElapsed, isOnDuty } from '../../utils/attendance';
import { attendanceCollection } from '../tim/timData';

/**
 * Staff yang sedang jaga sekarang (hanya lihat): "Mulai jaga" di Timeline Snapme Desktop mencatat kerja hari ini dengan
 * jam selesai kosong. managerId kosong (owner melihat semua cabang) = semua cabang.
 */
export default function OnDutyBar({ orgId, managerId }) {
  const today = getLocalDateString(new Date());
  const [onDuty, setOnDuty] = useState(null); // null = memuat
  const [now, setNow] = useState(() => new Date());

  // Lama jaga bertambah sendiri; hanya komponen ini yang dirender ulang, bukan seluruh Timeline
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!orgId) return undefined;
    return onSnapshot(
      query(attendanceCollection(orgId), where('date', '==', today)),
      (snap) =>
        setOnDuty(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((r) => isOnDuty(r) && (!managerId || r.managerId === managerId))
            .sort((a, b) => a.start.localeCompare(b.start)),
        ),
      (err) => {
        console.error('[Timeline] Gagal memuat staff jaga', err);
        setOnDuty([]);
      },
    );
  }, [orgId, managerId, today]);

  if (!onDuty) return null;
  return (
    <div className="tl-duty" aria-label="Staff yang sedang jaga">
      <span className="tl-duty-label">
        <UserCheck size={14} aria-hidden="true" />
        Jaga
      </span>
      {onDuty.length === 0 ? (
        <span className="tl-duty-empty">Belum ada yang jaga</span>
      ) : (
        onDuty.map((r) => (
          <Badge key={r.id} tone="accent">
            {r.staffName} ·{' '}
            <span className="num">
              {r.start}, {formatElapsed(dutyMinutes(r, now))}
            </span>
          </Badge>
        ))
      )}
    </div>
  );
}
