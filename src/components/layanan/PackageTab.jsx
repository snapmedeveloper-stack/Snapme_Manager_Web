import { useState } from 'react';
import { Package, Plus } from 'lucide-react';
import { Button, Card, EmptyState, SortableList } from '../ui';
import { PACKAGE_FALLBACK_COLOR } from '../../constants/colors';
import { formatRupiah } from '../../utils/format';
import { nextOrder } from './layananUtils';
import { useLayananActions } from './useLayananActions';
import LocationBadges from './LocationBadges';
import PackageForm from './PackageForm';
import RowActions from './RowActions';

const DESCRIPTION = 'Paket yang dipilih saat membuat booking; warnanya menandai booking di Timeline.';

/**
 * Tab Paket Layanan (logika sama dengan PackageTab Snapme_Desktop): daftar paket, urutkan, tambah/edit lewat
 * PackageForm, arsipkan. places: { studios, photobooths, studioIndex, photoboothIndex } dari useLayananData.
 */
export default function PackageTab({ packages, places, canEdit, orgId, ownerId }) {
  const { archive, reorder } = useLayananActions(orgId);
  const [editing, setEditing] = useState(null); // null = form tertutup, { pkg: null } = paket baru
  const sortable = canEdit && packages.length > 1;

  return (
    <Card
      title="Paket Layanan"
      description={sortable ? `${DESCRIPTION} Seret pegangan untuk mengubah urutan.` : DESCRIPTION}
      actions={canEdit && <Button variant="primary" icon={Plus} iconOnly aria-label="Tambah paket" onClick={() => setEditing({ pkg: null })} />}
    >
      {packages.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Belum ada paket"
          description={canEdit ? 'Buat paket pertama lewat tombol +.' : undefined}
        />
      ) : (
        <SortableList
          items={packages}
          disabled={!canEdit}
          onReorder={(list) => reorder('packages', list)}
          className="lyn-list"
          itemClassName="lyn-row"
          renderItem={(pkg) => (
            <>
              <div className="lyn-row-main">
                <span className="lyn-row-title">
                  <span className="lyn-color" style={{ '--item-color': pkg.color || PACKAGE_FALLBACK_COLOR }} aria-hidden="true" />
                  {pkg.name}
                </span>
                <span className="lyn-row-meta num">
                  {pkg.duration || 30} menit · {pkg.price ? formatRupiah(pkg.price) : 'Harga belum diisi'}
                  {pkg.handlerFee > 0 && ` · Fee ${formatRupiah(pkg.handlerFee)}`}
                </span>
                <LocationBadges item={pkg} places={places} />
              </div>
              {canEdit && (
                <RowActions name={pkg.name} onEdit={() => setEditing({ pkg })} onArchive={() => archive('packages', pkg, 'Paket')} />
              )}
            </>
          )}
        />
      )}

      {editing && (
        <PackageForm
          pkg={editing.pkg}
          places={places}
          orgId={orgId}
          ownerId={ownerId}
          nextOrder={nextOrder(packages)}
          onClose={() => setEditing(null)}
        />
      )}
    </Card>
  );
}
