import { useId, useState } from 'react';
import { setDoc } from 'firebase/firestore';
import { CalendarCheck, Save } from 'lucide-react';
import { Button, Card, useToast } from '../ui';
import { writeInBackground } from '../../utils/firestoreWrite';
import { attendanceSettingsRef } from '../tim/timData';
import { useAttendanceSettings } from '../tim/useTimData';

/** Toleransi (menit) buka terlambat & lembur di rekap absensi, berlaku untuk semua cabang. Jam buka diatur di Tim. */
export default function AttendanceSettings({ orgId }) {
  const formId = useId();
  const toast = useToast();
  const { lateToleranceMin } = useAttendanceSettings(orgId);
  const [draft, setDraft] = useState(null); // null = belum diubah
  const value = draft ?? String(lateToleranceMin);
  const parsed = Number(value);
  const valid = value !== '' && Number.isInteger(parsed) && parsed >= 0 && parsed <= 120;
  const dirty = draft !== null && parsed !== lateToleranceMin;

  const handleSave = (e) => {
    e.preventDefault();
    if (!valid || !dirty) return;
    writeInBackground(
      () => setDoc(attendanceSettingsRef(orgId), { lateToleranceMin: parsed }, { merge: true }),
      (err) =>
        toast.error('Gagal menyimpan pengaturan absensi', err.message, {
          persistent: true,
        }),
    );
    toast.success('Pengaturan absensi disimpan');
    setDraft(null);
  };

  return (
    <Card
      title={
        <>
          <CalendarCheck size={18} aria-hidden="true" />
          Absensi
        </>
      }
    >
      <form id={formId} className="form-stack" onSubmit={handleSave}>
        <div className="form-group">
          <label htmlFor={`${formId}-tolerance`}>Toleransi buka terlambat &amp; lembur (menit)</label>
          <input
            id={`${formId}-tolerance`}
            className={`input num${valid ? '' : ' is-error'}`}
            type="number"
            inputMode="numeric"
            min={0}
            max={120}
            value={value}
            onChange={(e) => setDraft(e.target.value)}
          />
          <span className={valid ? 'form-hint' : 'form-error'}>
            {valid
              ? 'Jaga pertama yang dimulai lewat jam buka, atau kerja yang selesai lewat jam tutup, lebih dari batas ini dihitung buka terlambat atau lembur. Jam buka & tutup diatur di Tim → Absensi.'
              : 'Isi angka 0 sampai 120.'}
          </span>
        </div>
        <div className="profile-actions">
          <Button type="submit" variant="primary" icon={Save} disabled={!valid || !dirty}>
            Simpan
          </Button>
        </div>
      </form>
    </Card>
  );
}
