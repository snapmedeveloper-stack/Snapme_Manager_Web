// Salinan Snapme_Desktop/src/components/layanan/useLayananActions.js: ubah keduanya bersamaan.
import { useConfirm, useToast } from '../ui';
import { writeInBackground } from '../../utils/firestoreWrite';
import { archiveDoc, saveOrder } from './layananUtils';

/** Aksi yang sama di semua tab Layanan: arsipkan (dengan konfirmasi) dan simpan urutan hasil drag & drop. */
export function useLayananActions(orgId) {
  const toast = useToast();
  const confirm = useConfirm();

  const archive = async (collectionName, item, label) => {
    const ok = await confirm({
      title: `Arsipkan ${label.toLowerCase()}?`,
      message: `"${item.name}" tidak muncul lagi di pilihan Timeline dan Kasir. Data booking & transaksi lama tetap aman.`,
      confirmText: 'Arsipkan',
      destructive: true,
    });
    if (!ok) return;
    writeInBackground(
      () => archiveDoc(orgId, collectionName, item.id),
      (err) =>
        toast.error(`Gagal mengarsipkan ${label.toLowerCase()}`, `${item.name}: ${err.message}`, { persistent: true }),
    );
    toast.success(`${label} diarsipkan`, item.name);
  };

  // Dipakai sebagai onReorder SortableList: error dilempar ulang supaya urutan di layar dikembalikan
  const reorder = async (collectionName, items) => {
    try {
      await saveOrder(orgId, collectionName, items);
    } catch (err) {
      toast.error('Gagal mengubah urutan', err.message);
      throw err;
    }
  };

  return { archive, reorder };
}
