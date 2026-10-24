// Salinan Snapme_Desktop/src/components/layanan/useLayananData.js: ubah keduanya bersamaan.
import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { orgCollection } from './layananUtils';
import { inManagerScope } from '../../utils/managerScope';

const byOrder = (a, b) => a.order - b.order;
const namedPlace = (id, data) => ({ id, name: data.name || id, order: data.order || 0 });

// key state, koleksi Firestore, bentuk item, apakah diurutkan menurut field order,
// dan (ruangan/photobooth) key indeks semua dokumen untuk menerjemahkan id di paket/item jadi nama
const SOURCES = [
  { key: 'studios', collection: 'studios', toItem: namedPlace, sorted: true, indexKey: 'studioIndex' },
  { key: 'photobooths', collection: 'photobooths', toItem: namedPlace, sorted: true, indexKey: 'photoboothIndex' },
  {
    key: 'packages',
    collection: 'packages',
    toItem: (id, data) => ({ id, ...data, order: data.order || 0 }),
    sorted: true,
  },
  { key: 'addOns', collection: 'add_ons', toItem: (id, data) => ({ id, ...data }), sorted: false },
  { key: 'makanan', collection: 'makanan', toItem: (id, data) => ({ id, ...data }), sorted: false },
  { key: 'minuman', collection: 'minuman', toItem: (id, data) => ({ id, ...data }), sorted: false },
];

// Indeks null = belum dimuat (jangan dianggap "semua id sudah tidak ada")
const EMPTY = {
  ...Object.fromEntries(SOURCES.map(({ key }) => [key, []])),
  studioIndex: null,
  photoboothIndex: null,
};

/**
 * Data halaman Layanan (realtime): ruangan, photobooth, paket, item tambahan, makanan, minuman.
 * Daftar hanya berisi dokumen milik tim manager yang sedang dilihat (managerIds, utils/managerScope) dan yang belum diarsipkan.
 * studioIndex / photoboothIndex: { [id]: { name, active } } dari SEMUA dokumen, termasuk yang diarsipkan.
 */
export function useLayananData(orgId, managerIds, enabled) {
  const scopeKey = managerIds ? managerIds.join(',') : '';
  const [data, setData] = useState(EMPTY);

  useEffect(() => {
    if (!orgId || !enabled) return undefined;
    const scope = scopeKey ? scopeKey.split(',') : null;
    const unsubs = SOURCES.map(({ key, collection, toItem, sorted, indexKey }) =>
      onSnapshot(orgCollection(orgId, collection), (snap) => {
        const list = [];
        const index = {};
        snap.forEach((docSnap) => {
          const value = docSnap.data();
          index[docSnap.id] = { name: value.name || docSnap.id, active: !value.archived };
          if (inManagerScope(value.managerId, scope) && !value.archived) list.push(toItem(docSnap.id, value));
        });
        if (sorted) list.sort(byOrder);
        setData((prev) => ({ ...prev, [key]: list, ...(indexKey && { [indexKey]: index }) }));
      }),
    );
    return () => unsubs.forEach((unsub) => unsub());
  }, [orgId, scopeKey, enabled]);

  return data;
}
