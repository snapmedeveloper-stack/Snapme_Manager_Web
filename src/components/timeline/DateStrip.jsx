import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { getLocalDateString } from '../../utils/format';

const DAYS_AROUND = 3; // 3 hari sebelum & sesudah tanggal terpilih

/** "YYYY-MM-DD" → Date lokal (tanpa geser zona waktu seperti new Date("YYYY-MM-DD")). */
const parseLocalDate = (value) => {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const shiftDate = (value, days) => {
  const date = parseLocalDate(value);
  date.setDate(date.getDate() + days);
  return getLocalDateString(date);
};

/**
 * Pilih tanggal: bulan + kalender bawaan HP (input date transparan di atas tombol, supaya jalan juga di Safari),
 * lalu deretan 7 hari di sekitar tanggal terpilih dengan panah geser satu hari.
 */
export default function DateStrip({ value, today, onChange }) {
  const selected = parseLocalDate(value);
  const days = Array.from({ length: DAYS_AROUND * 2 + 1 }, (_, i) => shiftDate(value, i - DAYS_AROUND));

  return (
    <div className="tl-dates">
      <div className="tl-dates-head">
        <span className="tl-dates-month">
          {selected.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </span>
        <label className="btn btn-ghost btn-sm tl-date-picker">
          <CalendarDays size={14} aria-hidden="true" />
          Pilih tanggal
          <input
            type="date"
            value={value}
            onChange={(e) => e.target.value && onChange(e.target.value)}
            // Browser desktop: klik di input date hanya memfokuskan isian, jadi kalender dibuka manual
            onClick={(e) => {
              try {
                e.currentTarget.showPicker?.();
              } catch {
                // Browser lama tanpa showPicker: kalender bawaan input tetap bisa dipakai
              }
            }}
            aria-label="Pilih tanggal"
          />
        </label>
      </div>

      <div className="tl-dates-row">
        <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => onChange(shiftDate(value, -1))} aria-label="Hari sebelumnya">
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        {days.map((day) => {
          const date = parseLocalDate(day);
          return (
            <button
              key={day}
              type="button"
              className={`tl-day${day === value ? ' is-selected' : ''}${day === today ? ' is-today' : ''}`}
              aria-pressed={day === value}
              aria-label={date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
              onClick={() => onChange(day)}
            >
              <span className="tl-day-name">{date.toLocaleDateString('id-ID', { weekday: 'short' })}</span>
              <span className="tl-day-num num">{date.getDate()}</span>
            </button>
          );
        })}
        <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => onChange(shiftDate(value, 1))} aria-label="Hari berikutnya">
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
