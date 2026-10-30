// Salinan Snapme_Desktop/src/components/absensi/DayDetail.jsx: ubah keduanya bersamaan.
import { Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { Badge, Button, EmptyState } from '../ui';
import {
  activeRecords,
  dayRows,
  formatDuration,
  formatElapsed,
  hoursOn,
  recordRange,
  STATUS_INFO,
} from '../../utils/attendance';

/** Keterangan jam buka tanggal itu (dasar penilaian buka terlambat & lembur). */
function hoursNote(hours) {
  if (!hours) return 'Jam buka belum diatur: buka terlambat dan lembur tidak dinilai.';
  if (hours.closed) return 'Hari tutup: tidak ada penilaian buka terlambat dan lembur.';
  return `Jam buka ${hours.open}–${hours.close}.`;
}

/** Nama staff dari daftar, atau nama yang tersalin di catatan bila staff-nya sudah tidak ada. */
const nameOf = (staffById, staffId, records) =>
  staffById.get(staffId)?.name || records.find((r) => r.staffName)?.staffName || 'Staff tidak dikenal';

/**
 * Rincian satu tanggal: siapa yang mencatat kerja (dengan buka terlambat & lembur dari jam buka cabang), lalu siapa yang
 * terjadwal tanpa catatan (info saja). editable: boleh mengubah/menghapus catatan di tanggal ini. onRestore diisi hanya
 * untuk owner (Snapme Manager): catatan yang dihapus ikut tampil supaya bisa dipulihkan.
 */
export default function DayDetail({
  date,
  versions,
  records,
  staff,
  openingHours,
  toleranceMin,
  editable,
  readOnlyNote,
  onEdit,
  onDelete,
  onRestore,
}) {
  const staffById = new Map(staff.map((s) => [s.id, s]));
  const ofDate = records.filter((r) => r.date === date);
  const rows = dayRows({
    versions,
    records: activeRecords(ofDate),
    dateStr: date,
    openingHours,
    toleranceMin,
  });
  const deleted = onRestore ? ofDate.filter((r) => r.deletedAt) : [];

  return (
    <div className="abs-day">
      {!editable && readOnlyNote && <p className="form-hint abs-day-note">{readOnlyNote}</p>}
      <p className="form-hint abs-day-note num">{hoursNote(hoursOn(openingHours, date))}</p>
      {rows.length === 0 ? (
        <EmptyState title="Belum ada catatan" description="Belum ada yang mencatat kerja di tanggal ini." />
      ) : (
        <ul className="abs-day-list">
          {rows.map((row) => {
            const info = STATUS_INFO[row.status];
            // Jadwal hanya keterangan siapa yang semestinya jaga, tidak ikut penilaian
            const meta = [
              row.isOpener && 'Membuka studio',
              row.minutes > 0 && formatDuration(row.minutes),
              row.shift && `Jadwal ${row.shift.start}–${row.shift.end}`,
            ].filter(Boolean);
            return (
              <li key={row.staffId} className="abs-day-row">
                <div className="abs-day-main">
                  <span className="abs-day-name">{nameOf(staffById, row.staffId, row.records)}</span>
                  {meta.length > 0 && <span className="abs-day-meta num">{meta.join(' · ')}</span>}
                  {row.records.map((r) => (
                    <div key={r.id} className="abs-day-record">
                      <span className="num">{recordRange(r)}</span>
                      {r.createdOn?.machineName && <span className="abs-day-trail">{r.createdOn.machineName}</span>}
                      {editable && (
                        <span className="abs-day-actions">
                          <Button
                            variant="ghost"
                            size="sm"
                            iconOnly
                            icon={Pencil}
                            aria-label={`Ubah catatan ${recordRange(r)}`}
                            onClick={() => onEdit(r)}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            iconOnly
                            icon={Trash2}
                            aria-label={`Hapus catatan ${recordRange(r)}`}
                            onClick={() => onDelete(r)}
                          />
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <span className="abs-day-badges">
                  <Badge tone={info.tone}>{info.label}</Badge>
                  {row.lateOpenMin > 0 && <Badge tone="warning">Buka terlambat {formatElapsed(row.lateOpenMin)}</Badge>}
                  {row.overtimeMin > 0 && <Badge tone="accent">Lembur {formatElapsed(row.overtimeMin)}</Badge>}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {deleted.length > 0 && (
        <div className="abs-day-deleted">
          <span className="form-label">Catatan dihapus</span>
          {deleted.map((r) => (
            <div key={r.id} className="abs-day-record is-deleted">
              <span>{nameOf(staffById, r.staffId, [r])}</span>
              <span className="num">{recordRange(r)}</span>
              {r.updatedOn?.machineName && <span className="abs-day-trail">dihapus di {r.updatedOn.machineName}</span>}
              <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => onRestore(r)}>
                Pulihkan
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
