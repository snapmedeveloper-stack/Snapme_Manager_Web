// Salinan Snapme_Desktop/src/components/absensi/AttendanceCalendar.jsx: ubah keduanya bersamaan.
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, Select } from '../ui';
import {
  activeRecords,
  addDays,
  addMonths,
  datesBetween,
  DAY_KEYS,
  DAY_SHORT,
  dayRows,
  daySummary,
  firstName,
  formatDay,
  formatDuration,
  formatHoursShort,
  formatMonth,
  hoursOn,
  monthRange,
  nameInitials,
  weekStartOf,
} from '../../utils/attendance';

// Lebih dari ini per tanggal diringkas "+N" supaya tinggi sel tetap wajar; rinciannya ada saat tanggal diketuk
const MAX_PEOPLE = 3;

/** Tanda warna sel: buka terlambat > ada lembur > ada yang bekerja. */
function dotTone(summary) {
  if (summary.lateOpen) return 'warning';
  if (summary.overtime) return 'accent';
  return summary.present ? 'success' : null;
}

/** Jam bulat untuk sel sempit (HP): 450 → "8j", 20 → "<1j". */
const roundHours = (minutes) => (minutes < 30 ? '<1j' : `${Math.round(minutes / 60)}j`);

/** "Ani 8j" untuk keterangan sel; jaga yang belum selesai ditandai. */
const personText = (p) =>
  [p.name, p.minutes > 0 && formatHoursShort(p.minutes), p.onDuty && '(sedang jaga)'].filter(Boolean).join(' ');

/**
 * Kalender kerja satu bulan (minggu mulai Senin). Tiap tanggal menampilkan siapa yang bekerja beserta jamnya (sel sempit:
 * inisial + jam bulat; sel lebar: nama depan + jam per setengah jam), titik biru untuk yang sedang jaga, dan tanda buka
 * terlambat / lembur (dari jam buka cabang); hari tutup ditandai. Pilihan staff di atas menyorot satu staff: hanya
 * jamnya yang tampil, plus total hari & jam sebulan. Klik tanggal → onSelectDate(tanggal); selectedDate (opsional)
 * ditandai. staff: daftar staff cabang (nama terbaru); catatan dari staff yang sudah dihapus memakai staffName-nya.
 */
export default function AttendanceCalendar({
  month,
  onMonthChange,
  today,
  staff = [],
  records,
  openingHours,
  toleranceMin,
  selectedDate,
  onSelectDate,
}) {
  const [focusId, setFocusId] = useState('');
  const { from, to } = monthRange(month);

  const cells = useMemo(() => {
    const nameOf = new Map(staff.map((s) => [s.id, s.name]));
    const byDate = new Map();
    activeRecords(records).forEach((r) => byDate.set(r.date, [...(byDate.get(r.date) || []), r]));
    return datesBetween(weekStartOf(from), addDays(weekStartOf(to), 6)).map((date) => {
      const inMonth = date >= from && date <= to;
      const rows = inMonth
        ? dayRows({
            versions: [],
            records: byDate.get(date) || [],
            dateStr: date,
            openingHours,
            toleranceMin,
          })
        : [];
      const people = rows
        .filter((row) => row.records.length)
        .map((row) => ({
          staffId: row.staffId,
          name: nameOf.get(row.staffId) || row.records[0].staffName || 'Staff',
          minutes: row.minutes,
          onDuty: row.status === 'jaga',
        }))
        // Yang sedang jaga selalu di atas supaya tidak tertutup "+N"; sisanya tetap urut jam mulai
        .sort((a, b) => Number(b.onDuty) - Number(a.onDuty));
      return { date, inMonth, closed: !!hoursOn(openingHours, date)?.closed, summary: daySummary(rows), people };
    });
  }, [from, to, staff, records, openingHours, toleranceMin]);

  // Pilihan staff: yang aktif, ditambah yang tercatat bekerja bulan ini walau sudah nonaktif/dihapus
  const focusOptions = useMemo(() => {
    const options = new Map(staff.filter((s) => s.active !== false).map((s) => [s.id, s.name]));
    cells.forEach(
      (c) => c.inMonth && c.people.forEach((p) => options.has(p.staffId) || options.set(p.staffId, p.name)),
    );
    return [...options].map(([id, name]) => ({ id, name }));
  }, [staff, cells]);
  // Staff pilihan yang tidak ada lagi di bulan ini dianggap "semua staff"
  const focus = focusOptions.some((o) => o.id === focusId) ? focusId : '';
  const focusTotal = focus
    ? cells.reduce(
        (acc, c) => {
          const p = c.inMonth && c.people.find((x) => x.staffId === focus);
          return p ? { days: acc.days + 1, minutes: acc.minutes + p.minutes } : acc;
        },
        { days: 0, minutes: 0 },
      )
    : null;

  return (
    <div className="abs-cal">
      <div className="abs-cal-nav">
        <Button
          variant="ghost"
          iconOnly
          icon={ChevronLeft}
          aria-label="Bulan sebelumnya"
          onClick={() => onMonthChange(addMonths(month, -1))}
        />
        <span className="abs-cal-month">{formatMonth(month)}</span>
        <Button
          variant="ghost"
          iconOnly
          icon={ChevronRight}
          aria-label="Bulan berikutnya"
          onClick={() => onMonthChange(addMonths(month, 1))}
        />
      </div>

      {focusOptions.length > 0 && (
        <div className="abs-cal-focus">
          <Select value={focus} onChange={setFocusId} aria-label="Sorot staff">
            <option value="">Semua staff</option>
            {focusOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
          {focusTotal && (
            <span className="abs-cal-focus-total num">
              {focusTotal.days} hari · {formatDuration(focusTotal.minutes)}
            </span>
          )}
        </div>
      )}

      <div className="abs-cal-grid" role="grid" aria-label={`Kalender kerja ${formatMonth(month)}`}>
        {DAY_KEYS.map((key) => (
          <span key={key} className="abs-cal-weekday" role="columnheader">
            {DAY_SHORT[key]}
          </span>
        ))}
        {cells.map(({ date, inMonth, closed, summary, people }) => {
          if (!inMonth) return <span key={date} className="abs-cal-cell is-out" aria-hidden="true" />;
          const tone = dotTone(summary);
          const shown = focus ? people.filter((p) => p.staffId === focus) : people;
          const notes = [
            closed && 'tutup',
            people.length ? people.map(personText).join(', ') : 'belum ada yang bekerja',
            summary.lateOpen && 'buka terlambat',
            summary.overtime && 'ada lembur',
          ].filter(Boolean);
          const label = `${formatDay(date)}: ${notes.join(' · ')}`;
          return (
            <button
              key={date}
              type="button"
              role="gridcell"
              className={`abs-cal-cell${date === today ? ' is-today' : ''}${date === selectedDate ? ' is-selected' : ''}${focus && !shown.length ? ' is-dim' : ''}`}
              aria-label={label}
              title={label}
              aria-selected={date === selectedDate}
              onClick={() => onSelectDate(date)}
            >
              <span className="abs-cal-date num">{Number(date.slice(8))}</span>
              {tone && <span className={`dot dot-${tone}`} aria-hidden="true" />}
              {shown.length > 0 ? (
                <span className="abs-cal-people" aria-hidden="true">
                  {shown.slice(0, MAX_PEOPLE).map((p) => (
                    <span key={p.staffId} className={`abs-cal-person${p.onDuty ? ' is-on' : ''}`}>
                      <span className="abs-cal-person-short">{nameInitials(p.name)}</span>
                      <span className="abs-cal-person-long">{firstName(p.name)}</span>
                      {p.minutes > 0 && (
                        <>
                          <span className="abs-cal-person-short abs-cal-person-hours num">{roundHours(p.minutes)}</span>
                          <span className="abs-cal-person-long abs-cal-person-hours num">
                            {formatHoursShort(p.minutes)}
                          </span>
                        </>
                      )}
                    </span>
                  ))}
                  {shown.length > MAX_PEOPLE && <span className="abs-cal-more num">+{shown.length - MAX_PEOPLE}</span>}
                </span>
              ) : (
                closed && <span className="abs-cal-count is-future">Tutup</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="abs-cal-legend">
        <span>
          <span className="dot dot-success" aria-hidden="true" /> Normal
        </span>
        <span>
          <span className="dot dot-warning" aria-hidden="true" /> Buka terlambat
        </span>
        <span>
          <span className="dot dot-accent" aria-hidden="true" /> Ada lembur
        </span>
        <span className="abs-cal-legend-text">Nama biru = sedang jaga · ketuk tanggal untuk rincian</span>
      </div>
    </div>
  );
}
