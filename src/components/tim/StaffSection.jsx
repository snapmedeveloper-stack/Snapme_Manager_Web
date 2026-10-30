import { useId, useState } from 'react';
import { Pencil, Plus, Users } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Modal, SortableList, Switch, useToast } from '../ui';
import { writeInBackground } from '../../utils/firestoreWrite';
import { nextOrder, saveOrder } from '../layanan/layananUtils';
import { STAFF_LABELS, labelsOf } from './staffLabels';
import { addStaff, updateStaff } from './timData';

/** Nama sudah dipakai staff lain di cabang ini? (huruf besar/kecil diabaikan) */
const nameTaken = (staff, name, exceptId) =>
  staff.some((s) => s.id !== exceptId && s.name.trim().toLowerCase() === name.trim().toLowerCase());

/** Ubah nama dan label staff (label memberi tunjangan di Gaji). onSave({ name, labels }). */
function EditStaff({ person, staff, onSave, onClose }) {
  const formId = useId();
  const [name, setName] = useState(person.name);
  const [labels, setLabels] = useState(() => labelsOf(person).map((l) => l.key));
  const [error, setError] = useState('');
  const toggleLabel = (key, on) => setLabels((prev) => (on ? [...prev, key] : prev.filter((k) => k !== key)));

  const handleSubmit = (e) => {
    e.preventDefault();
    const value = name.trim();
    if (!value) return;
    if (nameTaken(staff, value, person.id)) {
      setError(`Nama "${value}" sudah dipakai staff lain.`);
      return;
    }
    // Urutan mengikuti STAFF_LABELS supaya tersimpan rapi apa pun urutan ketukannya
    onSave({ name: value, labels: STAFF_LABELS.filter((l) => labels.includes(l.key)).map((l) => l.key) });
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Ubah staff"
      footer={
        <>
          <Button onClick={onClose}>Batal</Button>
          <Button type="submit" form={formId} variant="primary" disabled={!name.trim()}>
            Simpan
          </Button>
        </>
      }
    >
      <form id={formId} className="form-stack" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor={`${formId}-name`}>Nama</label>
          <input
            id={`${formId}-name`}
            className={`input${error ? ' is-error' : ''}`}
            value={name}
            autoFocus
            onChange={(e) => {
              setName(e.target.value);
              setError('');
            }}
          />
          {error && <span className="form-error">{error}</span>}
          <span className="form-hint">Catatan kerja lama ikut memakai nama baru.</span>
        </div>
        <div className="form-group">
          <span className="form-label">Label</span>
          {STAFF_LABELS.map((l) => (
            <div key={l.key} className="tim-switch-row">
              <span>
                {l.label}
                <span className="form-hint">Tunjangan {l.basis}, nominalnya di Gaji → Atur.</span>
              </span>
              <Switch
                checked={labels.includes(l.key)}
                onChange={(on) => toggleLabel(l.key, on)}
                ariaLabel={`Label ${l.label}`}
              />
            </div>
          ))}
        </div>
      </form>
    </Modal>
  );
}

/**
 * Daftar nama staff satu cabang. Staff tidak punya akun: namanya dipilih saat mencatat kerja di Snapme Desktop.
 * Label Admin/CS (staffLabels) memberi tunjangan di Gaji.
 * Staff yang berhenti dinonaktifkan (bukan dihapus) supaya rekap lamanya tetap terbaca.
 */
export default function StaffSection({ orgId, managerId, data, addInputRef }) {
  const toast = useToast();
  const { staff } = data;
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const activeCount = staff.filter((s) => s.active !== false).length;

  const fail = (title) => (err) => toast.error(title, err.message, { persistent: true });

  const handleAdd = (e) => {
    e.preventDefault();
    const name = draft.trim();
    if (!name) return;
    if (nameTaken(staff, name)) {
      setError(`Nama "${name}" sudah terdaftar.`);
      return;
    }
    writeInBackground(
      () => addStaff(orgId, { name, managerId, order: nextOrder(staff) }),
      fail('Gagal menambah staff'),
    );
    setDraft('');
  };

  const reorder = async (items) => {
    try {
      await saveOrder(orgId, 'staff', items);
    } catch (err) {
      toast.error('Gagal mengubah urutan', err.message);
      throw err;
    }
  };

  return (
    <Card
      title={
        <>
          <Users size={18} aria-hidden="true" />
          Staff
        </>
      }
      description={`${activeCount} staff aktif. Staff tidak perlu akun; namanya dipilih saat mencatat kerja di Snapme Desktop.`}
    >
      <form className="tim-add" onSubmit={handleAdd}>
        <div className="tim-add-field">
          <input
            ref={addInputRef}
            className={`input${error ? ' is-error' : ''}`}
            placeholder="Nama staff baru"
            aria-label="Nama staff baru"
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

      {staff.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Belum ada staff"
          description="Tambahkan nama staff pertama lewat kolom di atas."
        />
      ) : (
        <SortableList
          items={staff}
          disabled={staff.length < 2}
          onReorder={reorder}
          className="tim-list"
          itemClassName="tim-row"
          renderItem={(person) => (
            <>
              <div className="tim-row-main">
                <span className={`tim-row-title${person.active === false ? ' is-muted' : ''}`}>{person.name}</span>
                {(person.active === false || labelsOf(person).length > 0) && (
                  <span className="tim-row-badges">
                    {labelsOf(person).map((l) => (
                      <Badge key={l.key} tone="accent">
                        {l.label}
                      </Badge>
                    ))}
                    {person.active === false && <Badge>Nonaktif</Badge>}
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                iconOnly
                icon={Pencil}
                aria-label={`Ubah ${person.name}`}
                onClick={() => setEditing(person)}
              />
              <Switch
                checked={person.active !== false}
                ariaLabel={`${person.name} aktif`}
                onChange={(active) =>
                  writeInBackground(
                    () => updateStaff(orgId, person.id, { active }),
                    fail('Gagal mengubah status staff'),
                  )
                }
              />
            </>
          )}
        />
      )}

      {editing && (
        <EditStaff
          person={editing}
          staff={staff}
          onClose={() => setEditing(null)}
          onSave={(fields) => {
            writeInBackground(() => updateStaff(orgId, editing.id, fields), fail('Gagal mengubah staff'));
            setEditing(null);
          }}
        />
      )}
    </Card>
  );
}
