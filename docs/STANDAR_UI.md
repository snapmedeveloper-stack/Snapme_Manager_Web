# Standar UI & Library Snapme Manager

Snapme Manager adalah web untuk manager/owner yang dipakai **terutama di HP**. Standar ini diturunkan dari [Snapme_Desktop/docs/STANDAR_UI.md](../../Snapme_Desktop/docs/STANDAR_UI.md) supaya kedua aplikasi terasa satu keluarga. Bagian yang tidak disebut di sini mengikuti dokumen Desktop. Yang berbeda hanya penyesuaian untuk layar sentuh (§3).

- **Disahkan:** 24 Oktober 2026 (Paket P2).
- **Tema:** terang saja. Tidak ada tema gelap.

---

## 1. Prinsip

1. **Satu sumber warna dan ukuran:** token di `src/styles/tokens.css`. Di JSX tidak boleh ada hex, `rgba()`, atau ukuran piksel acak.
2. **Satu set komponen:** `src/components/ui`. Halaman tidak membuat tombol, modal, toast, atau badge versinya sendiri.
3. **Satu aksen:** biru logo Snap Me `#0058b3`. Status memakai hijau/kuning/merah dari token. Gradient, glow, dan emoji sebagai ikon tidak dipakai.
4. **HP dulu:** target sentuh minimal 40px, isian 16px, modal tampil sebagai bottom sheet, dan area aman (poni/home bar) dihormati.
5. **Logika data sama dengan Desktop:** fungsi murni di `src/utils` dan `src/hooks` adalah salinan Desktop (lihat komentar di baris pertama tiap file). Ubah keduanya bersamaan.

## 2. Token warna

Nilainya sama dengan **tema terang** Desktop (§3 dokumen Desktop).

| Token | Nilai | Pakai untuk |
|---|---|---|
| `--bg-base` | `#f1f5f9` | Latar aplikasi |
| `--bg-surface` / `--bg-card` | `#ffffff` | Panel, card, modal |
| `--bg-hover` / `--bg-active` | `#eef2f7` / `#e3edf9` | Hover, item terpilih |
| `--border-subtle` / `--border-strong` | `#e2e8f0` / `#cbd5e1` | Garis pemisah / tepi input & tombol |
| `--text-primary` / `--text-secondary` / `--text-muted` | `#0f172a` / `#475569` / `#5b6b82` | Teks utama / label / keterangan |
| `--accent-primary` / `--accent-subtle` | `#0058b3` / 10% | Tombol utama, link, nav aktif / latar badge & nav aktif |
| `--success` / `--warning` / `--danger` (+ `-subtle`) | `#047857` / `#b45309` / `#b91c1c` | Selesai, lunas / menunggu / gagal, hapus |
| `--cat-*` (8 warna) | sama dengan Desktop | **Hanya** penanda paket/studio (data), bukan UI |

Semua kombinasi teks sudah lolos kontras AA (dihitung di dokumen Desktop §3.5).

## 3. Tipografi, spasi, ukuran (penyesuaian sentuh)

| Token | Manager | Desktop | Alasan |
|---|---|---|---|
| `--fs-base` | **14px** | 13px | Teks default lebih mudah dibaca di HP |
| `--fs-md` / `--fs-lg` / `--fs-display` | 15 / 17 / 28px | 14 / 16 / 32px | Mengikuti dasar 14px |
| `--fs-input` | **16px** | — | Safari iOS memperbesar halaman bila isian < 16px |
| `--control-h` / `-sm` / `-lg` | **40 / 32 / 48px** | 32 / 28 / 40px | Target sentuh |
| `--radius-xl` | 16px | — | Sudut atas bottom sheet |
| `--appbar-h` / `--bottomnav-h` | 56 / 64px | — | Kerangka mobile (P3) |
| `--page-gutter` | 16px (≥768px: 24px) | 24px | Jarak tepi halaman |
| `--safe-top` / `--safe-bottom` | `env(safe-area-inset-*)` | — | Poni & home bar iPhone |

Skala lain sama dengan Desktop: `--fs-xs` 11, `--fs-sm` 12, `--fs-xl` 20; spasi `--space-1…6` = 4/8/12/16/24/32; radius 6/8/12/full.

- **Font:** Inter saja, di-host sendiri (`src/assets/fonts`), tanpa Google Fonts.
- **Angka** (jam, harga): class `.num` (`tabular-nums`).
- **Hover** hanya aktif di perangkat yang punya hover (`@media (hover: hover)`), supaya warna tidak menempel setelah disentuh.

## 4. Komponen (`src/components/ui`)

Import dari `../components/ui`. API-nya sama dengan Desktop.

| Komponen / hook | Pakai untuk |
|---|---|
| `Button` | Semua tombol. `variant` default/primary/ghost/danger, `size` sm/md/lg, `icon` (lucide), `iconOnly` + `aria-label`, `loading`, `block` |
| `Badge` | Status & role (`tone` neutral/accent/success/warning/danger) |
| `Card` | Panel konten (`title`, `description`, `actions`) |
| `Tabs` | Segmented control (`options`, `value`, `onChange`, `ariaLabel`) |
| `Select` | Dropdown (`onChange(nilai)`) |
| `Switch` | Saklar on/off |
| `TimeInput` | Isian jam 24 jam "HH:MM" (`value`, `onChange(nilai)`, keyboard angka di HP). Jangan pakai `<input type="time">`, yang tampil AM/PM bila bahasa HP bukan Indonesia |
| `SortableList` | Daftar yang urutannya diubah (`items`, `renderItem`, `onReorder`). API sama dengan Desktop, tetapi menyeret memakai pointer event pada pegangan, sehingga jalan di layar sentuh (Desktop memakai HTML5 drag & drop). Panah atas/bawah pada pegangan juga bisa |
| `ColorPicker` | 8 warna kategori paket (`--cat-*`) |
| `Modal` | Semua dialog. Di layar ≤640px otomatis jadi **bottom sheet**, dengan tombol footer selebar layar |
| `Spinner`, `EmptyState`, `Avatar` | Memuat, keadaan kosong, foto/inisial |
| `useToast()` | `toast.success/info/warning/error(judul, detail?)`, pengganti `alert()`. Tampil di tengah atas di HP |
| `useConfirm()` | `await confirm({ title, message, confirmText, destructive })`, pengganti `window.confirm()` |

Class CSS yang boleh dipakai langsung: `.form-group`, `.form-stack`, `.form-hint`, `.form-error`, `.input`, `.textarea`, `.page-header`, `.page-title`, `.page-subtitle`, `.list-item`, `.dot`, `.num`, `.screen-center`, `.chip-row` + `.chip` (pilihan tunggal yang banyak, di-scroll ke samping: periode Transaksi, bagian Layanan).

Komponen Desktop yang tidak di-port karena belum dibutuhkan: `SideNav` (di HP diganti `.chip-row`), `PromptDialog`.

**Ikon:** hanya `lucide-react`. Ukuran 16 di teks/tombol, 20–22 di navbar bawah, 32 di empty state. SVG manual dan emoji sebagai ikon tidak dipakai.

## 5. Aturan halaman

**Kerangka** (`src/components/layout`, sejak P3):

- `AppShell` menampilkan navbar bawah di HP dan rail samping di layar ≥1024px. Menunya Timeline · Transaksi · Layanan · Tim (owner/manager saja) · Profil. Halaman dirender di `.app-content`, yang setinggi sisa layar dan di-scroll sendiri.
- Halaman yang sudah dirombak dimulai dengan `<AppBar title actions />` (menempel di atas), lalu isinya di `.page-body` (jarak tepi `--page-gutter`, lebar maksimum 720px). Contohnya: `pages/Profil.jsx`.
- Halaman dimuat per rute (`React.lazy` di `App.jsx`). Library besar yang hanya dipakai satu halaman tidak boleh di-import dari kerangka.

- Gaya ditulis di CSS (file CSS halaman di samping file `.jsx`-nya, atau `styles/ui.css` bila dipakai bersama). `style={{}}` hanya untuk nilai dinamis, misalnya posisi blok Timeline atau warna paket dari data.
- `alert()`, `confirm()`, dan `prompt()` tidak dipakai; ganti dengan `useToast` / `useConfirm`.
- Lapisan memakai `--z-nav` (100), `--z-overlay` (1000), `--z-toast` (1100).
- Semua teks UI dalam Bahasa Indonesia.

## 6. Library

| Status | Paket | Catatan |
|---|---|---|
| Dipakai | `react`, `react-dom`, `react-router-dom`, `firebase`, `lucide-react` | Sama dengan Desktop |
| Dihapus di P2 | `puppeteer`, `html2canvas`, `html2pdf.js`, `jspdf`, `jspdf-autotable` | Tidak dirujuk. PDF laporan dibuat Cloud Function (`pdfkit`) |
| Dihapus di P5 | `recharts` | Sama dengan keputusan Desktop (2026-10-07). Grafik waktu sibuk Transaksi memakai batang CSS (`components/transaksi/BusyChart.jsx`) |
| Dihapus di P6 | `@hello-pangea/dnd` | Urutan di Layanan memakai `SortableList` |

Library baru hanya ditambahkan bila dipakai di lebih dari satu tempat atau menggantikan kode buatan sendiri yang rumit. Catat di tabel ini.

## 7. CSS

Hanya ada tiga lapis: `styles/tokens.css` (token), `styles/ui.css` (dasar & elemen standar), lalu CSS per halaman/kerangka (`pages/*.css`, `components/layout/layout.css`). Class halaman memakai prefix halamannya (`tl-`/`tlh-` Timeline, `trx-` Transaksi, `lyn-` Layanan, `tim-` Tim, `profile-` Profil).

CSS lama (`index.css`, lalu `styles/legacy.css` beserta alias token lama) sudah dihapus seluruhnya di P6 (2026-10-24), setelah semua halaman dirombak.
