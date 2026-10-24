// Salinan Snapme_Desktop/src/components/absensi/DayDetail.jsx: ubah keduanya bersamaan.
import { Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { Badge, Button, EmptyState } from '../ui';
import { activeRecords, dayRows, formatDuration, STATUS_INFO } from '../../utils/attendance';

/** Nama staff dari daftar, atau nama yang tersalin di catatan bila staff-nya sudah tidak ada. */
const nameOf = (staffById, staffId, records) =>
  staffById.get(staffId)?.name || records.find((r) => r.staffName)?.staffName || 'Staff tidak dikenal';

/**
 * Rincian satu tanggal: siapa yang terjadwal, siapa yang mencatat kerja, dan statusnya.
 * editable: boleh mengubah/menghapus catatan di tanggal ini. onRestore diisi hanya untuk owner (Snapme Manager):
 * catatan yang dihapus ikut tampil supaya bisa dipulihkan.
 */
export default function DayDetail({
  date,
  today,
  versions,
  records,
  staff,
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
    today,
    toleranceMin,
  });
  const deleted = onRestore ? ofDate.filter((r) => r.deletedAt) : [];

  return (
    <div className="abs-day">
      {!editable && readOnlyNote && <p className="form-hint abs-day-note">{readOnlyNote}</p>}
      {rows.length === 0 ? (
        <EmptyState
          title="Tidak ada jadwal"
          description="Belum ada yang terjadwal atau mencatat kerja di tanggal ini."
        />
      ) : (
        <ul className="abs-day-list">
          {rows.map((row) => {
            const info = STATUS_INFO[row.status];
            return (
              <li key={row.staffId} className="abs-day-row">
                <div className="abs-day-main">
                  <span className="abs-day-name">{nameOf(staffById, row.staffId, row.records)}</span>
                  <span className="abs-day-meta num">
                    {row.shift ? `Jadwal ${row.shift.start}–${row.shift.end}` : 'Tanpa jadwal'}
                    {row.minutes > 0 && ` · ${formatDuration(row.minutes)}`}
                  </span>
                  {row.records.map((r) => (
                    <div key={r.id} className="abs-day-record">
                      <span className="num">
                        {r.start}–{r.end}
                      </span>
                      {r.createdOn?.machineName && <span className="abs-day-trail">{r.createdOn.machineName}</span>}
                      {editable && (
                        <span className="abs-day-actions">
                          <Button
                            variant="ghost"
                            size="sm"
                            iconOnly
                            icon={Pencil}
                            aria-label={`Ubah catatan ${r.start}–${r.end}`}
                            onClick={() => onEdit(r)}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            iconOnly
                            icon={Trash2}
                            aria-label={`Hapus catatan ${r.start}–${r.end}`}
                            onClick={() => onDelete(r)}
                          />
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <Badge tone={info.tone}>
                  {info.label}
                  {row.lateMin > 0 && ` ${row.lateMin}m`}
                </Badge>
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
              <span className="num">
                {r.start}–{r.end}
              </span>
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
