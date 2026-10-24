// Salinan Snapme_Desktop/src/components/transaksi/useTransaksiData.js: ubah keduanya bersamaan.
import { useEffect, useRef, useState } from 'react';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';

const toMillis = (ts) => (ts?.toMillis ? ts.toMillis() : 0);
const withId = (d) => ({ id: d.id, ...d.data() });

/** Data pendukung halaman Transaksi: pengaturan nota, katalog (untuk kategori rekap), dan id photobooth. */
export function useTransaksiCatalog(orgId) {
  const [kasirSettings, setKasirSettings] = useState({});
  const [packages, setPackages] = useState([]);
  const [addOns, setAddOns] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [photobooths, setPhotobooths] = useState([]);

  useEffect(() => {
    if (!orgId) return undefined;
    const unsubs = [
      onSnapshot(doc(db, 'organizations', orgId, 'settings', 'kasir'), (snap) => {
        if (snap.exists()) setKasirSettings(snap.data());
      }),
      onSnapshot(collection(db, 'organizations', orgId, 'packages'), (snap) => setPackages(snap.docs.map(withId))),
      onSnapshot(collection(db, 'organizations', orgId, 'add_ons'), (snap) => setAddOns(snap.docs.map(withId))),
      onSnapshot(collection(db, 'organizations', orgId, 'templates'), (snap) => setTemplates(snap.docs.map(withId))),
      onSnapshot(collection(db, 'organizations', orgId, 'photobooths'), (snap) =>
        setPhotobooths(snap.docs.map((d) => d.id)),
      ),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [orgId]);

  return { kasirSettings, packages, addOns, templates, photobooths };
}

/**
 * Transaksi dalam rentang tanggal (realtime, terbaru di atas) plus booking terkait.
 * - loading true sampai snapshot pertama rentang ini selesai diproses, termasuk booking-nya.
 * - Booking diambil ulang di setiap snapshot supaya badge tahap ikut maju, kecuali yang sudah selesai
 *   atau tidak ada. Permintaan yang masih berjalan dipakai bersama.
 * - error berisi pesan bila listener gagal; daftar dikosongkan supaya angka periode lain tidak tampil.
 */
export function useTransactions(orgId, startDate, endDate) {
  const rangeKey = `${orgId}|${startDate?.getTime() ?? ''}|${endDate?.getTime() ?? ''}`;
  const [loaded, setLoaded] = useState({ key: null, transactions: [], error: null });
  const [bookings, setBookings] = useState({});
  // Booking tidak bergantung pada rentang tanggal, jadi cache-nya bertahan antar-efek (per organisasi)
  const bookingCache = useRef({ orgId: null, settled: new Set(), pending: new Map() });

  useEffect(() => {
    if (!orgId) return undefined;
    if (bookingCache.current.orgId !== orgId) {
      bookingCache.current = { orgId, settled: new Set(), pending: new Map() };
    }
    const { settled, pending } = bookingCache.current;
    let active = true;
    let latestSnapshot = 0;

    // Hasil: data booking, null bila tidak ada, undefined bila gagal diambil
    const fetchBooking = (bookingId) => {
      if (!pending.has(bookingId)) {
        const request = getDoc(doc(db, 'organizations', orgId, 'bookings', bookingId))
          .then((d) => {
            const booking = d.exists() ? withId(d) : null;
            if (!booking || booking.processCompleted) settled.add(bookingId);
            return booking;
          })
          .catch((err) => {
            console.error('[Transaksi] Gagal mengambil booking', bookingId, err);
            return undefined;
          })
          .finally(() => pending.delete(bookingId));
        pending.set(bookingId, request);
      }
      return pending.get(bookingId);
    };

    const constraints = [];
    if (startDate) constraints.push(where('createdAt', '>=', startDate));
    if (startDate && endDate) constraints.push(where('createdAt', '<', endDate));
    const txQuery = query(collection(db, 'organizations', orgId, 'transactions'), ...constraints);

    const unsub = onSnapshot(
      txQuery,
      async (snap) => {
        latestSnapshot += 1;
        const snapshotNo = latestSnapshot;
        // Query memakai where('createdAt'), jadi urutan terbaru diatur di sini
        const transactions = snap.docs.map(withId).sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

        const bookingIds = [...new Set(transactions.map((tx) => tx.bookingId).filter(Boolean))].filter(
          (id) => !settled.has(id),
        );
        const results = await Promise.all(bookingIds.map((id) => fetchBooking(id).then((booking) => [id, booking])));
        const fetched = Object.fromEntries(results.filter(([, booking]) => booking));
        // Disimpan walau rentang sudah berganti, karena booking dipakai lintas rentang
        if (Object.keys(fetched).length > 0) setBookings((prev) => ({ ...prev, ...fetched }));
        // Rentang lain atau snapshot yang lebih baru sudah mengambil alih
        if (!active || snapshotNo !== latestSnapshot) return;
        setLoaded({ key: rangeKey, transactions, error: null });
      },
      (error) => {
        console.error('[Transaksi] Gagal memuat transaksi', error);
        setLoaded({ key: rangeKey, transactions: [], error: error.message });
      },
    );
    return () => {
      active = false;
      unsub();
    };
  }, [orgId, startDate, endDate, rangeKey]);

  return {
    transactions: loaded.transactions,
    bookings,
    loading: loaded.key !== rangeKey,
    error: loaded.key === rangeKey ? loaded.error : null,
  };
}
