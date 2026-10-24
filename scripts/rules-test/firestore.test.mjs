// Uji firestore.rules di Firestore Emulator (bagian dari npm test, lihat README.md). Setiap skenario harus
// boleh / ditolak sesuai peran: akun studio (Desktop), studio nonaktif, akun asing, owner, akses Manager tambahan,
// owner baru, admin.
import fs from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, getDocs, writeBatch,
  serverTimestamp, Timestamp, increment, limit,
} from 'firebase/firestore';

const RULES = new URL('../../firestore.rules', import.meta.url);
const env = await initializeTestEnvironment({
  projectId: 'demo-snapme',
  firestore: { rules: fs.readFileSync(RULES, 'utf8'), host: '127.0.0.1', port: 8089 },
});

const DAY = 86400000;
const pad = (n) => String(n).padStart(2, '0');
const dateStr = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const today = dateStr(Date.now());
const yesterday = dateStr(Date.now() - DAY);
const longAgo = dateStr(Date.now() - 10 * DAY);
const O = 'org1';

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'organizations', O), { ownerId: 'owner', name: 'Snap Me', wa_status: { isConnected: false }, ownerEmails: ['wakil@x.com'] });
  await setDoc(doc(db, 'organizations', 'org2'), { ownerId: 'owner2', name: 'Lain' });
  await setDoc(doc(db, 'studioAccounts', 'studio@x.com'), { orgId: O, managerId: 'm1', name: 'Cabang 1', active: true, uid: null });
  await setDoc(doc(db, 'studioAccounts', 'off@x.com'), { orgId: O, managerId: 'm1', name: 'Mati', active: false, uid: null });
  await setDoc(doc(db, 'studioAccounts', 'lain@x.com'), { orgId: 'org2', managerId: 'z', name: 'Org lain', active: true, uid: null });
  for (let i = 0; i < 30; i++) await setDoc(doc(db, `organizations/${O}/bookings/b${i}`), { customerName: `C${i}`, managerId: 'm1', date: today });
  await setDoc(doc(db, `organizations/${O}/transactions/tNew`), { total: 1, createdAt: Timestamp.fromMillis(Date.now() - DAY), createdBy: 'x', bookingId: 'b1' });
  await setDoc(doc(db, `organizations/${O}/transactions/tOld`), { total: 9, createdAt: Timestamp.fromMillis(Date.now() - 30 * DAY), createdBy: 'x', bookingId: 'b2' });
  await setDoc(doc(db, `organizations/${O}/packages/p1`), { name: 'Reguler', price: 100 });
  await setDoc(doc(db, `organizations/${O}/studios/s1`), { name: 'Studio 1', timerEnabled: false });
  await setDoc(doc(db, `organizations/${O}/makanan/f1`), { name: 'Roti', price: 5, stock: 5 });
  await setDoc(doc(db, `organizations/${O}/settings/kasir`), { businessName: 'X' });
  await setDoc(doc(db, `organizations/${O}/staff/s1`), { name: 'Rina', managerId: 'm1', active: true });
  await setDoc(doc(db, `organizations/${O}/attendance/aToday`), { staffId: 's1', managerId: 'm1', date: today, start: '09:00', end: '17:00', source: 'desktop', deletedAt: null, createdOn: { machineId: 'pc' } });
  await setDoc(doc(db, `organizations/${O}/attendance/aOld`), { staffId: 's1', managerId: 'm1', date: longAgo, start: '09:00', end: '17:00', source: 'desktop', deletedAt: null });
  await setDoc(doc(db, `organizations/${O}/members/stu`), { role: 'manager', email: 'studio@x.com' });
  await setDoc(doc(db, `organizations/${O}/securityAlerts/al1`), { type: 'x' });
  await setDoc(doc(db, 'users', 'other'), { email: 'other@x.com' });
  await setDoc(doc(db, 'inviteCodes', 'OWN-AAA-111'), { role: 'owner', status: 'available', claimedBy: null });
});

const as = (uid, email) => env.authenticatedContext(uid, { email, email_verified: true }).firestore();
const studio = as('stu', 'studio@x.com');
const off = as('off', 'off@x.com');
const stranger = as('rnd', 'random@gmail.com');
const owner = as('owner', 'owner@x.com');
const newOwner = as('newowner', 'baru@x.com');
const admin = as('adm', 'bakmiekt@gmail.com');
const wakil = as('wakil', 'Wakil@x.com');

let pass = 0;
const fails = [];
async function t(name, expectOk, fn) {
  try {
    await (expectOk ? assertSucceeds(fn()) : assertFails(fn()));
    pass += 1;
  } catch (e) {
    fails.push(`${expectOk ? 'HARUS BOLEH' : 'HARUS DITOLAK'}: ${name} — ${e.message.split('\n')[0]}`);
  }
}
const recent = Timestamp.fromMillis(Date.now() - 6 * DAY);
const rec = (over = {}) => ({ staffId: 's1', staffName: 'Rina', managerId: 'm1', date: today, start: '10:00', end: '12:00', source: 'desktop', deletedAt: null, createdAt: serverTimestamp(), createdOn: { machineId: 'pc1', machineName: 'PC 1' }, ...over });

// ----- Akun studio (Snapme Desktop) -----
await t('studio baca akunnya', true, () => getDoc(doc(studio, 'studioAccounts', 'studio@x.com')));
await t('studio baca akun studio lain', false, () => getDoc(doc(studio, 'studioAccounts', 'lain@x.com')));
await t('studio ganti managerId akunnya', false, () => updateDoc(doc(studio, 'studioAccounts', 'studio@x.com'), { managerId: 'm9' }));
await t('studio isi uid pertama kali', true, () => updateDoc(doc(studio, 'studioAccounts', 'studio@x.com'), { uid: 'stu' }));
await t('studio isi uid kedua kali', false, () => updateDoc(doc(studio, 'studioAccounts', 'studio@x.com'), { uid: 'stu2' }));
await t('studio baca organisasinya', true, () => getDoc(doc(studio, 'organizations', O)));
await t('studio baca organisasi lain', false, () => getDoc(doc(studio, 'organizations', 'org2')));
await t('studio tulis wa_status', true, () => updateDoc(doc(studio, 'organizations', O), { 'wa_status.isConnected': true }));
await t('studio ubah nama organisasi', false, () => updateDoc(doc(studio, 'organizations', O), { name: 'Hack' }));
await t('studio ubah ownerId', false, () => updateDoc(doc(studio, 'organizations', O), { ownerId: 'stu' }));
await t('studio query booking per cabang', true, () => getDocs(query(collection(studio, `organizations/${O}/bookings`), where('managerId', 'in', ['m1']), where('date', '==', today))));
await t('studio batch ubah 30 booking (batas get)', true, async () => {
  const b = writeBatch(studio);
  for (let i = 0; i < 30; i++) b.update(doc(studio, `organizations/${O}/bookings/b${i}`), { note: 'x' });
  return b.commit();
});
await t('studio hapus booking', true, () => deleteDoc(doc(studio, `organizations/${O}/bookings/b29`)));
await t('studio tulis pesan WA', true, () => setDoc(doc(studio, `organizations/${O}/messages/m1`), { status: 'pending' }));
await t('studio query transaksi 7 hari', true, () => getDocs(query(collection(studio, `organizations/${O}/transactions`), where('createdAt', '>=', recent))));
await t('studio query struk per booking + 7 hari', true, () => getDocs(query(collection(studio, `organizations/${O}/transactions`), where('bookingId', '==', 'b1'), where('createdAt', '>=', recent), limit(1))));
await t('studio query transaksi tanpa batas tanggal', false, () => getDocs(collection(studio, `organizations/${O}/transactions`)));
await t('studio query transaksi 30 hari', false, () => getDocs(query(collection(studio, `organizations/${O}/transactions`), where('createdAt', '>=', Timestamp.fromMillis(Date.now() - 30 * DAY)))));
await t('studio baca transaksi lama', false, () => getDoc(doc(studio, `organizations/${O}/transactions/tOld`)));
await t('studio buat transaksi (Kasir)', true, () => addDoc(collection(studio, `organizations/${O}/transactions`), { total: 5, createdBy: 'stu', createdAt: serverTimestamp() }));
await t('studio buat transaksi atas nama lain', false, () => addDoc(collection(studio, `organizations/${O}/transactions`), { total: 5, createdBy: 'owner', createdAt: serverTimestamp() }));
await t('studio hapus transaksi (isDeleted)', false, () => updateDoc(doc(studio, `organizations/${O}/transactions/tNew`), { isDeleted: true }));
await t('studio baca paket', true, () => getDoc(doc(studio, `organizations/${O}/packages/p1`)));
await t('studio ubah harga paket', false, () => updateDoc(doc(studio, `organizations/${O}/packages/p1`), { price: 1 }));
await t('studio tambah paket', false, () => addDoc(collection(studio, `organizations/${O}/packages`), { name: 'X', price: 1 }));
await t('studio nyalakan timer ruangan', true, () => updateDoc(doc(studio, `organizations/${O}/studios/s1`), { timerEnabled: true }));
await t('studio ganti nama ruangan', false, () => updateDoc(doc(studio, `organizations/${O}/studios/s1`), { name: 'X' }));
await t('studio kurangi stok (Kasir)', true, () => updateDoc(doc(studio, `organizations/${O}/makanan/f1`), { stock: increment(-1) }));
await t('studio ubah harga makanan', false, () => updateDoc(doc(studio, `organizations/${O}/makanan/f1`), { price: 1 }));
await t('studio baca pengaturan nota', true, () => getDoc(doc(studio, `organizations/${O}/settings/kasir`)));
await t('studio ubah pengaturan nota', false, () => setDoc(doc(studio, `organizations/${O}/settings/kasir`), { businessName: 'Y' }, { merge: true }));
await t('studio ubah template pesan WA', true, () => setDoc(doc(studio, `organizations/${O}/settings/reminder_message`), { template: 'hai' }, { merge: true }));
await t('studio ubah toleransi absensi', false, () => setDoc(doc(studio, `organizations/${O}/settings/attendance`), { lateToleranceMin: 99 }));
await t('studio baca staff', true, () => getDocs(collection(studio, `organizations/${O}/staff`)));
await t('studio tambah staff', false, () => addDoc(collection(studio, `organizations/${O}/staff`), { name: 'X', managerId: 'm1' }));
await t('studio ubah jadwal', false, () => setDoc(doc(studio, `organizations/${O}/shiftSchedules/m1_2026-10-26`), { managerId: 'm1' }));
await t('studio query absensi rentang tanggal', true, () => getDocs(query(collection(studio, `organizations/${O}/attendance`), where('date', '>=', longAgo), where('date', '<=', today))));
await t('studio catat kerja hari ini', true, () => addDoc(collection(studio, `organizations/${O}/attendance`), rec()));
await t('studio catat kerja kemarin', true, () => addDoc(collection(studio, `organizations/${O}/attendance`), rec({ date: yesterday })));
await t('studio catat kerja 10 hari lalu', false, () => addDoc(collection(studio, `organizations/${O}/attendance`), rec({ date: longAgo })));
await t('studio catat kerja cabang lain', false, () => addDoc(collection(studio, `organizations/${O}/attendance`), rec({ managerId: 'm2' })));
await t('studio catat kerja tanggal rusak', false, () => addDoc(collection(studio, `organizations/${O}/attendance`), rec({ date: 'kemarin' })));
await t('studio ubah jam catatan hari ini', true, () => updateDoc(doc(studio, `organizations/${O}/attendance/aToday`), { end: '18:00', updatedAt: serverTimestamp(), updatedOn: { machineId: 'pc2' } }));
await t('studio hapus (deletedAt) catatan hari ini', true, () => updateDoc(doc(studio, `organizations/${O}/attendance/aToday`), { deletedAt: serverTimestamp() }));
await t('studio ubah jejak pencatat', false, () => updateDoc(doc(studio, `organizations/${O}/attendance/aToday`), { createdOn: { machineId: 'palsu' } }));
await t('studio ubah catatan lama', false, () => updateDoc(doc(studio, `organizations/${O}/attendance/aOld`), { end: '18:00' }));
await t('studio pindah catatan lama ke hari ini', false, () => updateDoc(doc(studio, `organizations/${O}/attendance/aOld`), { date: today }));
await t('studio hapus permanen catatan', false, () => deleteDoc(doc(studio, `organizations/${O}/attendance/aToday`)));
await t('studio baca anggota lama (transisi)', true, () => getDocs(collection(studio, `organizations/${O}/members`)));
await t('studio baca log keamanan', false, () => getDocs(collection(studio, `organizations/${O}/securityAlerts`)));
await t('studio tulis profil sendiri (lastLogin)', true, () => setDoc(doc(studio, 'users', 'stu'), { email: 'studio@x.com', lastLogin: 'x', appVersion: '2.1.0' }, { merge: true }));
await t('studio jadikan dirinya owner', false, () => setDoc(doc(studio, 'users', 'stu'), { role: 'owner' }, { merge: true }));
await t('studio baca profil user lain', false, () => getDoc(doc(studio, 'users', 'other')));
await t('studio daftarkan akun studio baru', false, () => setDoc(doc(studio, 'studioAccounts', 'baru@x.com'), { orgId: O, managerId: 'm1' }));

// ----- Akun studio nonaktif & akun Google asing -----
await t('studio nonaktif baca booking', false, () => getDoc(doc(off, `organizations/${O}/bookings/b1`)));
await t('akun asing baca booking', false, () => getDoc(doc(stranger, `organizations/${O}/bookings/b1`)));
await t('akun asing baca organisasi', false, () => getDoc(doc(stranger, 'organizations', O)));
await t('akun asing query organisasi', false, () => getDocs(collection(stranger, 'organizations')));
await t('akun asing cek email belum terdaftar', true, () => getDoc(doc(stranger, 'studioAccounts', 'random@gmail.com')));
await t('akun asing baca kode undangan (per id)', true, () => getDoc(doc(stranger, 'inviteCodes', 'OWN-AAA-111')));
await t('akun asing daftar semua kode undangan', false, () => getDocs(collection(stranger, 'inviteCodes')));
await t('akun asing buat organisasi tanpa kode', false, () => setDoc(doc(stranger, 'organizations', 'orgX'), { ownerId: 'rnd', name: 'X' }));

// ----- Owner (Snapme Manager) -----
await t('owner cari organisasinya (ownerId)', true, () => getDocs(query(collection(owner, 'organizations'), where('ownerId', '==', 'owner'))));
await t('owner ubah harga paket', true, () => updateDoc(doc(owner, `organizations/${O}/packages/p1`), { price: 150 }));
await t('owner ubah nota', true, () => setDoc(doc(owner, `organizations/${O}/settings/kasir`), { businessName: 'Z' }, { merge: true }));
await t('owner daftar akun studio orgnya', true, () => getDocs(query(collection(owner, 'studioAccounts'), where('orgId', '==', O))));
await t('owner tambah akun studio', true, () => setDoc(doc(owner, 'studioAccounts', 'cabang2@x.com'), { orgId: O, managerId: 'm2', name: 'Cabang 2', active: true, uid: null }));
await t('owner tambah akun studio ke org lain', false, () => setDoc(doc(owner, 'studioAccounts', 'cabang3@x.com'), { orgId: 'org2', managerId: 'm3' }));
await t('owner ambil alih akun studio org lain', false, () => setDoc(doc(owner, 'studioAccounts', 'lain@x.com'), { orgId: O, managerId: 'm1' }));
await t('owner nonaktifkan akun studio', true, () => updateDoc(doc(owner, 'studioAccounts', 'studio@x.com'), { active: false }));
await t('owner baca transaksi lama', true, () => getDoc(doc(owner, `organizations/${O}/transactions/tOld`)));
await t('owner hapus transaksi (isDeleted)', true, () => updateDoc(doc(owner, `organizations/${O}/transactions/tOld`), { isDeleted: true }));
await t('owner koreksi absensi lama', true, () => updateDoc(doc(owner, `organizations/${O}/attendance/aOld`), { end: '16:00' }));
await t('owner atur staff & jadwal', true, () => setDoc(doc(owner, `organizations/${O}/shiftSchedules/m1_2026-10-26`), { managerId: 'm1', days: {} }));
await t('owner baca log keamanan', true, () => getDocs(collection(owner, `organizations/${O}/securityAlerts`)));
await t('owner baca organisasi lain', false, () => getDoc(doc(owner, 'organizations', 'org2')));
await t('studio yang dinonaktifkan owner kehilangan akses', false, () => getDoc(doc(studio, `organizations/${O}/bookings/b1`)));

// ----- Akses Manager tambahan (ownerEmails) -----
await t('akun tambahan cari organisasi (ownerEmails)', true, () => getDocs(query(collection(wakil, 'organizations'), where('ownerEmails', 'array-contains', 'wakil@x.com'))));
await t('akun tambahan baca organisasi', true, () => getDoc(doc(wakil, 'organizations', O)));
await t('akun tambahan baca booking', true, () => getDoc(doc(wakil, `organizations/${O}/bookings/b1`)));
await t('akun tambahan ubah harga paket', true, () => updateDoc(doc(wakil, `organizations/${O}/packages/p1`), { price: 175 }));
await t('akun tambahan baca transaksi lama', true, () => getDoc(doc(wakil, `organizations/${O}/transactions/tOld`)));
await t('akun tambahan kelola akun studio', true, () => updateDoc(doc(wakil, 'studioAccounts', 'cabang2@x.com'), { name: 'Cabang Dua' }));
await t('akun tambahan ubah nama studio', true, () => updateDoc(doc(wakil, 'organizations', O), { name: 'Snap Me Studio' }));
await t('akun tambahan tambah akses Manager', false, () => updateDoc(doc(wakil, 'organizations', O), { ownerEmails: ['wakil@x.com', 'teman@x.com'] }));
await t('akun tambahan jadikan dirinya owner utama', false, () => updateDoc(doc(wakil, 'organizations', O), { ownerId: 'wakil' }));
await t('akun tambahan tidak bisa baca org lain', false, () => getDoc(doc(wakil, 'organizations', 'org2')));
await t('owner utama tambah akses Manager', true, () => updateDoc(doc(owner, 'organizations', O), { ownerEmails: ['wakil@x.com', 'teman@x.com'] }));
await t('owner utama hapus akses Manager', true, () => updateDoc(doc(owner, 'organizations', O), { ownerEmails: ['teman@x.com'] }));
await t('akses dihapus: akun tambahan tertolak', false, () => getDoc(doc(wakil, `organizations/${O}/bookings/b1`)));

// ----- Owner baru menebus kode owner (Snapme Manager) -----
await t('owner baru: tebus kode + buat organisasi (batch)', true, () => {
  const b = writeBatch(newOwner);
  b.update(doc(newOwner, 'inviteCodes', 'OWN-AAA-111'), { status: 'claimed', claimedBy: 'newowner', claimedAt: 'x', orgId: 'orgBaru' });
  b.set(doc(newOwner, 'organizations', 'orgBaru'), { ownerId: 'newowner', name: 'Studio Baru', inviteCode: 'OWN-AAA-111' });
  return b.commit();
});
await t('kode yang sudah ditebus tidak bisa dipakai lagi', false, () => {
  const b = writeBatch(stranger);
  b.update(doc(stranger, 'inviteCodes', 'OWN-AAA-111'), { status: 'claimed', claimedBy: 'rnd', claimedAt: 'y', orgId: 'orgY' });
  b.set(doc(stranger, 'organizations', 'orgY'), { ownerId: 'rnd', name: 'Y', inviteCode: 'OWN-AAA-111' });
  return b.commit();
});

// ----- Admin (Snapme_Developer_Web) -----
await t('admin daftar semua user', true, () => getDocs(collection(admin, 'users')));
await t('admin buat kode owner', true, () => setDoc(doc(admin, 'inviteCodes', 'OWN-BBB-222'), { role: 'owner', status: 'available' }));

console.log(`Firestore rules: LULUS ${pass} / ${pass + fails.length}`);
fails.forEach((f) => console.log('  ✗', f));
await env.cleanup();
process.exit(fails.length ? 1 : 0);
