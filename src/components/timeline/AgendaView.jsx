import { Check, Plus } from 'lucide-react';
import { Badge, Button } from '../ui';
import { STATUS_TONE } from '../../constants/status';
import { formatTimeRange, packageColor, scheduleState } from '../../utils/timeline';

const STATE_LABEL = { active: 'Berjalan', done: 'Lewat' };
const byStart = (a, b) => a.startHour * 60 + (a.startMin || 0) - (b.startHour * 60 + (b.startMin || 0));

function BookingCard({ booking, packages, isToday, onOpen }) {
  const state = scheduleState(booking, isToday);
  return (
    <button
      type="button"
      className={`tl-card is-${state}`}
      style={{ '--item-color': packageColor(packages, booking.package) }}
      onClick={() => onOpen(booking)}
    >
      <span className="tl-card-time num">{formatTimeRange(booking.startHour, booking.startMin, booking.duration)}</span>
      <span className="tl-card-name">{booking.customerName || '-'}</span>
      <span className="tl-card-meta">
        {booking.package || 'Tanpa paket'} · {booking.duration} menit
      </span>
      {(STATE_LABEL[state] || booking.arrivedAt) && (
        <span className="tl-card-badges">
          {STATE_LABEL[state] && <Badge tone={STATUS_TONE[state]}>{STATE_LABEL[state]}</Badge>}
          {booking.arrivedAt && (
            <Badge tone={STATUS_TONE.active} icon={Check}>
              Datang
            </Badge>
          )}
        </span>
      )}
    </button>
  );
}

/**
 * Agenda satu hari: booking dikelompokkan per ruangan (studio, lalu photobooth), urut jam mulai.
 * Booking di ruangan yang tidak terdaftar (mis. sudah diarsipkan) tetap tampil di kelompok "Ruangan lain".
 * onAdd(placeId) kosong = tidak boleh menambah (owner).
 */
export default function AgendaView({ bookings, places, packages, isToday, onOpen, onAdd }) {
  const knownIds = new Set(places.map((p) => p.id));
  const orphans = bookings.filter((b) => !knownIds.has(b.studio));
  const groups = [
    ...places.map((place) => ({ ...place, items: bookings.filter((b) => b.studio === place.id) })),
    ...(orphans.length ? [{ id: '__lain', name: 'Ruangan lain', kind: 'Lainnya', items: orphans, orphan: true }] : []),
  ];

  return (
    <div className="tl-agenda">
      {groups.map((group, i) => (
        <section key={group.id} className="tl-group">
          {group.kind !== groups[i - 1]?.kind && <h2 className="tl-group-kind">{group.kind}</h2>}
          <div className="tl-group-head">
            <span className="tl-group-name">{group.name}</span>
            <span className="tl-group-count num">{group.items.length || ''}</span>
            {onAdd && !group.orphan && (
              <Button size="sm" variant="ghost" icon={Plus} onClick={() => onAdd(group.id)} aria-label={`Tambah booking di ${group.name}`}>
                Tambah
              </Button>
            )}
          </div>
          {group.items.length > 0 ? (
            <div className="tl-group-list">
              {[...group.items].sort(byStart).map((b) => (
                <BookingCard key={b.id} booking={b} packages={packages} isToday={isToday} onOpen={onOpen} />
              ))}
            </div>
          ) : (
            <p className="tl-group-empty">Belum ada booking</p>
          )}
        </section>
      ))}
    </div>
  );
}
