import { useState } from 'react';
import { CalendarCheck, ChartColumn } from 'lucide-react';
import { Card, useConfirm, useToast } from '../ui';
import { writeInBackground } from '../../utils/firestoreWrite';
import { formatMonth, recordRange, scheduledOn } from '../../utils/attendance';
import { addRecord, deleteRecord, restoreRecord, updateRecord } from './timData';
import AttendanceCalendar from './AttendanceCalendar';
import AttendanceRecap from './AttendanceRecap';
import DaySheet from './DaySheet';
import OpeningHoursCard from './OpeningHoursCard';
import RecordForm from './RecordForm';

/**
 * Absensi versi owner: kalender kerja, rekap (buka terlambat & lembur dari jam buka cabang), jam buka & tutup, dan
 * koreksi catatan di tanggal mana pun (Snapme Desktop hanya hari ini & kemarin). Catatan yang dihapus tetap terlihat
 * di rincian tanggal dan bisa dipulihkan.
 */
export default function AbsensiSection({
  orgId,
  user,
  managerId,
  month,
  onMonthChange,
  today,
  data,
  openingHours,
  toleranceMin,
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const { staff, versions, records } = data;
  const [selectedDate, setSelectedDate] = useState(null);
  const [form, setForm] = useState(null); // null | { record: catatan yang diubah | null }

  const fail = (title) => (err) => toast.error(title, err.message, { persistent: true });

  const handleSave = (fields) => {
    if (form.record) {
      writeInBackground(() => updateRecord(orgId, user, form.record.id, fields), fail('Gagal mengubah catatan'));
      toast.success('Catatan diubah', fields.staffName);
    } else {
      writeInBackground(() => addRecord(orgId, user, { ...fields, managerId }), fail('Gagal mencatat kerja'));
      toast.success('Kerja dicatat', `${fields.staffName}, ${fields.start}–${fields.end}`);
    }
    setForm(null);
  };

  const handleDelete = async (record) => {
    const ok = await confirm({
      title: 'Hapus catatan kerja?',
      message: `${record.staffName || 'Catatan'} ${recordRange(record)}. Catatan masih bisa dipulihkan dari rincian tanggal ini.`,
      confirmText: 'Hapus',
      destructive: true,
    });
    if (ok) writeInBackground(() => deleteRecord(orgId, user, record.id), fail('Gagal menghapus catatan'));
  };

  return (
    <>
      <Card
        title={
          <>
            <CalendarCheck size={18} aria-hidden="true" />
            Kalender kerja
          </>
        }
        description="Ketuk tanggal untuk melihat siapa yang bekerja, buka terlambat, dan lembur."
      >
        <AttendanceCalendar
          month={month}
          onMonthChange={onMonthChange}
          today={today}
          staff={staff}
          openingHours={openingHours}
          records={records}
          toleranceMin={toleranceMin}
          onSelectDate={setSelectedDate}
        />
      </Card>

      <Card
        title={
          <>
            <ChartColumn size={18} aria-hidden="true" />
            Rekap {formatMonth(month)}
          </>
        }
        description={`Dinilai dari jam buka cabang: buka terlambat dan lembur dihitung bila lebih dari ${toleranceMin} menit.`}
      >
        <AttendanceRecap
          month={month}
          staff={staff}
          openingHours={openingHours}
          records={records}
          toleranceMin={toleranceMin}
        />
      </Card>

      <OpeningHoursCard orgId={orgId} managerId={managerId} hours={openingHours} />

      {selectedDate && !form && (
        <DaySheet
          date={selectedDate}
          versions={versions}
          records={records}
          staff={staff}
          openingHours={openingHours}
          toleranceMin={toleranceMin}
          editable
          onAdd={() => setForm({ record: null })}
          onEdit={(record) => setForm({ record })}
          onDelete={handleDelete}
          onRestore={(record) =>
            writeInBackground(() => restoreRecord(orgId, user, record.id), fail('Gagal memulihkan catatan'))
          }
          onClose={() => setSelectedDate(null)}
        />
      )}
      {selectedDate && form && (
        <RecordForm
          date={selectedDate}
          record={form.record}
          staff={staff}
          shifts={scheduledOn(versions, selectedDate)}
          records={records}
          onSave={handleSave}
          onClose={() => setForm(null)}
        />
      )}
    </>
  );
}
