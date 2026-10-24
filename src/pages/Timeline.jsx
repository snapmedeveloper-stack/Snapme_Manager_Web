import { useEffect, useMemo, useState } from 'react';
import { CalendarCheck, ChartGantt, List, Plus } from 'lucide-react';
import { Button, Spinner, useConfirm, useToast } from '../components/ui';
import AppBar from '../components/layout/AppBar';
import AgendaView from '../components/timeline/AgendaView';
import TimelineView from '../components/timeline/TimelineView';
import DateStrip from '../components/timeline/DateStrip';
import RecapBar from '../components/timeline/RecapBar';
import AddBookingSheet from '../components/timeline/AddBookingSheet';
import BookingDetailSheet from '../components/timeline/BookingDetailSheet';
import PackageAdjustSheet from '../components/timeline/PackageAdjustSheet';
import { isPhotoboothId } from '../components/timeline/bookingForm';
import { useTimelineData } from '../components/timeline/useTimelineData';
import { getLocalDateString } from '../utils/format';
import { normalizePhoneNumber } from '../utils/phone';
import {
  START_HOUR,
  applyDrop,
  canAddAt,
  clockAt,
  editBookingError,
  editedFields,
  filterByTab,
  isOfferedAt,
  newBookingError,
  parseTimeInput,
  placeBlock,
  placeName,
  recapSummary,
  shiftBookings,
  timelineMin,
  writeBookingChanges,
} from '../utils/timeline';
import './Timeline.css';

const VIEW_KEY = 'snapme.timeline.view';
// Default tampilan timeline (keputusan pemilik 2026-10-24); agenda hanya bila dipilih di perangkat ini
const readView = () => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'agenda' ? 'agenda' : 'timeline';
  } catch {
    return 'timeline';
  }
};
const GONE_MESSAGE = 'Booking ini sudah dihapus atau dipindah tanggal di komputer lain.';

/** Jam awal form tambah: hari ini = 5 menit ke depan (dibulatkan), tanggal lain = 10:00. */
function defaultStart(isToday) {
  const now = new Date();
  const min = Math.ceil((now.getHours() * 60 + now.getMinutes()) / 5) * 5;
  if (!isToday || now.getHours() < START_HOUR || min >= 24 * 60) return { startHour: 10, startMin: 0 };
  return { startHour: Math.floor(min / 60), startMin: min % 60 };
}

/**
 * Timeline: jadwal booking satu hari. Default tampilan timeline (jalur jam per ruangan); agenda (daftar kartu per
 * ruangan) sebagai opsi (pilihan diingat di perangkat). Aturan jadwal & penyimpanan sama dengan Snapme_Desktop (utils/timeline):
 * bentrok dicek, booking sesudahnya didorong, dan hanya field yang berubah yang ditulis.
 * Sejak rombak tanpa role (Manager hanya untuk owner), owner mengelola jadwal cabang yang sedang dipilih; booking baru
 * disimpan atas nama cabang itu (managerId), jadi owner yang melihat "semua cabang" harus memilih cabang dulu.
 */
export default function Timeline({ orgId, userMeta, managerId, managerIds }) {
  const toast = useToast();
  const confirm = useConfirm();
  const canEdit = userMeta?.role === 'owner' && !!managerId;
  const [today, setToday] = useState(() => getLocalDateString(new Date()));
  const [selectedDate, setSelectedDate] = useState(today);
  const [view, setView] = useState(readView);
  const [tab, setTab] = useState('Semua');
  const [adding, setAdding] = useState(null); // { placeId, startHour, startMin }
  const [detail, setDetail] = useState(null); // booking saat sheet detail dibuka
  const [pendingMove, setPendingMove] = useState(null); // { drag, booking } menunggu paket pengganti
  const [, setTick] = useState(0);
  const isToday = selectedDate === today;

  const { bookings, studios, photobooths, packages, addOns, isLoaded } = useTimelineData({
    orgId,
    managerIds,
    selectedDate,
  });

  // Status berjalan/lewat dihitung ulang tiap menit; tanggal "hari ini" ikut berganti lewat tengah malam
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
      setToday(getLocalDateString(new Date()));
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const places = useMemo(
    () =>
      [
        ...(tab !== 'Photobooth' ? studios.map((s) => ({ ...s, kind: 'Studio' })) : []),
        ...(tab !== 'Studio' ? photobooths.map((p) => ({ ...p, kind: 'Photobooth' })) : []),
      ],
    [studios, photobooths, tab],
  );
  const shown = filterByTab(bookings, tab, studios, photobooths);
  const live = detail && bookings.find((b) => b.id === detail.id);

  // Booking yang sedang dibuka hilang (dihapus/pindah tanggal di komputer lain): sheet tertutup sendiri karena hanya
  // dirender selama booking-nya ada (detail && live); di sini cukup diberi tahu
  const isGone = !!detail && isLoaded && !live;
  useEffect(() => {
    if (isGone) toast.error(GONE_MESSAGE);
  }, [isGone, toast]);

  const changeView = (next) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Penyimpanan diblokir (mode privat): pilihan hanya berlaku sampai halaman ditutup
    }
  };

  /** Tulis daftar booking baru (hanya yang berubah). Mengembalikan true bila tersimpan. */
  const save = async (next, successMessage) => {
    try {
      const count = await writeBookingChanges(orgId, bookings, next);
      if (count && successMessage) toast.success(successMessage);
      return true;
    } catch (err) {
      console.error('[Timeline] Gagal menyimpan', err);
      toast.error('Perubahan gagal disimpan', 'Data mungkin sudah berubah di komputer lain. Jadwal ditampilkan ulang.');
      return false;
    }
  };

  // ---------- Tambah ----------
  const openAdd = (placeId, start = defaultStart(isToday)) => {
    if (!isLoaded) return;
    setAdding({ placeId: placeId || places[0]?.id || '', ...start });
  };

  const openAddAt = (placeId, start) => {
    if (canAddAt(bookings, placeId, timelineMin(start))) openAdd(placeId, start);
    else toast.info('Jam ini tidak bisa diisi', 'Sudah terisi booking lain, atau celah kosongnya kurang dari 20 menit.');
  };

  const addBooking = async (form) => {
    if (!form.placeId) return 'Pilih ruangan dulu.';
    const start = parseTimeInput(form.time);
    if (!start) return 'Jam mulai harus antara 04:00 dan 23:59.';
    const pkg = packages.find((p) => p.name === form.package);
    const duration = Number(pkg?.duration || 30);
    const min = timelineMin(start);
    const error = newBookingError(form, bookings, { date: selectedDate, placeId: form.placeId, min, duration });
    if (error) return error;
    const customerName = form.customerName.trim();
    const booking = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      studio: form.placeId,
      customerName,
      waNumber: normalizePhoneNumber(form.waNumber),
      package: form.package,
      addOns: form.addOns || {},
      date: selectedDate,
      ...clockAt(min),
      duration,
      managerId,
    };
    if (!(await save([...bookings, booking], `Booking "${customerName}" ditambahkan.`))) return 'Gagal menyimpan.';
    setAdding(null);
    return '';
  };

  // ---------- Detail ----------
  /**
   * Terapkan isian yang diubah ke booking terbaru (bukan salinan saat sheet dibuka), supaya status yang ditulis Desktop
   * selama sheet terbuka tidak tertimpa. Booking sesudahnya didorong bila jam/durasi/ruangan berubah.
   */
  const saveDetail = async (form) => {
    if (!live) return GONE_MESSAGE;
    const edits = editedFields(detail, form);
    if ('customerName' in edits) edits.customerName = (edits.customerName || '').trim();
    if ('waNumber' in edits) edits.waNumber = normalizePhoneNumber(edits.waNumber);
    const error = editBookingError(edits, bookings, live);
    if (error) return error;
    const updated = { ...live, ...edits };
    if ('studio' in edits || 'package' in edits) {
      const pkg = packages.find((p) => p.name === updated.package);
      if (pkg && !isOfferedAt(pkg, updated.studio, isPhotoboothId(photobooths, updated.studio))) {
        return `Paket ${pkg.name} tidak tersedia di ${placeName(updated.studio, studios, photobooths)}. Pilih paket lain.`;
      }
    }
    let pushes = {};
    if (['duration', 'startHour', 'startMin', 'studio'].some((key) => key in edits)) {
      const placed = placeBlock(bookings, {
        id: live.id,
        placeId: updated.studio,
        min: timelineMin(updated),
        duration: updated.duration,
        snap: false,
      });
      if (!placed) return 'Jadwal ini melewati jam 24:00. Kurangi durasi atau pilih jam lain.';
      pushes = placed.pushes;
    }
    const next = shiftBookings(bookings.map((b) => (b.id === live.id ? updated : b)), pushes);
    if (!(await save(next, 'Booking diperbarui.'))) return 'Gagal menyimpan.';
    setDetail(null);
    return '';
  };

  const deleteDetail = async () => {
    const name = live?.customerName;
    const ok = await confirm({
      title: 'Hapus booking?',
      message: `Booking "${name}" akan dihapus dari jadwal semua perangkat.`,
      confirmText: 'Hapus',
      destructive: true,
    });
    if (!ok) return;
    if (await save(bookings.filter((b) => b.id !== detail.id), `Booking "${name}" dihapus.`)) setDetail(null);
  };

  // ---------- Geser (timeline horizontal), sama dengan useTimelineDrag Snapme_Desktop ----------
  const dropBlock = (drag, packageName) => {
    const current = bookings.find((b) => b.id === drag.id);
    if (!current) return;
    const unchanged =
      drag.targetStudio === drag.originalStudio &&
      drag.currentMin === drag.initialMin &&
      drag.currentDuration === drag.initialDuration;
    if (unchanged) return;
    if (!packageName && drag.type === 'move' && drag.targetStudio !== drag.originalStudio) {
      const pkg = packages.find((p) => p.name === current.package);
      if (pkg && !isOfferedAt(pkg, drag.targetStudio, isPhotoboothId(photobooths, drag.targetStudio))) {
        setPendingMove({ drag, booking: current });
        return;
      }
    }
    // Daftar bisa berubah selama digeser (komputer lain): posisi & dorongan dihitung ulang terhadap data terbaru
    const placed = placeBlock(bookings, {
      id: drag.id,
      placeId: drag.targetStudio,
      min: drag.currentMin,
      duration: drag.currentDuration,
      snap: drag.type === 'move',
    });
    if (!placed) {
      toast.warning('Tidak muat', 'Jadwal ini akan melewati jam 24:00.');
      return;
    }
    const next = applyDrop(bookings, { ...drag, currentMin: placed.min, pushes: placed.pushes }).map((b) =>
      packageName && b.id === drag.id ? { ...b, package: packageName } : b,
    );
    save(next, 'Jadwal digeser.');
  };

  const viewProps = { bookings: shown, places, packages, isToday, onOpen: (b) => setDetail(b) };
  const sheetCatalog = { studios, photobooths, packages, addOns };

  return (
    <div className={`tl-page${view === 'timeline' ? ' is-timeline' : ''}`}>
      <AppBar
        title="Timeline"
        actions={
          <>
            {!isToday && (
              <Button variant="ghost" size="sm" icon={CalendarCheck} onClick={() => setSelectedDate(today)}>
                Hari ini
              </Button>
            )}
            <Button
              variant="ghost"
              iconOnly
              icon={view === 'agenda' ? ChartGantt : List}
              aria-label={view === 'agenda' ? 'Tampilan timeline' : 'Tampilan agenda'}
              onClick={() => changeView(view === 'agenda' ? 'timeline' : 'agenda')}
            />
          </>
        }
      />

      <div className="tl-toolbar">
        <DateStrip value={selectedDate} today={today} onChange={setSelectedDate} />
        <RecapBar tab={tab} onTabChange={setTab} summary={recapSummary(shown, isToday)} isToday={isToday} />
      </div>

      {!isLoaded ? (
        <div className="page-loading">
          <Spinner size="lg" />
        </div>
      ) : view === 'agenda' ? (
        <AgendaView {...viewProps} onAdd={canEdit ? (placeId) => openAdd(placeId) : null} />
      ) : (
        <TimelineView {...viewProps} canEdit={canEdit} onAddAt={canEdit ? openAddAt : null} onDrop={dropBlock} />
      )}

      {canEdit && isLoaded && places.length > 0 && (
        <button type="button" className="tl-fab" onClick={() => openAdd()} aria-label="Tambah booking">
          <Plus size={24} aria-hidden="true" />
        </button>
      )}

      {adding && (
        <AddBookingSheet initial={adding} {...sheetCatalog} onSave={addBooking} onClose={() => setAdding(null)} />
      )}
      {detail && live && (
        <BookingDetailSheet
          key={detail.id}
          original={detail}
          live={live}
          readOnly={!canEdit}
          {...sheetCatalog}
          onSave={saveDetail}
          onDelete={deleteDetail}
          onClose={() => setDetail(null)}
        />
      )}
      {pendingMove && (
        <PackageAdjustSheet
          booking={pendingMove.booking}
          targetId={pendingMove.drag.targetStudio}
          targetName={placeName(pendingMove.drag.targetStudio, studios, photobooths)}
          targetIsPhotobooth={isPhotoboothId(photobooths, pendingMove.drag.targetStudio)}
          packages={packages}
          onCancel={() => setPendingMove(null)}
          onConfirm={(packageName) => {
            dropBlock(pendingMove.drag, packageName);
            setPendingMove(null);
          }}
        />
      )}
    </div>
  );
}
