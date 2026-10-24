# Snapme Manager

Web manager/owner studio Snap Me (React 19 + Vite, Firebase, Cloud Function `generateReport`, deploy Vercel). Dipakai **terutama di HP**.

- **Standar UI & library:** [docs/STANDAR_UI.md](docs/STANDAR_UI.md). Wajib diikuti.
- **Rencana & status paket:** [docs/RENCANA_MOBILE.md](docs/RENCANA_MOBILE.md). Rombak tanpa role (Tim/absensi, akun studio, rules): [../Snapme_Desktop/docs/RENCANA_TANPA_ROLE.md](../Snapme_Desktop/docs/RENCANA_TANPA_ROLE.md).
- Database Firestore sama dengan Snapme_Desktop. File di `src/utils` dan `src/hooks` yang berkomentar "Salinan/Diambil dari Snapme_Desktop" harus diubah bersamaan dengan versi Desktop-nya.
- Warna dan ukuran hanya lewat token (`src/styles/tokens.css`). Komponen hanya dari `src/components/ui`. Ikon hanya `lucide-react`. Tidak ada `alert()`/`confirm()`.
- CSS: `styles/tokens.css` → `styles/ui.css` → CSS per halaman dengan prefix (`tl-`, `trx-`, `lyn-`, `tim-`, `profile-`). Tidak ada CSS global lain.
