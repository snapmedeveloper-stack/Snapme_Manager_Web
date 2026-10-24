// Salinan Snapme_Desktop/src/constants/status.js: ubah keduanya bersamaan.
// Tone Badge per keadaan status (docs/STANDAR_UI.md §5, "Pemetaan warna role dan status").
// Halaman memetakan statusnya sendiri ke salah satu keadaan ini, bukan memilih warna sendiri.
export const STATUS_TONE = {
  waiting: 'neutral', // menunggu / belum mulai
  active: 'accent', // sedang berjalan
  done: 'success', // selesai, lunas, terkirim
  late: 'warning', // terlambat, hampir habis
  failed: 'danger', // batal, gagal
};
