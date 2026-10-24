
/**
 * Card standar (docs/STANDAR_UI.md §5): judul, deskripsi opsional, aksi di kanan header, lalu isi.
 * title boleh berisi ikon lucide + teks.
 */
export default function Card({ title, description, actions, className = '', children }) {
  const hasHeader = title || description || actions;
  return (
    <section className={`card${className ? ` ${className}` : ''}`}>
      {hasHeader && (
        <div className="card-header">
          <div className="card-heading">
            {title && <span className="card-title">{title}</span>}
            {description && <span className="card-description">{description}</span>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
