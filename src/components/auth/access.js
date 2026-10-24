// Siapa yang boleh membuka Snapme Manager (docs/RENCANA_TANPA_ROLE.md W1). Owner dikenali dari
// organizations/{orgId}.ownerId, bukan dari users.role: rules tahap 1 melarang user mengubah field peran sendiri.
import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../../firebase';

/**
 * Hasil: { status: 'ok', orgId, userMeta } | { status: 'studio' } (akun studio, hanya untuk Desktop) |
 * { status: 'onboarding' } (belum punya organisasi: tebus kode owner).
 * Hanya owner (sejak tahap 4); akun manager/operator lama tidak lagi bisa masuk.
 */
export async function resolveAccess(user) {
  const userSnap = await getDoc(doc(db, 'users', user.uid));
  const meta = userSnap.exists() ? userSnap.data() : {};
  let orgId = meta.orgId || meta.defaultOrgId || meta.ownedOrgIds?.[0] || null;
  if (!orgId) {
    const owned = await getDocs(query(collection(db, 'organizations'), where('ownerId', '==', user.uid), limit(1)));
    orgId = owned.docs[0]?.id || null;
  }

  if (orgId) {
    const orgSnap = await getDoc(doc(db, 'organizations', orgId)).catch(() => null);
    if (orgSnap?.exists() && orgSnap.data().ownerId === user.uid) {
      return { status: 'ok', orgId, userMeta: { ...meta, role: 'owner' } };
    }
  }

  const studioSnap = user.email
    ? await getDoc(doc(db, 'studioAccounts', user.email.toLowerCase())).catch(() => null)
    : null;
  return { status: studioSnap?.exists() ? 'studio' : 'onboarding' };
}
