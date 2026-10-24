# Snapme Manager

Web untuk owner & manager studio Snap Me: memantau dan mengelola **Timeline** (jadwal booking), **Transaksi**, dan **Layanan** (ruangan, paket, produk) dari HP. Bisa dipasang ke layar utama (PWA).

Memakai database Firestore yang sama dengan Snapme Desktop (`snapme-database`, database `default`), jadi perubahan di sini langsung terlihat di PC studio, dan sebaliknya.

## Menjalankan

```bash
npm install
npm run dev            # http://localhost:5173
npm run dev -- --host  # bisa dibuka dari HP di Wi-Fi yang sama
npm run build          # hasil di dist/
npm run lint
```

Login memakai akun Google yang sudah terdaftar di organisasi lewat Snapme Desktop. **Database-nya produksi**, jadi uji tulis memakai data uji lalu hapus lagi.

## Deploy

- **Web:** Vercel (`vercel.json` mengarahkan semua rute ke `index.html`).
- **Cloud Function `generateReport`** (laporan PDF Transaksi, `functions/`, Node 20, region `asia-southeast2`): `firebase deploy --only functions`. Function ini mewajibkan token login (header `Authorization: Bearer`). Deploy web lebih dulu bila klien lama belum mengirim token.

## Struktur

| Folder | Isi |
|---|---|
| `src/pages/` | Halaman: Timeline, Transaksi, Layanan, Profil (+ CSS masing-masing) |
| `src/components/layout/` | Kerangka: navbar bawah / rail samping, app bar |
| `src/components/ui/` | Komponen standar (tombol, modal/bottom sheet, toast, dll.) |
| `src/components/timeline/`, `transaksi/`, `layanan/` | Bagian per halaman |
| `src/utils/`, `src/hooks/`, `src/constants/` | Logika bersama. Banyak yang **salinan Snapme_Desktop** (lihat komentar baris pertama): ubah keduanya bersamaan |
| `src/styles/` | `tokens.css` (warna & ukuran), `ui.css` (elemen standar) |
| `functions/` | Cloud Function laporan PDF |

## Dokumen

- [docs/STANDAR_UI.md](docs/STANDAR_UI.md): standar warna, ukuran, komponen, dan library. Wajib diikuti.
- [docs/RENCANA_MOBILE.md](docs/RENCANA_MOBILE.md): rencana & status perombakan versi mobile.
