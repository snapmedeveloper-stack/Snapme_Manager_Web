// Uji storage.rules di Storage Emulator (bagian dari npm test, lihat README.md). Peran dibaca dari tanda di token
// (snapmeOrg, snapmeRole) yang diisi Cloud Function accessClaims.js.
import fs from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { ref, uploadBytes, getBytes, getDownloadURL, deleteObject } from 'firebase/storage';

const env = await initializeTestEnvironment({
  projectId: 'demo-snapme',
  storage: { rules: fs.readFileSync(new URL('../../storage.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 9199 },
});

const O = 'org1';
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const img = { contentType: 'image/png' };
const pdf = { contentType: 'application/pdf' };

await env.withSecurityRulesDisabled(async (ctx) => {
  await uploadBytes(ref(ctx.storage(), `organizations/${O}/templates/assets/a.png`), png, img);
  await uploadBytes(ref(ctx.storage(), `organizations/${O}/add_ons/p.png`), png, img);
});

const as = (uid, claims) => env.authenticatedContext(uid, { email_verified: true, ...claims }).storage();
const owner = as('owner', { email: 'owner@x.com', snapmeOrg: O, snapmeRole: 'owner' });
const studio = as('stu', { email: 'studio@x.com', snapmeOrg: O, snapmeRole: 'studio' });
const otherOrg = as('lain', { email: 'lain@x.com', snapmeOrg: 'org2', snapmeRole: 'owner' });
const noClaim = as('rnd', { email: 'random@gmail.com' });
const admin = as('adm', { email: 'bakmiekt@gmail.com' });
const anon = env.unauthenticatedContext().storage();

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
const at = (storage, path) => ref(storage, `organizations/${O}/${path}`);

await t('owner unggah foto produk', true, () => uploadBytes(at(owner, 'add_ons/baru.png'), png, img));
await t('owner unggah aset template', true, () => uploadBytes(at(owner, 'templates/assets/b.png'), png, img));
await t('owner ambil URL gambar', true, () => getDownloadURL(at(owner, 'add_ons/p.png')));
await t('owner hapus foto produk', true, () => deleteObject(at(owner, 'add_ons/baru.png')));
await t('owner unggah file bukan gambar', false, () => uploadBytes(at(owner, 'add_ons/x.pdf'), png, pdf));
await t('studio unggah aset template (Desktop)', true, () => uploadBytes(at(studio, 'templates/assets/c.png'), png, img));
await t('studio unggah thumbnail template', true, () => uploadBytes(at(studio, 'templates/thumbnails/t.png'), png, img));
await t('studio baca gambar template', true, () => getBytes(at(studio, 'templates/assets/a.png')));
await t('studio unggah foto produk', false, () => uploadBytes(at(studio, 'add_ons/s.png'), png, img));
await t('studio hapus foto produk', false, () => deleteObject(at(studio, 'add_ons/p.png')));
await t('owner org lain baca gambar', false, () => getBytes(at(otherOrg, 'templates/assets/a.png')));
await t('owner org lain unggah', false, () => uploadBytes(at(otherOrg, 'templates/assets/z.png'), png, img));
await t('akun tanpa tanda akses unggah', false, () => uploadBytes(at(noClaim, 'templates/assets/z.png'), png, img));
await t('akun tanpa tanda akses baca', false, () => getBytes(at(noClaim, 'templates/assets/a.png')));
await t('tanpa login baca', false, () => getBytes(at(anon, 'templates/assets/a.png')));
await t('unggah di luar folder organisasi', false, () => uploadBytes(ref(owner, 'lain/x.png'), png, img));
await t('admin unggah', true, () => uploadBytes(at(admin, 'templates/assets/adm.png'), png, img));

console.log(`Storage rules: LULUS ${pass} / ${pass + fails.length}`);
fails.forEach((f) => console.log('  ✗', f));
await env.cleanup();
process.exit(fails.length ? 1 : 0);
