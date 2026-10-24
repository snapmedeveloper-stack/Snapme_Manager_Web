// Tanda akses di token login (custom claim) untuk storage.rules (docs/RENCANA_TANPA_ROLE.md).
// Rules Cloud Storage hanya bisa membaca database Firestore "(default)", sedangkan data Snap Me ada di database
// bernama "default". Karena itu peran akun disalin ke token: { snapmeOrg: orgId, snapmeRole: 'owner' | 'studio' }.
// Sumbernya sama dengan firestore.rules: owner utama (ownerId), akses Manager tambahan (ownerEmails), akun studio aktif.
const functions = require('firebase-functions');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

const REGION = 'asia-southeast2';
const DATABASE = 'default';
const CLAIM_KEYS = ['snapmeOrg', 'snapmeRole'];

const db = () => getFirestore(admin.app(), DATABASE);

/** Peran akun menurut Firestore: { snapmeOrg, snapmeRole } atau {} bila tidak punya akses. */
async function claimsFor(uid, email) {
  const organizations = db().collection('organizations');
  const owned = await organizations.where('ownerId', '==', uid).limit(1).get();
  if (!owned.empty) return { snapmeOrg: owned.docs[0].id, snapmeRole: 'owner' };
  if (!email) return {};
  const shared = await organizations.where('ownerEmails', 'array-contains', email).limit(1).get();
  if (!shared.empty) return { snapmeOrg: shared.docs[0].id, snapmeRole: 'owner' };
  const studio = await db().doc(`studioAccounts/${email}`).get();
  const data = studio.exists ? studio.data() : null;
  if (data && data.active !== false && data.orgId) return { snapmeOrg: data.orgId, snapmeRole: 'studio' };
  return {};
}

/** Samakan tanda akses akun dengan Firestore. Claim lain di akun (bila ada) dibiarkan. */
async function syncUser(user) {
  // Email belum terverifikasi tidak dipercaya untuk ownerEmails / akun studio (sama dengan firestore.rules)
  const email = user.emailVerified && user.email ? user.email.toLowerCase() : '';
  const next = await claimsFor(user.uid, email);
  const current = user.customClaims || {};
  if (CLAIM_KEYS.every((key) => current[key] === next[key])) return { changed: false, claims: next };
  const merged = { ...current };
  CLAIM_KEYS.forEach((key) => delete merged[key]);
  await admin.auth().setCustomUserClaims(user.uid, { ...merged, ...next });
  return { changed: true, claims: next };
}

/** Sinkronkan akun dengan email ini bila sudah pernah login (belum ada akun Auth = dilewati). */
async function syncEmail(email) {
  try {
    return await syncUser(await admin.auth().getUserByEmail(email));
  } catch (err) {
    if (err.code === 'auth/user-not-found') return null;
    throw err;
  }
}

async function syncUid(uid) {
  try {
    return await syncUser(await admin.auth().getUser(uid));
  } catch (err) {
    if (err.code === 'auth/user-not-found') return null;
    throw err;
  }
}

const sameList = (a = [], b = []) => a.length === b.length && a.every((x) => b.includes(x));

// Akun studio ditambah/diubah/dinonaktifkan/dihapus, termasuk saat Desktop mengisi uid di login pertama
exports.onStudioAccountWrite = onDocumentWritten(
  { document: 'studioAccounts/{email}', database: DATABASE, region: REGION },
  async (event) => {
    await syncEmail(event.params.email);
  },
);

// Daftar akses Manager atau owner utama berubah. Dokumen organisasi juga sering ditulis untuk status WhatsApp,
// jadi selain kedua field itu langsung selesai.
exports.onOrganizationWrite = onDocumentWritten(
  { document: 'organizations/{orgId}', database: DATABASE, region: REGION },
  async (event) => {
    const before = event.data.before.exists ? event.data.before.data() : {};
    const after = event.data.after.exists ? event.data.after.data() : {};
    if (before.ownerId === after.ownerId && sameList(before.ownerEmails, after.ownerEmails)) return;
    const emails = new Set([...(before.ownerEmails || []), ...(after.ownerEmails || [])]);
    for (const email of emails) await syncEmail(email);
    for (const uid of new Set([before.ownerId, after.ownerId].filter(Boolean))) await syncUid(uid);
  },
);

// Dipanggil Snapme Manager & Desktop setelah login: perbarui tanda akses akun ini, lalu klien memperbarui tokennya
// bila berubah. Respons: { changed, claims }.
exports.syncAccessClaims = functions.region(REGION).https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  let uid;
  try {
    ({ uid } = await admin.auth().verifyIdToken((req.get('Authorization') || '').replace(/^Bearer /, '')));
  } catch {
    res.status(401).json({ error: 'Silakan login ulang' });
    return;
  }
  try {
    res.json(await syncUid(uid));
  } catch (err) {
    functions.logger.error('[syncAccessClaims] Gagal', err);
    res.status(500).json({ error: 'Gagal memperbarui akses' });
  }
});

exports.syncUser = syncUser;
exports.syncEmail = syncEmail;
exports.claimsFor = claimsFor;
