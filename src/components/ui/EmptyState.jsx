
/**
 * Keadaan kosong (docs/STANDAR_UI.md §5): ikon lucide 32, judul, deskripsi, dan satu aksi opsional.
 */
export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="empty-state">
      {Icon && <Icon size={32} aria-hidden="true" />}
      {title && <span className="empty-state-title">{title}</span>}
      {description && <span>{description}</span>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}
