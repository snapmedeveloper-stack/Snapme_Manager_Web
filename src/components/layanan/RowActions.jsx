// Diambil dari Snapme_Desktop/src/components/layanan/RowActions.jsx; tombol ukuran normal (Desktop: sm) untuk sentuh.
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '../ui';

/** Tombol edit & arsipkan di ujung kanan baris daftar Layanan. onEdit opsional. */
export default function RowActions({ name, onEdit, onArchive }) {
  return (
    <div className="lyn-row-actions">
      {onEdit && (
        <Button
          variant="ghost"
          iconOnly
          icon={Pencil}
          aria-label={`Edit ${name}`}
          title="Edit"
          onClick={onEdit}
        />
      )}
      <Button
        variant="ghost"
        iconOnly
        icon={Trash2}
        aria-label={`Arsipkan ${name}`}
        title="Arsipkan"
        onClick={onArchive}
      />
    </div>
  );
}
