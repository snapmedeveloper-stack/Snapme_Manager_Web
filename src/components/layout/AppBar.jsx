/**
 * App bar halaman (menempel di atas saat di-scroll): judul di kiri, aksi (tombol ikon) di kanan.
 * Dipakai tiap halaman yang sudah dirombak; isi halaman di bawahnya memakai .page-body.
 */
export default function AppBar({ title, actions }) {
  return (
    <header className="app-bar">
      <h1 className="app-bar-title">{title}</h1>
      {actions && <div className="app-bar-actions">{actions}</div>}
    </header>
  );
}
