import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Badge, Button, Card, EmptyState } from '../ui';
import { formatRupiah } from '../../utils/format';
import { PRODUCT_KINDS } from './layananUtils';
import { useLayananActions } from './useLayananActions';
import LocationBadges from './LocationBadges';
import ProductForm from './ProductForm';
import ProductThumb from './ProductThumb';
import RowActions from './RowActions';

/**
 * Tab Item Tambahan / Makanan / Minuman (logika sama dengan ProductTab Snapme_Desktop): daftar produk, tambah/edit
 * lewat ProductForm, arsipkan. Makanan & minuman menampilkan stok (dikurangi Kasir saat terjual).
 */
export default function ProductTab({ kind, items, places, canEdit, orgId, ownerId }) {
  const { collection: collectionName, label, icon, description, hasStock, hasLocations } = PRODUCT_KINDS[kind];
  const { archive } = useLayananActions(orgId);
  const [editing, setEditing] = useState(null); // null = form tertutup, { item: null } = produk baru

  return (
    <Card
      title={label}
      description={description}
      actions={canEdit && <Button variant="primary" icon={Plus} iconOnly aria-label={`Tambah ${label}`} onClick={() => setEditing({ item: null })} />}
    >
      {items.length === 0 ? (
        <EmptyState
          icon={icon}
          title={`Belum ada ${label.toLowerCase()}`}
          description={canEdit ? 'Tambahkan lewat tombol +.' : undefined}
        />
      ) : (
        <ul className="lyn-list">
          {items.map((item) => (
            <li key={item.id} className="lyn-row">
              <ProductThumb src={item.image} />
              <div className="lyn-row-main">
                <span className="lyn-row-title">{item.name}</span>
                <span className="lyn-row-meta num">
                  {item.price ? formatRupiah(item.price) : 'Gratis'}
                  {hasStock && (item.stock > 0 ? ` · Stok ${item.stock}` : '')}
                </span>
                {hasStock && !(item.stock > 0) && (
                  <span className="lyn-badges">
                    <Badge tone="danger">Stok habis</Badge>
                  </span>
                )}
                {hasLocations && <LocationBadges item={item} places={places} />}
              </div>
              {canEdit && (
                <RowActions
                  name={item.name}
                  onEdit={() => setEditing({ item })}
                  onArchive={() => archive(collectionName, item, label)}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <ProductForm
          kind={kind}
          // Versi terbaru dari snapshot (mis. stok berubah karena Kasir saat form terbuka); tetap item lama bila sudah hilang
          item={editing.item && (items.find((i) => i.id === editing.item.id) ?? editing.item)}
          places={places}
          orgId={orgId}
          ownerId={ownerId}
          onClose={() => setEditing(null)}
        />
      )}
    </Card>
  );
}
