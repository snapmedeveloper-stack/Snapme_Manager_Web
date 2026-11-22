import { Fragment } from 'react';
import ActivityRow from './ActivityRow';
import { dayKeyOf, dayLabelOf } from './logModel';

/**
 * Daftar baris aktivitas dengan kepala per hari (menempel saat di-scroll) dan pemisah per jam, supaya terbaca seperti
 * buku catatan. order 'desc' (terbaru dulu) atau 'asc' (linimasa).
 */
export default function ActivityList({ rows, onOpen, grouped = true }) {
  if (!grouped) {
    return (
      <ul className="log-list">
        {rows.map((r) => (
          <ActivityRow key={r.doc.id} row={r} onOpen={onOpen} showDate />
        ))}
      </ul>
    );
  }
  const days = [];
  for (const r of rows) {
    const key = dayKeyOf(r.at);
    let day = days[days.length - 1];
    if (!day || day.key !== key) {
      day = { key, label: dayLabelOf(r.at), hours: [] };
      days.push(day);
    }
    const hour = new Date(r.at).getHours();
    let block = day.hours[day.hours.length - 1];
    if (!block || block.hour !== hour) {
      block = { hour, rows: [] };
      day.hours.push(block);
    }
    block.rows.push(r);
  }

  return (
    <div className="log-days">
      {days.map((day) => (
        <section key={day.key} className="log-day" aria-label={day.label}>
          <h3 className="log-day-head">
            <span>{day.label}</span>
            <span className="num">{day.hours.reduce((n, h) => n + h.rows.length, 0)} catatan</span>
          </h3>
          {day.hours.map((block) => (
            <Fragment key={block.hour}>
              <div className="log-hour num" aria-hidden="true">
                {String(block.hour).padStart(2, '0')}:00
              </div>
              <ul className="log-list">
                {block.rows.map((r) => (
                  <ActivityRow key={r.doc.id} row={r} onOpen={onOpen} />
                ))}
              </ul>
            </Fragment>
          ))}
        </section>
      ))}
    </div>
  );
}
