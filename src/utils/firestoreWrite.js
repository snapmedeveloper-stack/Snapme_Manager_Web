// Salinan Snapme_Desktop/src/utils/firestoreWrite.js: ubah keduanya bersamaan.
/**
 * Jalankan tulisan Firestore tanpa menunggu konfirmasi server (pola yang sama dengan Kasir): perubahan lokal langsung
 * tampil lewat snapshot, dan saat offline UI tidak tertahan sampai koneksi kembali. Gagal → onError(err).
 */
export function writeInBackground(write, onError) {
  Promise.resolve().then(write).catch(onError);
}
