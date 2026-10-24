// Salinan Snapme_Desktop/src/utils/format.js: ubah keduanya bersamaan.
// Format angka & tanggal yang dipakai lintas halaman. Cari di sini dulu sebelum menulis helper baru.

/** 125000 → "Rp 125.000". Nilai kosong/bukan angka → "Rp 0". */
export const formatRupiah = (amount) => `Rp ${(Number(amount) || 0).toLocaleString('id-ID')}`;

/** Tanggal kalender lokal "YYYY-MM-DD" (format field `date` di booking). Menerima Date, timestamp ms, atau string tanggal. */
export const getLocalDateString = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
