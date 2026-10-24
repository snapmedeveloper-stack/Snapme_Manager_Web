# Rencana Snapme Manager versi Mobile

Tujuan: Snapme Manager nyaman dipakai di HP seperti aplikasi, dengan navbar bawah (**Timeline · Transaksi · Layanan · Profil**), desain seragam ([STANDAR_UI.md](STANDAR_UI.md)), library ramping, dan alur kerja yang sama dengan Snapme_Desktop karena keduanya memakai Firestore yang sama.

## Keputusan pemilik (24 Oktober 2026)

- Dashboard dihapus.
- Tema terang saja.
- Timeline di HP: default tampilan **agenda**, timeline horizontal sebagai opsi.
- Menu Pengaturan di Profil disediakan dulu dalam keadaan kosong, lalu dikembangkan nanti.

## Paket

| Paket | Isi | Status |
|---|---|---|
| P1 Sinkron & keamanan | Utilitas Desktop (`bookingStage`, `managerScope`, `timeline`, `format`, `phone`, `useTransactions`). Edit booking hanya menulis field yang berubah. Cek bentrok jadwal. Filter per tim manager. Owner hanya bisa melihat Layanan. Fallback organisasi dihapus. Cloud Function wajib login. Dashboard dihapus | Selesai 2026-10-24 (belum commit; function belum di-deploy) |
| P2 Fondasi desain | Token terang (`styles/tokens.css`), elemen standar (`styles/ui.css`), komponen `components/ui`, font Inter lokal, logo & favicon brand, `legacy.css` + alias, pangkas 5 library, hapus file mati, layar Login/Memuat/Akses ditolak memakai komponen baru | Selesai 2026-10-24 |
| P3 Shell mobile | App bar + navbar bawah 4 menu (rail/sidebar di layar lebar), safe-area, manifest PWA (Add to Home Screen), halaman Profil berisi profil, role, logout, dan Pengaturan kosong. Hapus Sidebar/Layout lama. Halaman dimuat per rute (`React.lazy`) supaya recharts hanya dimuat di Transaksi | Selesai 2026-10-24. JS awal 1,19 MB → 611 KB; Layanan hanya untuk owner/manager |
| P4 Timeline | Tampilan agenda (strip tanggal, daftar per ruangan, tombol + mengambang, detail di bottom sheet). Timeline horizontal sebagai opsi. Pecah file seperti `components/timeline` di Desktop | Selesai 2026-10-24. Pilihan tampilan diingat per perangkat (`snapme.timeline.view`). Ditambahkan agar setara Desktop: item tambahan di form, tahap proses & status datang/WA di detail, kunci nama setelah folder Drive dibuat, "Sesuaikan paket" saat pindah ruangan, owner hanya melihat. Sengaja tidak dibawa (butuh PC studio): Mulai sekarang/tandai datang, salin caption & kirim WA, status file lokal, undo/redo keyboard |
| P5 Transaksi | Ringkasan periode di atas, filter berupa chip, kartu transaksi ringkas, laporan PDF tetap lewat Cloud Function | Selesai 2026-10-24. Data & rekap memakai salinan Desktop (`hooks/useTransaksiData`, `utils/transactions`, `utils/receipt`); kategori rekap ikut Desktop (paket/tambahan/cetak/lainnya). recharts dihapus, grafik waktu sibuk jadi batang CSS (chunk 400 → 21 KB). Nota dicetak lewat browser (isi di-escape, lebar kertas dari pengaturan kasir). Chat WA lewat wa.me. Layout cetak tersembunyi sisa html2pdf dihapus. Minggu tetap mulai Senin (Desktop: Minggu) |
| P6 Layanan | Struktur Desktop (Ruangan, Photobooth, Paket, Item Tambahan, Makanan, Minuman + stok), owner hanya bisa melihat, `ColorPicker` 8 warna, `SortableList` dengan dukungan sentuh, hapus `@hello-pangea/dnd`, bereskan toggle Timer yang mati | Selesai 2026-10-24. Logika & form salinan Desktop (`components/layanan`: layananUtils, useLayananData, useLayananActions, PackageForm, ProductForm, LocationPicker). Baris bertumpuk untuk HP, bagian halaman berupa `.chip-row`. `SortableList` versi pointer (jalan di sentuh). Timer ruangan berfungsi (`useStudioTimers`, field `timerEnabled`, owner boleh). Makanan & Minuman + stok ditambahkan. Gambar produk disimpan di path Storage Desktop. `@hello-pangea/dnd` dan seluruh CSS lama (`legacy.css` + alias) dihapus; lint seluruh `src` bersih |
| P7 Profil & bersih-bersih | Pemilih manager untuk owner (Desktop: owner bisa memilih manager yang dilihat), cek ukuran bundle (624 KB, sebagian besar Firebase) | Selesai 2026-10-24. Pemilih "Data yang dilihat" di Profil (khusus owner), diingat per perangkat (`snapme.owner.viewManager`; Desktop tidak menyimpan). README ditulis ulang. ESLint mengenali `functions/` sebagai Node; `npm run lint` bersih untuk seluruh projek. Bundle awal 195 KB gzip (Firestore + Auth; Storage SDK sengaja tetap di chunk utama karena `firebase.js`/`ProductForm` salinan Desktop) |

## Belum dikerjakan / keputusan terbuka

- **Commit & deploy:** semua paket masih di branch `p1-sinkron-desktop`, belum di-commit. Urutan deploy: web (Vercel) dulu, lalu `firebase deploy --only functions`.
- **Awal minggu:** Manager mulai Senin, Desktop mulai Minggu ("Minggu ini" bisa berbeda di hari Minggu).
- **Pengaturan** di Profil masih kosong (sesuai keputusan pemilik).
- **Firestore rules** belum tersimpan di repo mana pun; pengecekan role di Manager hanya di sisi tampilan.

## Cara verifikasi tiap paket

1. `npm run build` dan `npx eslint <file yang diubah>`: tidak boleh ada error baru dibanding sebelum perubahan.
2. Dev server (`npm run dev -- --host`), buka dari HP di jaringan yang sama, login.
3. Database adalah **produksi** dan dipakai bersama Desktop. Uji tulis memakai booking/transaksi uji, lalu hapus lagi.
