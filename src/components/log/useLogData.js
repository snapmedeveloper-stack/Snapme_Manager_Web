// Data mode Log dari Firestore (indeks appLogs di firestore.indexes.json). Semua realtime; query selalu dibatasi
// rentang waktu atau jumlah karena log aktivitas bisa ribuan per bulan.
import { useEffect, useMemo, useState } from 'react';
import {
  Timestamp,
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  deleteDoc,
  where,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { groupErrors } from './logModel';

/** Waktu sekarang yang diperbarui berkala (status online, "x menit lalu", operasi tidak selesai). */
export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

const logsCol = (orgId) => collection(db, 'organizations', orgId, 'appLogs');
const withId = (d) => ({ id: d.id, ...d.data() });
const ERROR_WINDOW = 500;

/** Kondisi semua PC (devices), urut nama. */
export function useDevices(orgId) {
  const [state, setState] = useState({ devices: [], loading: true });
  useEffect(() => {
    if (!orgId) return undefined;
    return onSnapshot(
      collection(db, 'organizations', orgId, 'devices'),
      (snap) =>
        setState({
          devices: snap.docs.map(withId).sort((a, b) => String(a.machineName).localeCompare(String(b.machineName))),
          loading: false,
        }),
      (err) => {
        console.error('[Log] Gagal memuat perangkat', err);
        setState({ devices: [], loading: false, error: err.message });
      },
    );
  }, [orgId]);
  return state;
}

/** Status "sudah ditangani" per sidik jari: { [fingerprint]: { resolvedAt, resolvedBy } }. */
export function useLogIssues(orgId) {
  const [issues, setIssues] = useState({});
  useEffect(() => {
    if (!orgId) return undefined;
    return onSnapshot(
      collection(db, 'organizations', orgId, 'logIssues'),
      (snap) => setIssues(Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]))),
      (err) => console.error('[Log] Gagal memuat status error', err),
    );
  }, [orgId]);
  return issues;
}

export const resolveIssue = (orgId, fingerprint, user) =>
  setDoc(doc(db, 'organizations', orgId, 'logIssues', fingerprint), {
    resolvedAt: serverTimestamp(),
    resolvedBy: user?.email || '-',
  });

export const reopenIssue = (orgId, fingerprint) => deleteDoc(doc(db, 'organizations', orgId, 'logIssues', fingerprint));

/**
 * Catatan satu jenis (type) dalam rentang [from, to), terbaru dulu, dibatasi pageSize. Filter cabang/PC di server
 * (indeks type+managerId / type+machineId); kategori, sumber, & kata kunci disaring di halaman.
 * Hasil { docs, loading, error, hasMore }.
 */
export function useLogRange({ orgId, type, from, to, managerId, machineId, pageSize }) {
  const fromMs = from?.getTime();
  const toMs = to?.getTime();
  const [state, setState] = useState({ key: null, docs: [], error: null });
  const key = [orgId, type, fromMs, toMs, managerId, machineId, pageSize].join('|');

  useEffect(() => {
    if (!orgId) return undefined;
    const filters = [where('type', '==', type)];
    if (machineId) filters.push(where('machineId', '==', machineId));
    else if (managerId) filters.push(where('managerId', '==', managerId));
    if (fromMs != null) filters.push(where('occurredAt', '>=', Timestamp.fromMillis(fromMs)));
    if (toMs != null) filters.push(where('occurredAt', '<', Timestamp.fromMillis(toMs)));
    const q = query(logsCol(orgId), ...filters, orderBy('occurredAt', 'desc'), limit(pageSize));
    return onSnapshot(
      q,
      (snap) => setState({ key, docs: snap.docs.map(withId), error: null }),
      (err) => {
        console.error('[Log] Gagal memuat log', err);
        setState({ key, docs: [], error: err.message });
      },
    );
  }, [orgId, type, fromMs, toMs, managerId, machineId, pageSize, key]);

  const loading = state.key !== key;
  return {
    docs: loading ? [] : state.docs,
    loading,
    error: loading ? null : state.error,
    hasMore: state.docs.length >= pageSize,
  };
}

// ---------- Error baru (tanda di menu Profil) ----------
// "Baru" = muncul sejak halaman Error mode Log terakhir dibuka di perangkat ini (belum pernah: 7 hari terakhir).
// Query kecil (maks. 100 error terbaru) karena tanda ini dimuat di semua halaman Manager.
const NEW_ERROR_WINDOW = 100;
const NEW_ERROR_DEFAULT_MS = 7 * 86400000;
const SEEN_EVENT = 'snapme:log-errors-seen';
const seenKey = (orgId) => `snapme.logErrorsSeenAt.${orgId}`;

function readSeen(orgId) {
  try {
    return Number(localStorage.getItem(seenKey(orgId))) || null;
  } catch {
    return null;
  }
}

/** Tandai semua error sudah dilihat (dipanggil halaman Error). */
export function markErrorsSeen(orgId) {
  if (!orgId) return;
  try {
    localStorage.setItem(seenKey(orgId), String(Date.now()));
  } catch {
    // penyimpanan lokal terkunci: tanda tetap menghitung dari batas sebelumnya
  }
  window.dispatchEvent(new Event(SEEN_EVENT));
}

/** Jumlah masalah error baru yang belum ditangani (dikelompokkan per sidik jari). orgId kosong = 0, tanpa query. */
export function useNewErrorCount(orgId) {
  const [seen, setSeen] = useState(() => ({ orgId, at: readSeen(orgId) }));
  const [fallbackAt] = useState(() => Date.now() - NEW_ERROR_DEFAULT_MS);
  useEffect(() => {
    const sync = () => setSeen({ orgId, at: readSeen(orgId) });
    window.addEventListener(SEEN_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(SEEN_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [orgId]);
  const seenAt = seen.orgId === orgId ? seen.at : null;
  const fromMs = seenAt ?? fallbackAt;
  const from = useMemo(() => new Date(fromMs), [fromMs]);
  const errors = useLogRange({ orgId, type: 'error', from, pageSize: NEW_ERROR_WINDOW });
  const issues = useLogIssues(orgId);
  return useMemo(
    () => groupErrors(errors.docs, issues).filter((g) => g.status !== 'resolved').length,
    [errors.docs, issues],
  );
}

/** Error terbaru (sampai 500 catatan) untuk dikelompokkan per sidik jari. */
export function useRecentErrors({ orgId, managerId }) {
  return useLogRange({ orgId, type: 'error', managerId, pageSize: ERROR_WINDOW });
}

/** Semua kejadian satu kelompok error (sidik jari), terakhir dulu. */
export function useFingerprintDocs(orgId, fingerprint) {
  const [state, setState] = useState({ key: null, docs: [] });
  const key = `${orgId}|${fingerprint}`;
  useEffect(() => {
    if (!orgId || !fingerprint) return undefined;
    const q = query(logsCol(orgId), where('fingerprint', '==', fingerprint), orderBy('lastAt', 'desc'), limit(200));
    return onSnapshot(
      q,
      (snap) => setState({ key, docs: snap.docs.map(withId) }),
      (err) => {
        console.error('[Log] Gagal memuat kejadian error', err);
        setState({ key, docs: [], error: err.message });
      },
    );
  }, [orgId, fingerprint, key]);
  return { docs: state.key === key ? state.docs : [], loading: state.key !== key, error: state.error };
}

/** Linimasa satu objek (booking/transaksi/…): semua catatan dengan subject.id itu, urut waktu. */
export function useSubjectTimeline(orgId, subjectId) {
  const [state, setState] = useState({ key: null, docs: [] });
  const key = `${orgId}|${subjectId}`;
  useEffect(() => {
    if (!orgId || !subjectId) return undefined;
    const q = query(logsCol(orgId), where('subject.id', '==', subjectId), orderBy('occurredAt', 'asc'), limit(300));
    return onSnapshot(
      q,
      (snap) => setState({ key, docs: snap.docs.map(withId) }),
      (err) => {
        console.error('[Log] Gagal memuat linimasa', err);
        setState({ key, docs: [], error: err.message });
      },
    );
  }, [orgId, subjectId, key]);
  return { docs: state.key === key ? state.docs : [], loading: state.key !== key, error: state.error };
}

/** 5 aktivitas terakhir di satu PC sampai waktu tertentu (konteks sebelum error). */
export async function lastActionsBefore(orgId, machineId, atMs, count = 5) {
  const q = query(
    logsCol(orgId),
    where('type', '==', 'activity'),
    where('machineId', '==', machineId),
    where('occurredAt', '<=', Timestamp.fromMillis(atMs)),
    orderBy('occurredAt', 'desc'),
    limit(count),
  );
  return (await getDocs(q)).docs.map(withId);
}

/** Jumlah persis catatan satu jenis dalam rentang (agregasi server, murah). */
export function useLogCount({ orgId, type, from, to, managerId }) {
  const [count, setCount] = useState(null);
  const fromMs = from?.getTime();
  const toMs = to?.getTime();
  useEffect(() => {
    if (!orgId) return undefined;
    let cancelled = false;
    const filters = [where('type', '==', type)];
    if (managerId) filters.push(where('managerId', '==', managerId));
    filters.push(
      where('occurredAt', '>=', Timestamp.fromMillis(fromMs)),
      where('occurredAt', '<', Timestamp.fromMillis(toMs)),
    );
    getCountFromServer(query(logsCol(orgId), ...filters))
      .then((snap) => !cancelled && setCount(snap.data().count))
      .catch((err) => {
        console.error('[Log] Gagal menghitung log', err);
        if (!cancelled) setCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, [orgId, type, fromMs, toMs, managerId]);
  return count;
}

/**
 * Pemeriksaan silang satu catatan dengan data nyata (logModel.crossCheckFor). Hasil: null (tidak ada pemeriksa),
 * { status: 'checking' }, { status: 'match' | 'mismatch', label }, atau { status: 'error', label }.
 */
export function useCrossCheck(orgId, check) {
  const [state, setState] = useState({ key: null });
  const key = check ? `${orgId}|${check.path.join('/')}|${check.expect}` : null;
  useEffect(() => {
    if (!orgId || !check) return undefined;
    let cancelled = false;
    getDoc(doc(db, 'organizations', orgId, ...check.path))
      .then((snap) => {
        if (cancelled) return;
        const ok = check.expect === 'exists' ? snap.exists() : !snap.exists();
        setState({ key, status: ok ? 'match' : 'mismatch', label: ok ? check.label : check.mismatch });
      })
      .catch((err) => !cancelled && setState({ key, status: 'error', label: `${check.label}: ${err.message}` }));
    return () => {
      cancelled = true;
    };
    // key mewakili isi check (path & harapan); label turunan dari event yang sama
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, key]);
  if (!check) return null;
  return state.key === key ? state : { status: 'checking', label: check.label };
}
