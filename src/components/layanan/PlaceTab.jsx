import { useState } from 'react';
import { addDoc } from 'firebase/firestore';
import { Plus } from 'lucide-react';
import { Button, Card, EmptyState, SortableList, Switch, useToast } from '../ui';
import { writeInBackground } from '../../utils/firestoreWrite';
import { isAvailableAt, nextOrder, orgCollection, PLACE_KINDS } from './layananUtils';
import { useLayananActions } from './useLayananActions';
import RowActions from './RowActions';

/**
 * Tab Ruangan / Photobooth (logika sama dengan PlaceTab Snapme_Desktop): tambah nama baru, urutkan, arsipkan.
 * Jumlah paket = paket yang bisa dipilih di ruangan ini saat membuat booking di Timeline.
 * Ruangan punya saklar timer (studioEnabled + onToggleStudio dari useStudioTimers, field timerEnabled). Sama dengan
 * Desktop, owner boleh menyalakan/mematikan timer walau tidak bisa mengubah data lain.
 */
export default function PlaceTab({ kind, items, packages, canEdit, orgId, ownerId, studioEnabled, onToggleStudio }) {
  const { collection: collectionName, label, icon, description } = PLACE_KINDS[kind];
  const isStudio = kind === 'ruangan';
  const toast = useToast();
  const { archive, reorder } = useLayananActions(orgId);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const noun = label.toLowerCase();
  const sortable = canEdit && items.length > 1;

  const handleAdd = (e) => {
    e.preventDefault();
    const name = draft.trim();
    if (!name) return;
    if (items.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
      setError(`${label} "${name}" sudah ada.`);
      return;
    }
    writeInBackground(
      () =>
        addDoc(orgCollection(orgId, collectionName), {
          name,
          active: true,
          managerId: ownerId,
          ...(isStudio && { timerEnabled: false }),
          order: nextOrder(items),
        }),
      (err) => toast.error(`Gagal menambah ${noun}`, `${name}: ${err.message}`, { persistent: true }),
    );
    setDraft('');
  };

  return (
    <Card title={label} description={sortable ? `${description} Seret pegangan untuk mengubah urutan.` : description}>
      {canEdit && (
        <form className="lyn-add" onSubmit={handleAdd}>
          <div className="lyn-add-field">
            <input
              className={`input${error ? ' is-error' : ''}`}
              placeholder={`Nama ${noun} baru`}
              aria-label={`Nama ${noun} baru`}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setError('');
              }}
            />
            {error && <span className="form-error">{error}</span>}
          </div>
          <Button type="submit" variant="primary" icon={Plus} disabled={!draft.trim()}>
            Tambah
          </Button>
        </form>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon={icon}
          title={`Belum ada ${noun}`}
          description={canEdit ? `Tambahkan ${noun} pertama lewat kolom di atas.` : undefined}
        />
      ) : (
        <SortableList
          items={items}
          disabled={!canEdit}
          onReorder={(list) => reorder(collectionName, list)}
          className="lyn-list"
          itemClassName="lyn-row"
          renderItem={(item) => {
            const available = packages.filter((pkg) => isAvailableAt(pkg, kind, item.id));
            return (
              <>
                <div className="lyn-row-main">
                  <span className="lyn-row-title">{item.name}</span>
                  <span className={`lyn-row-meta${available.length ? '' : ' is-warning'}`}>
                    {available.length ? `${available.length} paket tersedia` : 'Belum ada paket'}
                  </span>
                </div>
                {isStudio && (
                  <label className="lyn-timer">
                    <span>Timer</span>
                    <Switch
                      checked={!!studioEnabled[item.id]}
                      onChange={() => onToggleStudio(item.id)}
                      ariaLabel={`Timer ${item.name}`}
                    />
                  </label>
                )}
                {canEdit && <RowActions name={item.name} onArchive={() => archive(collectionName, item, label)} />}
              </>
            );
          }}
        />
      )}
    </Card>
  );
}
