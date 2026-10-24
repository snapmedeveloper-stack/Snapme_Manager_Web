// Salinan Snapme_Desktop/src/constants/colors.js: ubah keduanya bersamaan.
// Warna kategori paket/studio (docs/STANDAR_UI.md §3.6). Nilai hex sama dengan token --cat-* di index.css.
// Yang disimpan ke Firestore tetap hex; warna lama di luar daftar ini tetap ditampilkan apa adanya.
export const CATEGORY_COLORS = [
  { value: '#0ea5e9', label: 'Biru langit' },
  { value: '#10b981', label: 'Hijau zamrud' },
  { value: '#f59e0b', label: 'Kuning amber' },
  { value: '#14b8a6', label: 'Hijau toska' },
  { value: '#f43f5e', label: 'Merah mawar' },
  { value: '#8b5cf6', label: 'Ungu' },
  { value: '#ec4899', label: 'Merah muda' },
  { value: '#94a3b8', label: 'Abu-abu' },
];

/** Warna untuk paket baru. */
export const DEFAULT_CATEGORY_COLOR = CATEGORY_COLORS[0].value;

/** Warna tampilan paket yang tidak punya field color (sama dengan fallback di Timeline & Timer). */
export const PACKAGE_FALLBACK_COLOR = '#38bdf8';
