// Salinan Snapme_Desktop/src/components/layanan/layananUtils.js: ubah keduanya bersamaan.
import { collection, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { Camera, CupSoda, DoorOpen, PackagePlus, UtensilsCrossed } from 'lucide-react';
import { db } from '../../firebase';

export const orgCollection = (orgId, name) => collection(db, 'organizations', orgId, name);
export const orgDoc = (orgId, name, id) => doc(db, 'organizations', orgId, name, id);

/** Simpan urutan tampilan sebagai field order 0..n-1 dalam satu batch, supaya daftar tidak berkedip. */
export function saveOrder(orgId, name, items) {
  const batch = writeBatch(db);
  items.forEach((item, index) => batch.update(orgDoc(orgId, name, item.id), { order: index }));
  return batch.commit();
}

/** Hapus = arsipkan; dokumennya tetap ada untuk riwayat booking & transaksi. */
export const archiveDoc = (orgId, name, id) => updateDoc(orgDoc(orgId, name, id), { archived: true });

/** Ruangan & photobooth: daftar nama yang menjadi kolom di Timeline. */
export const PLACE_KINDS = {
  ruangan: {
    collection: 'studios',
    label: 'Ruangan',
    icon: DoorOpen,
    description: 'Ruangan studio yang menjadi kolom jadwal di Timeline.',
  },
  photobooth: {
    collection: 'photobooths',
    label: 'Photobooth',
    icon: Camera,
    description: 'Photobooth yang menjadi kolom jadwal tersendiri di Timeline.',
  },
};

/** Produk yang dijual di Kasir & Timeline. Makanan/minuman punya stok; item tambahan punya lokasi berlaku. */
export const PRODUCT_KINDS = {
  addon: {
    collection: 'add_ons',
    label: 'Item Tambahan',
    icon: PackagePlus,
    description: 'Produk tambahan opsional untuk customer, mis. Extra Print atau Soft Copy.',
    hasStock: false,
    hasLocations: true,
  },
  makanan: {
    collection: 'makanan',
    label: 'Makanan',
    icon: UtensilsCrossed,
    description: 'Makanan yang dijual di Kasir beserta stoknya.',
    hasStock: true,
    hasLocations: false,
  },
  minuman: {
    collection: 'minuman',
    label: 'Minuman',
    icon: CupSoda,
    description: 'Minuman yang dijual di Kasir beserta stoknya.',
    hasStock: true,
    hasLocations: false,
  },
};

/** order untuk dokumen baru: setelah order terbesar (jumlah item bisa lebih kecil bila ada yang diarsipkan). */
export const nextOrder = (items) => Math.max(-1, ...items.map((item) => item.order)) + 1;

/**
 * Id ruangan/photobooth yang masih berlaku: dokumennya ada dan belum diarsipkan (Timeline mencocokkan lewat id).
 * index null (belum dimuat) → id dikembalikan apa adanya supaya tidak ada yang terhapus saat disimpan.
 */
export const activeIds = (ids = [], index) => (index ? ids.filter((id) => index[id]?.active) : ids);

/**
 * Pilihan lokasi awal di form: hanya id yang masih aktif (id lama tidak ikut tersimpan lagi).
 * removed = jumlah id lama yang dilepas, untuk peringatan di form.
 */
export function initialLocations(item, places) {
  const studios = activeIds(item?.studios, places.studioIndex);
  const photobooths = activeIds(item?.photobooths, places.photoboothIndex);
  const before = (item?.studios?.length || 0) + (item?.photobooths?.length || 0);
  return { studios, photobooths, removed: before - studios.length - photobooths.length };
}

/**
 * Lokasi paket/item untuk ditampilkan. everywhere: tidak memilih apa pun = berlaku di semua.
 * names: nama lokasi yang masih aktif; id lama (diarsipkan / sudah tidak ada) tidak ikut ditampilkan.
 */
export function describeLocations(item, studioIndex, photoboothIndex) {
  const studioIds = item.studios || [];
  const photoboothIds = item.photobooths || [];
  if (!studioIds.length && !photoboothIds.length) return { everywhere: true, names: [] };
  if (!studioIndex || !photoboothIndex) return { everywhere: false, names: [], loading: true };
  const names = [
    ...activeIds(studioIds, studioIndex).map((id) => studioIndex[id].name),
    ...activeIds(photoboothIds, photoboothIndex).map((id) => photoboothIndex[id].name),
  ];
  return { everywhere: false, names };
}

/** Apakah paket/item muncul di ruangan/photobooth ini di Timeline (aturan yang sama dengan form booking). */
export function isAvailableAt(item, kind, placeId) {
  const own = (kind === 'ruangan' ? item.studios : item.photobooths) || [];
  const other = (kind === 'ruangan' ? item.photobooths : item.studios) || [];
  return own.length ? own.includes(placeId) : !other.length;
}
