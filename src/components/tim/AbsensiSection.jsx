import { useState } from 'react';
import { CalendarCheck, ChartColumn } from 'lucide-react';
import { Card, useConfirm, useToast } from '../ui';
import { writeInBackground } from '../../utils/firestoreWrite';
import { formatMonth, scheduledOn } from '../../utils/attendance';
import { addRecord, deleteRecord, restoreRecord, updateRecord } from './timData';
import AttendanceCalendar from './AttendanceCalendar';
import AttendanceRecap from './AttendanceRecap';
import DaySheet from './DaySheet';
import RecordForm from './RecordForm';

/**
 * Absensi versi owner: kalender kerja, rekap performa, dan koreksi catatan di tanggal mana pun (Snapme Desktop hanya
 * hari ini & kemarin). Catatan yang dihapus tetap terlihat di rincian tanggal dan bisa dipulihkan.
 */
export default function AbsensiSection({ orgId, user, managerId, month, onMonthChange, today, data, toleranceMin }) {
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
      message: `${record.staffName || 'Catatan'} ${record.start}–${record.end}. Catatan masih bisa dipulihkan dari rincian tanggal ini.`,
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
        description="Ketuk tanggal untuk melihat siapa yang terjadwal dan siapa yang bekerja."
      >
        <AttendanceCalendar
          month={month}
          onMonthChange={onMonthChange}
          today={today}
          versions={versions}
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
        description={`Dinilai sampai hari ini. Terlambat/pulang cepat dihitung bila lebih dari ${toleranceMin} menit.`}
      >
        <AttendanceRecap
          month={month}
          today={today}
          staff={staff}
          versions={versions}
          records={records}
          toleranceMin={toleranceMin}
        />
      </Card>

      {selectedDate && !form && (
        <DaySheet
          date={selectedDate}
          today={today}
          versions={versions}
          records={records}
          staff={staff}
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
