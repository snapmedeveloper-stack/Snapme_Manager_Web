// Salinan Snapme_Desktop/src/utils/managerScope.js: ubah keduanya bersamaan.
// Ruang lingkup data per manager (keputusan pemilik Paket 10, 2026-10-08).
// Data (booking, paket, ruangan, …) menyimpan pemiliknya di field managerId. Data buatan operator dari jendela utama
// dulu tersimpan atas nama operator itu sendiri, jadi "data manager X" = milik X + milik operator di bawah X.

/** Batas nilai untuk query Firestore `in`. */
export const MAX_SCOPE_IDS = 30;

/**
 * uid yang termasuk tim manager: manager itu, operator yang managedBy-nya manager itu, dan selfUid (operator yang
 * sedang login, untuk berjaga bila daftar anggota tidak bisa dibaca). managerId kosong = tanpa filter (null).
 */
export function managerTeamIds(managerId, members = [], selfUid = null) {
  if (!managerId) return null;
  const ids = new Set([managerId]);
  if (selfUid) ids.add(selfUid);
  members.forEach((m) => {
    if (m.managedBy === managerId) ids.add(m.uid);
  });
  return [...ids].slice(0, MAX_SCOPE_IDS);
}

/** Apakah data dengan pemilik ownerId termasuk lingkup yang sedang dilihat? managerIds null = semua. */
export const inManagerScope = (ownerId, managerIds) => !managerIds || managerIds.includes(ownerId);
