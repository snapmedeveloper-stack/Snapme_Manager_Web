// Akses Firestore halaman Tim (docs/RENCANA_TANPA_ROLE.md §3). Owner mengelola semuanya dari Snapme Manager;
// Snapme Desktop hanya membaca staff & jadwal dan mencatat absensi hari ini/kemarin.
import { addDoc, collection, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { scheduleDocId } from '../../utils/attendance';

export const staffCollection = (orgId) => collection(db, 'organizations', orgId, 'staff');
export const scheduleCollection = (orgId) => collection(db, 'organizations', orgId, 'shiftSchedules');
export const attendanceCollection = (orgId) => collection(db, 'organizations', orgId, 'attendance');
export const attendanceSettingsRef = (orgId) => doc(db, 'organizations', orgId, 'settings', 'attendance');
export const studioAccountsCollection = () => collection(db, 'studioAccounts');
/** Id dokumen akun studio = email huruf kecil, supaya rules & Desktop bisa mencarinya dari token login. */
export const studioAccountRef = (email) => doc(db, 'studioAccounts', email.trim().toLowerCase());

/** Jejak penulis catatan dari Snapme Manager (Desktop mengisi nama & id PC). */
const managerTrail = (user) => ({
  machineId: 'manager-web',
  machineName: `Snapme Manager (${user.email})`,
});

export const addStaff = (orgId, { name, managerId, order }) =>
  addDoc(staffCollection(orgId), {
    name,
    managerId,
    active: true,
    order,
    createdAt: serverTimestamp(),
  });

export const updateStaff = (orgId, staffId, fields) =>
  updateDoc(doc(staffCollection(orgId), staffId), {
    ...fields,
    updatedAt: serverTimestamp(),
  });

/** Simpan versi jadwal mulai effectiveFrom (menimpa versi dengan tanggal mulai yang sama). */
export const saveSchedule = (orgId, user, { managerId, effectiveFrom, days }) =>
  setDoc(doc(scheduleCollection(orgId), scheduleDocId(managerId, effectiveFrom)), {
    managerId,
    effectiveFrom,
    days,
    updatedAt: serverTimestamp(),
    updatedBy: user.email,
  });

export const addRecord = (orgId, user, record) =>
  addDoc(attendanceCollection(orgId), {
    ...record,
    source: 'manager',
    deletedAt: null,
    createdAt: serverTimestamp(),
    createdOn: managerTrail(user),
  });

export const updateRecord = (orgId, user, recordId, fields) =>
  updateDoc(doc(attendanceCollection(orgId), recordId), {
    ...fields,
    updatedAt: serverTimestamp(),
    updatedOn: managerTrail(user),
  });

/** Hapus = tandai deletedAt; owner tetap bisa melihat & memulihkannya. */
export const deleteRecord = (orgId, user, recordId) =>
  updateRecord(orgId, user, recordId, { deletedAt: serverTimestamp() });

export const restoreRecord = (orgId, user, recordId) => updateRecord(orgId, user, recordId, { deletedAt: null });
