import { useState } from 'react';
import { Copy, Pencil, Store } from 'lucide-react';
import { FieldPath, setDoc } from 'firebase/firestore';
import { Button, Card, Modal, Switch, TimeInput, useToast } from '../ui';
import { writeInBackground } from '../../utils/firestoreWrite';
import { DAY_KEYS, DAY_LABEL, DEFAULT_OPENING, openingError } from '../../utils/attendance';
import { attendanceSettingsRef } from './timData';

/** Isi awal form: jam tersimpan, atau jam bawaan untuk hari yang belum diatur. */
const initialDays = (hours) => Object.fromEntries(DAY_KEYS.map((d) => [d, hours?.[d] || { ...DEFAULT_OPENING }]));

const dayText = (day) => (!day ? 'Belum diatur' : day.closed ? 'Tutup' : `${day.open}–${day.close}`);

function OpeningHoursForm({ hours, onSave, onClose }) {
  const [days, setDays] = useState(() => initialDays(hours));
  const errors = Object.fromEntries(DAY_KEYS.map((d) => [d, openingError(days[d])]));
  const valid = DAY_KEYS.every((d) => !errors[d]);
  const update = (day, fields) => setDays((prev) => ({ ...prev, [day]: { ...prev[day], ...fields } }));
  // Hari tutup disimpan { closed: true }; jam terakhir diingat di form supaya muncul lagi saat dibuka
  const toStored = (day) => (day.closed ? { closed: true } : { open: day.open, close: day.close });

  return (
    <Modal
      open
      title="Jam buka & tutup"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Batal</Button>
          <Button
            variant="primary"
            disabled={!valid}
            onClick={() => onSave(Object.fromEntries(DAY_KEYS.map((d) => [d, toStored(days[d])])))}
          >
            Simpan
          </Button>
        </>
      }
    >
      <div className="form-stack">
        <p className="form-hint">
          Mulai jaga pertama lewat jam buka dihitung buka terlambat; selesai jaga lewat jam tutup dihitung lembur
          (keduanya setelah toleransi di Profil).
        </p>
        <Button
          size="sm"
          variant="ghost"
          icon={Copy}
          onClick={() => setDays((prev) => Object.fromEntries(DAY_KEYS.map((d) => [d, { ...prev.mon }])))}
        >
          Samakan semua hari dengan Senin
        </Button>
        <ul className="tim-hours">
          {DAY_KEYS.map((d) => {
            const day = days[d];
            return (
              <li key={d} className="tim-hours-row">
                <span className="tim-hours-day">{DAY_LABEL[d]}</span>
                <Switch
                  checked={!day.closed}
                  onChange={(on) =>
                    update(
                      d,
                      on
                        ? {
                            closed: false,
                            open: day.open || DEFAULT_OPENING.open,
                            close: day.close || DEFAULT_OPENING.close,
                          }
                        : { closed: true },
                    )
                  }
                  ariaLabel={`${DAY_LABEL[d]} buka`}
                />
                {day.closed ? (
                  <span className="tim-hours-closed">Tutup</span>
                ) : (
                  <span className="tim-sched-times">
                    <TimeInput
                      value={day.open}
                      aria-label={`Jam buka hari ${DAY_LABEL[d]}`}
                      onChange={(open) => update(d, { open })}
                    />
                    <span aria-hidden="true">–</span>
                    <TimeInput
                      value={day.close}
                      aria-label={`Jam tutup hari ${DAY_LABEL[d]}`}
                      onChange={(close) => update(d, { close })}
                    />
                  </span>
                )}
                {errors[d] && <span className="form-error tim-hours-error">{errors[d]}</span>}
              </li>
            );
          })}
        </ul>
      </div>
    </Modal>
  );
}

/**
 * Jam buka & tutup cabang per hari (settings/attendance.openingHours[managerId]): dasar penilaian buka terlambat dan
 * lembur di Absensi. hours: jam tersimpan cabang ini (undefined = belum diatur).
 */
export default function OpeningHoursCard({ orgId, managerId, hours }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);

  const handleSave = (days) => {
    // mergeFields: jam cabang ini diganti utuh (hari buka ↔ tutup), cabang lain & toleransi tidak tersentuh
    const path = new FieldPath('openingHours', managerId);
    writeInBackground(
      () => setDoc(attendanceSettingsRef(orgId), { openingHours: { [managerId]: days } }, { mergeFields: [path] }),
      (err) => toast.error('Gagal menyimpan jam buka', err.message, { persistent: true }),
    );
    toast.success('Jam buka disimpan');
    setEditing(false);
  };

  return (
    <Card
      title={
        <>
          <Store size={18} aria-hidden="true" />
          Jam buka &amp; tutup
        </>
      }
      description="Dasar penilaian buka terlambat dan lembur. Jadwal mingguan hanya acuan siapa yang jaga."
      actions={
        <Button size="sm" icon={Pencil} onClick={() => setEditing(true)}>
          Ubah
        </Button>
      }
    >
      <dl className="tim-hours-summary">
        {DAY_KEYS.map((d) => (
          <div key={d} className={hours?.[d]?.closed ? 'is-closed' : ''}>
            <dt>{DAY_LABEL[d]}</dt>
            <dd className="num">{dayText(hours?.[d])}</dd>
          </div>
        ))}
      </dl>
      {editing && <OpeningHoursForm hours={hours} onSave={handleSave} onClose={() => setEditing(false)} />}
    </Card>
  );
}
