import { useEffect, useState } from 'react';
import { onSnapshot, query, where } from 'firebase/firestore';
import { DEFAULT_TOLERANCE_MIN } from '../../utils/attendance';
import { attendanceCollection, attendanceSettingsRef, scheduleCollection, staffCollection } from './timData';

const withId = (d) => ({ id: d.id, ...d.data() });
/** Updater state loaded: tandai satu sumber data sudah termuat. */
const markLoaded = (key) => (prev) => (prev[key] ? prev : { ...prev, [key]: true });
const byOrderThenName = (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name);

/**
 * Data Tim satu cabang (managerId): staff, versi jadwal, dan catatan kerja dalam rentang tanggal.
 * Koleksinya kecil, jadi staff & jadwal dibaca utuh lalu disaring per cabang di sini; catatan kerja dibatasi rentang
 * tanggal di query (indeks satu field) lalu disaring per cabang.
 */
export function useTimData(orgId, managerId, { from, to }) {
  const [staff, setStaff] = useState([]);
  const [versions, setVersions] = useState([]);
  const [records, setRecords] = useState([]);
  const [loaded, setLoaded] = useState({
    staff: false,
    versions: false,
    records: false,
  });

  useEffect(() => {
    if (!orgId || !managerId) return undefined;
    return onSnapshot(
      staffCollection(orgId),
      (snap) => {
        setStaff(
          snap.docs
            .map(withId)
            .filter((s) => s.managerId === managerId)
            .sort(byOrderThenName),
        );
        setLoaded(markLoaded('staff'));
      },
      () => setLoaded(markLoaded('staff')),
    );
  }, [orgId, managerId]);

  useEffect(() => {
    if (!orgId || !managerId) return undefined;
    return onSnapshot(
      scheduleCollection(orgId),
      (snap) => {
        setVersions(snap.docs.map(withId).filter((v) => v.managerId === managerId));
        setLoaded(markLoaded('versions'));
      },
      () => setLoaded(markLoaded('versions')),
    );
  }, [orgId, managerId]);

  useEffect(() => {
    if (!orgId || !managerId || !from || !to) return undefined;
    const q = query(attendanceCollection(orgId), where('date', '>=', from), where('date', '<=', to));
    return onSnapshot(
      q,
      (snap) => {
        setRecords(snap.docs.map(withId).filter((r) => r.managerId === managerId));
        setLoaded(markLoaded('records'));
      },
      () => setLoaded(markLoaded('records')),
    );
  }, [orgId, managerId, from, to]);

  return {
    staff,
    versions,
    records,
    loading: !loaded.staff || !loaded.versions || !loaded.records,
  };
}

/** Pengaturan absensi organisasi (toleransi terlambat). */
export function useAttendanceSettings(orgId) {
  const [settings, setSettings] = useState({
    lateToleranceMin: DEFAULT_TOLERANCE_MIN,
  });
  useEffect(() => {
    if (!orgId) return undefined;
    return onSnapshot(attendanceSettingsRef(orgId), (snap) => {
      if (snap.exists())
        setSettings({
          lateToleranceMin: DEFAULT_TOLERANCE_MIN,
          ...snap.data(),
        });
    });
  }, [orgId]);
  return settings;
}
