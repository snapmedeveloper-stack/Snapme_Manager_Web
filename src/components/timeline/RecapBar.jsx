import { Tabs } from '../ui';
import { RECAP_TABS } from '../../utils/timeline';

/** Filter Semua/Studio/Photobooth + ringkasan booking (berjalan/selesai/menunggu hanya untuk hari ini). */
export default function RecapBar({ tab, onTabChange, summary, isToday }) {
  return (
    <div className="tl-recap">
      <Tabs
        options={RECAP_TABS.map((value) => ({ value, label: value }))}
        value={tab}
        onChange={onTabChange}
        ariaLabel="Jenis ruangan"
      />
      <div className="tl-recap-stats">
        {summary.total === 0 ? (
          <span>Jadwal kosong</span>
        ) : (
          <>
            <strong className="num">{summary.total} booking</strong>
            {summary.running > 0 && (
              <span className="tl-stat">
                <span className="dot dot-accent" /> {summary.running} berjalan
              </span>
            )}
            {summary.done > 0 && (
              <span className="tl-stat">
                <span className="dot dot-success" /> {summary.done} selesai
              </span>
            )}
            {summary.waiting > 0 && (
              <span className="tl-stat">
                <span className="dot" /> {summary.waiting} {isToday ? 'menunggu' : 'terjadwal'}
              </span>
            )}
            <span className="tl-stat num">
              {summary.hours > 0 ? `${summary.hours}j ` : ''}
              {summary.minutes}m total
            </span>
          </>
        )}
      </div>
    </div>
  );
}
