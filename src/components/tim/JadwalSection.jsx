import { useId, useMemo, useState } from 'react';
import { CalendarClock, Plus, Save, Undo2, UserPlus, X } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Select, Tabs, TimeInput, useToast } from '../ui';
import { writeInBackground } from '../../utils/firestoreWrite';
import {
  addDays,
  DAY_KEYS,
  DAY_LABEL,
  DEFAULT_SHIFT,
  formatDay,
  scheduleVersionOn,
  shiftError,
  weekStartOf,
} from '../../utils/attendance';
import { saveSchedule } from './timData';

let rowSeq = 0;
const withKeys = (days = {}) =>
  Object.fromEntries(DAY_KEYS.map((d) => [d, (days[d] || []).map((s) => ({ ...s, key: `r${++rowSeq}` }))]));
const withoutKeys = (days) =>
  Object.fromEntries(DAY_KEYS.map((d) => [d, days[d].map(({ staffId, start, end }) => ({ staffId, start, end }))]));
const sameDays = (a, b) => JSON.stringify(withoutKeys(a)) === JSON.stringify(withoutKeys(b));

/** Pesan kesalahan per baris shift ({ [key]: pesan }). */
function rowErrors(days) {
  const errors = {};
  DAY_KEYS.forEach((d) => {
    const seen = new Set();
    days[d].forEach((row) => {
      if (!row.staffId) errors[row.key] = 'Pilih nama staff.';
      else if (seen.has(row.staffId)) errors[row.key] = 'Nama ini sudah dijadwalkan di hari yang sama.';
      else errors[row.key] = shiftError(row.start, row.end);
      seen.add(row.staffId);
    });
  });
  return Object.fromEntries(Object.entries(errors).filter(([, msg]) => msg));
}

/** Editor jadwal satu versi. Di-mount ulang (key) saat tanggal mulai atau versi dasarnya berubah. */
function ScheduleEditor({ orgId, user, managerId, effectiveFrom, base, staff, nextVersion }) {
  const formId = useId();
  const toast = useToast();
  const initial = useMemo(() => withKeys(base?.days), [base]);
  const [days, setDays] = useState(initial);
  const dirty = !sameDays(days, initial);
  const errors = rowErrors(days);
  const hasErrors = Object.keys(errors).length > 0;
  const staffById = new Map(staff.map((s) => [s.id, s]));

  const update = (day, key, fields) =>
    setDays((prev) => ({
      ...prev,
      [day]: prev[day].map((row) => (row.key === key ? { ...row, ...fields } : row)),
    }));
  const remove = (day, key) =>
    setDays((prev) => ({
      ...prev,
      [day]: prev[day].filter((row) => row.key !== key),
    }));
  const add = (day) =>
    setDays((prev) => {
      const last = prev[day][prev[day].length - 1];
      const shift = last ? { start: last.start, end: last.end } : DEFAULT_SHIFT;
      return {
        ...prev,
        [day]: [...prev[day], { staffId: '', ...shift, key: `r${++rowSeq}` }],
      };
    });

  const handleSave = (e) => {
    e.preventDefault();
    if (!dirty || hasErrors) return;
    writeInBackground(
      () =>
        saveSchedule(orgId, user, {
          managerId,
          effectiveFrom,
          days: withoutKeys(days),
        }),
      (err) =>
        toast.error('Gagal menyimpan jadwal', err.message, {
          persistent: true,
        }),
    );
    toast.success('Jadwal disimpan', `Berlaku mulai ${formatDay(effectiveFrom)}`);
  };

  return (
    <form id={formId} className="tim-sched" onSubmit={handleSave}>
      {nextVersion && (
        <p className="form-hint">
          Sudah ada jadwal lain mulai {formatDay(nextVersion.effectiveFrom)}. Jadwal ini hanya berlaku sampai sehari
          sebelumnya.
        </p>
      )}
      {DAY_KEYS.map((day) => (
        <div key={day} className="tim-sched-day">
          <div className="tim-sched-head">
            <span className="tim-sched-label">{DAY_LABEL[day]}</span>
            <span className="tim-sched-count">{days[day].length ? `${days[day].length} orang` : 'Libur'}</span>
            <Button size="sm" variant="ghost" icon={Plus} onClick={() => add(day)}>
              Tambah
            </Button>
          </div>
          {days[day].map((row) => {
            // Staff nonaktif tetap tampil di baris yang sudah memakainya
            const choices = staff.filter((s) => s.active !== false || s.id === row.staffId);
            const name = staffById.get(row.staffId)?.name || 'staff';
            return (
              <div key={row.key} className="tim-sched-row">
                <Select
                  className="tim-sched-staff"
                  value={row.staffId}
                  onChange={(staffId) => update(day, row.key, { staffId })}
                  aria-label={`Staff ${DAY_LABEL[day]}`}
                >
                  <option value="" disabled>
                    Pilih nama
                  </option>
                  {choices.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
                <Button
                  className="tim-sched-remove"
                  variant="ghost"
                  iconOnly
                  icon={X}
                  aria-label={`Hapus shift ${name} hari ${DAY_LABEL[day]}`}
                  onClick={() => remove(day, row.key)}
                />
                <div className="tim-sched-times">
                  <TimeInput
                    value={row.start}
                    aria-label={`Jam mulai ${name} hari ${DAY_LABEL[day]}`}
                    onChange={(start) => update(day, row.key, { start })}
                  />
                  <span aria-hidden="true">–</span>
                  <TimeInput
                    value={row.end}
                    aria-label={`Jam selesai ${name} hari ${DAY_LABEL[day]}`}
                    onChange={(end) => update(day, row.key, { end })}
                  />
                </div>
                {errors[row.key] && <span className="form-error tim-sched-error">{errors[row.key]}</span>}
              </div>
            );
          })}
        </div>
      ))}
      <div className="tim-sched-actions">
        {dirty && <Badge tone="warning">Belum disimpan</Badge>}
        {dirty && (
          <Button variant="ghost" icon={Undo2} onClick={() => setDays(initial)}>
            Batalkan
          </Button>
        )}
        <Button type="submit" variant="primary" icon={Save} disabled={!dirty || hasErrors}>
          Simpan jadwal
        </Button>
      </div>
    </form>
  );
}

/**
 * Jadwal kerja mingguan yang berulang setiap minggu. Setiap simpan membuat versi yang berlaku mulai Senin minggu ini
 * atau minggu depan, sehingga rekap minggu-minggu sebelumnya tetap dinilai dengan jadwal yang berlaku saat itu.
 */
export default function JadwalSection({ orgId, user, managerId, today, data, onAddStaff }) {
  const { staff, versions } = data;
  const thisWeek = weekStartOf(today);
  const [when, setWhen] = useState('next');
  const effectiveFrom = when === 'this' ? thisWeek : addDays(thisWeek, 7);
  const base = scheduleVersionOn(versions, effectiveFrom);
  const current = scheduleVersionOn(versions, today);
  const nextVersion = versions
    .filter((v) => v.effectiveFrom > effectiveFrom)
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))[0];

  if (!staff.some((s) => s.active !== false)) {
    return (
      <Card>
        <EmptyState
          icon={UserPlus}
          title="Belum ada staff"
          description="Daftarkan nama staff dulu, lalu susun jadwalnya di sini."
          action={
            <Button variant="primary" icon={UserPlus} onClick={onAddStaff}>
              Daftarkan staff
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <Card
      title={
        <>
          <CalendarClock size={18} aria-hidden="true" />
          Jadwal mingguan
        </>
      }
      description={
        current
          ? `Jadwal yang berlaku sekarang dimulai ${formatDay(current.effectiveFrom)}. Jadwal berulang setiap minggu.`
          : 'Belum ada jadwal. Jadwal berulang setiap minggu.'
      }
    >
      <div className="tim-sched-when">
        <Tabs
          ariaLabel="Berlaku mulai"
          value={when}
          onChange={setWhen}
          options={[
            { value: 'this', label: 'Mulai minggu ini' },
            { value: 'next', label: 'Mulai minggu depan' },
          ]}
        />
        <span className="form-hint">
          Berlaku mulai {formatDay(effectiveFrom)}.
          {when === 'this' && ' Hari yang sudah lewat di minggu ini ikut dinilai dengan jadwal baru.'}
        </span>
      </div>
      <ScheduleEditor
        key={`${effectiveFrom}|${base?.id || 'baru'}|${base?.updatedAt?.seconds || ''}`}
        orgId={orgId}
        user={user}
        managerId={managerId}
        effectiveFrom={effectiveFrom}
        base={base}
        staff={staff}
        nextVersion={nextVersion}
      />
    </Card>
  );
}
