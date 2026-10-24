import { useEffect, useMemo, useState } from 'react';
import { onSnapshot, query, where } from 'firebase/firestore';
import { studioAccountsCollection } from '../components/tim/timData';

/**
 * Akun studio organisasi (studioAccounts, docs/RENCANA_TANPA_ROLE.md §2) dan daftar cabangnya.
 * Cabang = managerId akun studio (satu cabang boleh punya beberapa email). Selama masa transisi, manager lama yang
 * belum didaftarkan sebagai akun studio tetap muncul sebagai cabang (legacy) supaya datanya tetap bisa dipilih.
 * - accounts: [{ id: email, orgId, managerId, name, active, uid, ... }]
 * - branches: [{ managerId, name, legacy? }] urut nama
 * - unregisteredManagers: member ber-role manager yang belum punya akun studio
 */
export function useStudioAccounts(orgId, members = []) {
  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    if (!orgId) return undefined;
    return onSnapshot(
      query(studioAccountsCollection(), where('orgId', '==', orgId)),
      (snap) => setAccounts(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setAccounts([]),
    );
  }, [orgId]);

  return useMemo(() => {
    const byBranch = new Map();
    // Nama cabang diambil dari akun aktif lebih dulu
    [...accounts]
      .sort((a, b) => Number(b.active !== false) - Number(a.active !== false))
      .forEach((a) => {
        if (!byBranch.has(a.managerId))
          byBranch.set(a.managerId, {
            managerId: a.managerId,
            name: a.name || a.id,
          });
      });
    const unregisteredManagers = members.filter((m) => m.role === 'manager' && !byBranch.has(m.uid));
    unregisteredManagers.forEach((m) =>
      byBranch.set(m.uid, {
        managerId: m.uid,
        name: m.displayName || m.email || m.uid,
        legacy: true,
      }),
    );
    const branches = [...byBranch.values()].sort((a, b) => a.name.localeCompare(b.name));
    return { accounts, branches, unregisteredManagers };
  }, [accounts, members]);
}
