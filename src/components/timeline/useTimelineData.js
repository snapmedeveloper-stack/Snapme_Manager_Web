import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { inManagerScope } from '../../utils/managerScope';

const EMPTY = [];
const byOrder = (a, b) => a.order - b.order;
const asPlace = (id, data) => ({ id, name: data.name || id, order: data.order || 0 });

/** Booking lama bisa tanpa startHour/startMin (hanya "time") atau durasi berupa teks: dirapikan untuk tampilan. */
function toBooking(id, data) {
  let { startHour, startMin } = data;
  if (startHour === undefined && data.time) {
    const [h, m] = data.time.split(':');
    startHour = parseInt(h, 10);
    startMin = parseInt(m, 10) || 0;
  }
  return {
    id,
    ...data,
    startHour: startHour ?? 10,
    startMin: startMin ?? 0,
    duration: data.duration ? Number(data.duration) : 30,
  };
}

/**
 * Data Timeline (realtime), sama dengan useTimelineCatalog + useTimelineBookings di Snapme_Desktop:
 * studio, photobooth, paket, item tambahan milik tim manager yang dilihat (belum diarsipkan), dan booking tanggal itu.
 * isLoaded false sampai snapshot booking tanggal terpilih tiba (supaya daftar tanggal lama tidak bisa diubah).
 */
export function useTimelineData({ orgId, managerIds, selectedDate }) {
  // Kunci string agar array baru dengan isi sama tidak memasang ulang listener
  const scopeKey = managerIds ? managerIds.join(',') : '';
  const [catalog, setCatalog] = useState({ studios: EMPTY, photobooths: EMPTY, packages: EMPTY, addOns: EMPTY });
  const [loaded, setLoaded] = useState({ key: null, bookings: EMPTY });
  const viewKey = `${orgId}/${scopeKey}/${selectedDate}`;

  useEffect(() => {
    if (!orgId) return undefined;
    const scope = scopeKey ? scopeKey.split(',') : null;
    const listen = (name, field, toItem, sorted) =>
      onSnapshot(collection(db, 'organizations', orgId, name), (snap) => {
        const list = [];
        snap.forEach((d) => {
          const data = d.data();
          if (inManagerScope(data.managerId, scope) && !data.archived) list.push(toItem(d.id, data));
        });
        if (sorted) list.sort(byOrder);
        setCatalog((prev) => ({ ...prev, [field]: list }));
      });
    const unsubs = [
      listen('studios', 'studios', asPlace, true),
      listen('photobooths', 'photobooths', asPlace, true),
      listen('packages', 'packages', (id, data) => ({ id, ...data, order: data.order || 0 }), true),
      listen('add_ons', 'addOns', (id, data) => ({ id, ...data }), false),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [orgId, scopeKey]);

  useEffect(() => {
    if (!orgId) return undefined;
    const key = `${orgId}/${scopeKey}/${selectedDate}`;
    const q = query(
      collection(db, 'organizations', orgId, 'bookings'),
      where('date', '==', selectedDate),
      ...(scopeKey ? [where('managerId', 'in', scopeKey.split(','))] : []),
    );
    return onSnapshot(
      q,
      (snap) => setLoaded({ key, bookings: snap.docs.map((d) => toBooking(d.id, d.data())) }),
      (err) => console.error('[Timeline] Gagal memuat booking', err),
    );
  }, [orgId, scopeKey, selectedDate]);

  const isLoaded = loaded.key === viewKey;
  return { ...catalog, bookings: isLoaded ? loaded.bookings : EMPTY, isLoaded };
}
