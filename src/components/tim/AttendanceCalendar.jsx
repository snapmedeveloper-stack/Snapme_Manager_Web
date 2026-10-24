// Salinan Snapme_Desktop/src/components/absensi/AttendanceCalendar.jsx: ubah keduanya bersamaan.
import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui';
import {
  activeRecords,
  addDays,
  addMonths,
  datesBetween,
  DAY_KEYS,
  DAY_SHORT,
  dayRows,
  daySummary,
  formatDay,
  formatMonth,
  monthRange,
  weekStartOf,
} from '../../utils/attendance';

/** Tanda warna sel: ada yang tidak hadir > ada yang terlambat > semua hadir. */
function dotTone(summary) {
  if (summary.absent) return 'danger';
  if (summary.late) return 'warning';
  return summary.present ? 'success' : null;
}

/**
 * Kalender kerja satu bulan (minggu mulai Senin). Tiap tanggal menampilkan jumlah hadir / terjadwal; tanggal yang
 * belum lewat menampilkan jumlah terjadwal saja. Klik tanggal → onSelectDate(tanggal); selectedDate (opsional) ditandai.
 */
export default function AttendanceCalendar({
  month,
  onMonthChange,
  today,
  versions,
  records,
  toleranceMin,
  selectedDate,
  onSelectDate,
}) {
  const { from, to } = monthRange(month);

  const cells = useMemo(() => {
    const byDate = new Map();
    activeRecords(records).forEach((r) => byDate.set(r.date, [...(byDate.get(r.date) || []), r]));
    return datesBetween(weekStartOf(from), addDays(weekStartOf(to), 6)).map((date) => {
      const inMonth = date >= from && date <= to;
      const rows = inMonth
        ? dayRows({
            versions,
            records: byDate.get(date) || [],
            dateStr: date,
            today,
            toleranceMin,
          })
        : [];
      return { date, inMonth, summary: daySummary(rows) };
    });
  }, [from, to, versions, records, today, toleranceMin]);

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

      <div className="abs-cal-grid" role="grid" aria-label={`Kalender kerja ${formatMonth(month)}`}>
        {DAY_KEYS.map((key) => (
          <span key={key} className="abs-cal-weekday" role="columnheader">
            {DAY_SHORT[key]}
          </span>
        ))}
        {cells.map(({ date, inMonth, summary }) => {
          if (!inMonth) return <span key={date} className="abs-cal-cell is-out" aria-hidden="true" />;
          const isFuture = date > today;
          const tone = isFuture ? null : dotTone(summary);
          const hasData = summary.scheduled || summary.present;
          const label = isFuture
            ? `${formatDay(date)}: ${summary.scheduled} terjadwal`
            : `${formatDay(date)}: ${summary.present} hadir dari ${summary.scheduled} terjadwal`;
          return (
            <button
              key={date}
              type="button"
              role="gridcell"
              className={`abs-cal-cell${date === today ? ' is-today' : ''}${date === selectedDate ? ' is-selected' : ''}`}
              aria-label={label}
              aria-selected={date === selectedDate}
              onClick={() => onSelectDate(date)}
            >
              <span className="abs-cal-date num">{Number(date.slice(8))}</span>
              {hasData ? (
                <span className={`abs-cal-count num${isFuture ? ' is-future' : ''}`}>
                  {isFuture ? summary.scheduled : `${summary.present}/${summary.scheduled}`}
                </span>
              ) : null}
              {tone && <span className={`dot dot-${tone}`} aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      <div className="abs-cal-legend">
        <span>
          <span className="dot dot-success" aria-hidden="true" /> Semua hadir
        </span>
        <span>
          <span className="dot dot-warning" aria-hidden="true" /> Ada terlambat
        </span>
        <span>
          <span className="dot dot-danger" aria-hidden="true" /> Ada tidak hadir
        </span>
        <span className="abs-cal-legend-text">Angka = hadir / terjadwal</span>
      </div>
    </div>
  );
}
