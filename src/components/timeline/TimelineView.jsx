import { useEffect, useRef, useState } from 'react';
import { Check, PackagePlus, UserCheck, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '../ui';
import {
  HOURS,
  START_HOUR,
  TOTAL_HOURS,
  clockAt,
  formatTimeRange,
  isInTimeWindow,
  isPastEnd,
  packageColor,
  timelineMin,
} from '../../utils/timeline';
import { useTimelineDrag } from './useTimelineDrag';

const ZOOM_DEFAULT = 160; // piksel per jam
const ZOOM_STEP = 1.4;
const clampZoom = (zoom) => Math.max(60, Math.min(zoom, 600));
const ADD_SNAP_MINUTES = 5;

const nowMinute = () => {
  const now = new Date();
  return (now.getHours() - START_HOUR) * 60 + now.getMinutes();
};

/**
 * Timeline horizontal satu hari (opsi selain agenda): baris per ruangan, sumbu jam 04:00–24:00.
 * Label ruangan & penggaris jam menempel saat di-scroll. Ketuk area kosong = onAddAt(placeId, menit);
 * blok: ketuk = detail, tahan & geser = pindah, handle kanan = durasi (useTimelineDrag). canEdit false = hanya lihat.
 */
export default function TimelineView({ bookings, places, packages, isToday, canEdit, onOpen, onAddAt, onDrop }) {
  const [zoom, setZoom] = useState(ZOOM_DEFAULT);
  const [nowMin, setNowMin] = useState(nowMinute);
  const scrollRef = useRef(null);
  const ppm = zoom / 60;
  const trackWidth = TOTAL_HOURS * zoom;
  const { drag, onBlockMouseDown, onBlockTouchStart, onResizeStart } = useTimelineDrag({
    canEdit,
    bookings,
    pixelsPerMinute: ppm,
    onOpen,
    onDrop,
  });

  useEffect(() => {
    const timer = setInterval(() => setNowMin(nowMinute()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Hari ini: mulai dari sekitar jam sekarang (sekali saat tampilan dibuka / tanggal berganti ke hari ini)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !isToday) return;
    el.scrollLeft = Math.max(0, nowMinute() * (ZOOM_DEFAULT / 60) - el.clientWidth / 3);
  }, [isToday]);

  // Zoom dengan menjaga jam di tengah layar tetap di tengah
  const changeZoom = (factor) => {
    const el = scrollRef.current;
    const next = clampZoom(zoom * factor);
    if (el) {
      const labelWidth = el.querySelector('.tlh-label')?.offsetWidth || 0;
      const centerMin = (el.scrollLeft + (el.clientWidth - labelWidth) / 2) / ppm;
      requestAnimationFrame(() => {
        el.scrollLeft = centerMin * (next / 60) - (el.clientWidth - labelWidth) / 2;
      });
    }
    setZoom(next);
  };

  const handleTrackClick = (e, placeId) => {
    if (!onAddAt || drag || e.target !== e.currentTarget) return;
    const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
    const min = Math.floor(x / ppm / ADD_SNAP_MINUTES) * ADD_SNAP_MINUTES;
    onAddAt(placeId, clockAt(min));
  };

  // Posisi blok selama digeser: blok yang digeser di posisi barunya, yang terdorong ikut bergeser
  const blocksIn = (placeId) => {
    const list = [];
    bookings.forEach((b) => {
      const isDragged = drag?.id === b.id;
      const studio = isDragged ? drag.targetStudio : b.studio;
      if (studio !== placeId) return;
      const min = isDragged ? drag.currentMin : timelineMin(b) + (drag?.pushes[b.id] || 0);
      const duration = isDragged ? drag.currentDuration : b.duration;
      list.push({ booking: b, min, duration, isDragged });
    });
    return list;
  };

  return (
    <div className="tlh-wrap">
      <div className="tlh" ref={scrollRef}>
        <div className="tlh-grid" style={{ '--track-w': `${trackWidth}px`, '--hour-w': `${zoom}px` }}>
          <div className="tlh-row tlh-head">
            <div className="tlh-label tlh-corner">Ruangan</div>
            <div className="tlh-ruler">
              {HOURS.map((h) => (
                <span key={h} className="tlh-hour num" style={{ left: (h - START_HOUR) * zoom }}>
                  {String(h).padStart(2, '0')}:00
                </span>
              ))}
            </div>
          </div>

          {places.map((place, i) => (
            <div key={place.id} className={`tlh-row${place.kind !== places[i - 1]?.kind && i > 0 ? ' is-section' : ''}`}>
              <div className="tlh-label">
                <span className="tlh-label-name">{place.name}</span>
                <span className="tlh-label-kind">{place.kind}</span>
              </div>
              <div
                className={`tlh-track${drag?.targetStudio === place.id ? ' is-drop-target' : ''}`}
                data-place={place.id}
                onClick={(e) => handleTrackClick(e, place.id)}
              >
                {blocksIn(place.id).map(({ booking, min, duration, isDragged }) => {
                  const hasArrived = !!booking.arrivedAt;
                  // Sama dengan BookingBlock Desktop: merah bila sudah datang dan waktunya sudah lewat (sesi kelewatan)
                  const isOvertime = hasArrived && isToday && isInTimeWindow(booking) && isPastEnd(booking);
                  const hasAddOns = Object.values(booking.addOns || {}).some((ao) => ao.qty > 0);
                  return (
                  <div
                    key={booking.id}
                    className={`tlh-block${isDragged ? ' is-dragging' : ''}${hasArrived ? ' is-arrived' : ''}${isOvertime ? ' is-overtime' : ''}`}
                    style={{
                      left: min * ppm,
                      width: Math.max(duration * ppm, 24),
                      '--item-color': packageColor(packages, booking.package),
                    }}
                    onMouseDown={(e) => onBlockMouseDown(e, booking)}
                    onTouchStart={(e) => onBlockTouchStart(e, booking)}
                  >
                    <span className="tlh-block-body">
                      <span className="tlh-block-name">
                        <span className="tlh-block-name-text">{booking.customerName || '-'}</span>
                        {hasAddOns && <PackagePlus size={12} aria-label="Ada item tambahan" />}
                      </span>
                      <span className="tlh-block-meta">{booking.package || '-'}</span>
                      <span className="tlh-block-meta num">{formatTimeRange(booking.startHour, booking.startMin, duration)}</span>
                    </span>
                    {/* Penanda status datang (sama dengan tombol Datang di Desktop). Hanya penanda: menandai datang
                        membuat folder Google Drive lewat aplikasi Desktop, jadi diubah dari PC studio */}
                    <span className={`tlh-arrive${hasArrived ? ' is-arrived' : ''}`}>
                      {hasArrived ? <Check size={12} aria-hidden="true" /> : <UserCheck size={12} aria-hidden="true" />}
                      <span>{hasArrived ? 'Datang' : 'Belum datang'}</span>
                    </span>
                    {canEdit && (
                      <span
                        className="tlh-resize"
                        onMouseDown={(e) => onResizeStart(e, booking)}
                        onTouchStart={(e) => onResizeStart(e, booking)}
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  );
                })}
              </div>
            </div>
          ))}

          {isToday && nowMin >= 0 && nowMin <= TOTAL_HOURS * 60 && (
            <div className="tlh-now" style={{ '--now-x': `${nowMin * ppm}px` }} aria-hidden="true" />
          )}
        </div>
      </div>

      <div className="tlh-zoom">
        <Button size="sm" iconOnly icon={ZoomOut} aria-label="Perkecil" onClick={() => changeZoom(1 / ZOOM_STEP)} />
        <Button size="sm" iconOnly icon={ZoomIn} aria-label="Perbesar" onClick={() => changeZoom(ZOOM_STEP)} />
      </div>
    </div>
  );
}
