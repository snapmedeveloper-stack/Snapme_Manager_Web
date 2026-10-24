// Siapa yang boleh membuka Snapme Manager (docs/RENCANA_TANPA_ROLE.md W1). Owner dikenali dari data organisasi,
// bukan dari users.role (rules melarang user mengubah field peran sendiri):
// - owner utama: organizations/{orgId}.ownerId == uid
// - akses tambahan: email login ada di organizations/{orgId}.ownerEmails (diatur owner utama di Profil)
import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../../firebase';

/** Email login ada di daftar akses tambahan organisasi ini? */
const isListed = (org, email) => !!email && (org.ownerEmails || []).includes(email);

/** Organisasi pertama hasil query, atau null. */
async function firstOrg(constraint) {
  const snap = await getDocs(query(collection(db, 'organizations'), constraint, limit(1)));
  return snap.docs[0] ? { id: snap.docs[0].id, ...snap.docs[0].data() } : null;
}

/**
 * Hasil: { status: 'ok', orgId, userMeta } | { status: 'studio' } (akun studio, hanya untuk Desktop) |
 * { status: 'onboarding' } (belum punya organisasi: tebus kode owner).
 * userMeta.role selalu 'owner'; userMeta.isPrimaryOwner membedakan owner utama (boleh mengatur akses Manager).
 */
export async function resolveAccess(user) {
  const email = user.email?.toLowerCase() || '';
  const userSnap = await getDoc(doc(db, 'users', user.uid));
  const meta = userSnap.exists() ? userSnap.data() : {};
  const ok = (org) => ({
    status: 'ok',
    orgId: org.id,
    userMeta: { ...meta, role: 'owner', isPrimaryOwner: org.ownerId === user.uid },
  });

  // Organisasi yang tercatat di profil (data lama), lalu milik akun ini, lalu yang memberi akses ke email ini
  const savedOrgId = meta.orgId || meta.defaultOrgId || meta.ownedOrgIds?.[0];
  if (savedOrgId) {
    const orgSnap = await getDoc(doc(db, 'organizations', savedOrgId)).catch(() => null);
    const org = orgSnap?.exists() ? { id: orgSnap.id, ...orgSnap.data() } : null;
    if (org && (org.ownerId === user.uid || isListed(org, email))) return ok(org);
  }
  const owned = await firstOrg(where('ownerId', '==', user.uid));
  if (owned) return ok(owned);
  if (email) {
    const shared = await firstOrg(where('ownerEmails', 'array-contains', email));
    if (shared) return ok(shared);
  }

  const studioSnap = email ? await getDoc(doc(db, 'studioAccounts', email)).catch(() => null) : null;
  return { status: studioSnap?.exists() ? 'studio' : 'onboarding' };
}
