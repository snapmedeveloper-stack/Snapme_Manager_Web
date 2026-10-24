// Uji logika tanda akses (functions/accessClaims.js) terhadap Auth & Firestore Emulator (bagian dari npm test).
// Memakai firebase-admin milik folder functions supaya sama persis dengan yang di-deploy.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../functions/index.js', import.meta.url));
const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'demo-snapme' });
const { getFirestore } = require('firebase-admin/firestore');
const { syncUser, syncEmail } = require('./accessClaims.js');

const db = getFirestore(admin.app(), 'default');
const auth = admin.auth();
const claimsOf = async (uid) => {
  const c = (await auth.getUser(uid)).customClaims || {};
  return { snapmeOrg: c.snapmeOrg, snapmeRole: c.snapmeRole };
};
const none = { snapmeOrg: undefined, snapmeRole: undefined };

let pass = 0;
const fails = [];
async function t(name, fn) {
  try {
    await fn();
    pass += 1;
  } catch (e) {
    fails.push(`${name} — ${e.message.split('\n')[0]}`);
  }
}

const mk = (uid, email, emailVerified = true) => auth.createUser({ uid, email, emailVerified });
await mk('owner', 'owner@x.com');
await mk('wakil', 'wakil@x.com');
await mk('stu', 'studio@x.com');
await mk('asing', 'asing@x.com');
await mk('palsu', 'palsu@x.com', false);
await auth.setCustomUserClaims('asing', { lain: 'tetap' });
await db.doc('organizations/org1').set({ ownerId: 'owner', ownerEmails: ['wakil@x.com', 'palsu@x.com'] });
await db.doc('studioAccounts/studio@x.com').set({ orgId: 'org1', managerId: 'm1', active: true });

await t('owner utama dapat tanda owner', async () => {
  await syncUser(await auth.getUser('owner'));
  assert.deepEqual(await claimsOf('owner'), { snapmeOrg: 'org1', snapmeRole: 'owner' });
});
await t('akses Manager tambahan dapat tanda owner', async () => {
  await syncEmail('wakil@x.com');
  assert.deepEqual(await claimsOf('wakil'), { snapmeOrg: 'org1', snapmeRole: 'owner' });
});
await t('akun studio dapat tanda studio', async () => {
  await syncEmail('studio@x.com');
  assert.deepEqual(await claimsOf('stu'), { snapmeOrg: 'org1', snapmeRole: 'studio' });
});
await t('email belum terverifikasi tidak dapat tanda', async () => {
  await syncEmail('palsu@x.com');
  assert.deepEqual(await claimsOf('palsu'), none);
});
await t('akun asing tanpa akses: claim lain tetap, tanpa tanda Snap Me', async () => {
  await syncEmail('asing@x.com');
  assert.deepEqual(await claimsOf('asing'), none);
  assert.equal((await auth.getUser('asing')).customClaims.lain, 'tetap');
});
await t('sinkron ulang tanpa perubahan tidak menulis', async () => {
  const res = await syncUser(await auth.getUser('owner'));
  assert.equal(res.changed, false);
});
await t('akun studio dinonaktifkan: tanda dicabut', async () => {
  await db.doc('studioAccounts/studio@x.com').update({ active: false });
  await syncEmail('studio@x.com');
  assert.deepEqual(await claimsOf('stu'), none);
});
await t('akses Manager dicabut: tanda dicabut', async () => {
  await db.doc('organizations/org1').update({ ownerEmails: [] });
  await syncEmail('wakil@x.com');
  assert.deepEqual(await claimsOf('wakil'), none);
});
await t('email belum pernah login dilewati', async () => {
  assert.equal(await syncEmail('belum@x.com'), null);
});

console.log(`Tanda akses (Cloud Function): LULUS ${pass} / ${pass + fails.length}`);
fails.forEach((f) => console.log('  ✗', f));
process.exit(fails.length ? 1 : 0);
