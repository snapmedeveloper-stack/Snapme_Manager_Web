// Salinan Snapme_Desktop/src/components/absensi/RecordForm.jsx: ubah keduanya bersamaan.
import { useId, useState } from 'react';
import { Button, Modal, Select, TimeInput } from '../ui';
import { DEFAULT_SHIFT, formatDay, overlapsRecord, shiftError } from '../../utils/attendance';

/**
 * Form catat / ubah satu catatan kerja pada tanggal tertentu: pilih nama, lalu jam mulai & selesai.
 * Jam terisi otomatis dari jadwal staff itu hari ini (shifts). Catatan yang bertumpuk dengan catatan staff yang sama
 * di tanggal yang sama ditolak. onSave({ staffId, staffName, date, start, end }).
 */
export default function RecordForm({ date, record = null, staff, shifts, records, onSave, onClose }) {
  const formId = useId();
  const [staffId, setStaffId] = useState(record?.staffId || '');
  const [start, setStart] = useState(record?.start || '');
  const [end, setEnd] = useState(record?.end || '');
  const [error, setError] = useState('');
  // Staff nonaktif tidak bisa dipilih lagi, kecuali catatan yang sedang diubah memang miliknya
  const choices = staff.filter((s) => s.active !== false || s.id === record?.staffId);

  const pickStaff = (id) => {
    setStaffId(id);
    setError('');
    if (record) return;
    const shift = shifts.find((s) => s.staffId === id);
    setStart(shift?.start || start || DEFAULT_SHIFT.start);
    setEnd(shift?.end || end || DEFAULT_SHIFT.end);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!staffId) {
      setError('Pilih nama staff.');
      return;
    }
    const timeError = shiftError(start, end);
    if (timeError) {
      setError(timeError);
      return;
    }
    if (overlapsRecord(records, { staffId, date, start, end }, record?.id)) {
      setError('Jam ini bertumpuk dengan catatan lain milik staff yang sama di tanggal ini.');
      return;
    }
    const staffName = staff.find((s) => s.id === staffId)?.name || record?.staffName || '';
    onSave({ staffId, staffName, date, start, end });
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={record ? 'Ubah catatan kerja' : 'Catat kerja'}
      footer={
        <>
          <Button onClick={onClose}>Batal</Button>
          <Button type="submit" form={formId} variant="primary">
            Simpan
          </Button>
        </>
      }
    >
      <form id={formId} className="form-stack" onSubmit={handleSubmit}>
        <p className="form-hint">{formatDay(date)}</p>
        <div className="form-group">
          <label htmlFor={`${formId}-staff`}>Nama</label>
          <Select id={`${formId}-staff`} value={staffId} onChange={pickStaff}>
            <option value="" disabled>
              Pilih nama
            </option>
            {choices.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {shifts.some((sh) => sh.staffId === s.id) ? ' (terjadwal)' : ''}
              </option>
            ))}
          </Select>
        </div>
        <div className="abs-time-row">
          <div className="form-group">
            <label htmlFor={`${formId}-start`}>Jam mulai</label>
            <TimeInput
              id={`${formId}-start`}
              value={start}
              onChange={(next) => {
                setStart(next);
                setError('');
              }}
            />
          </div>
          <div className="form-group">
            <label htmlFor={`${formId}-end`}>Jam selesai</label>
            <TimeInput
              id={`${formId}-end`}
              value={end}
              onChange={(next) => {
                setEnd(next);
                setError('');
              }}
            />
          </div>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
