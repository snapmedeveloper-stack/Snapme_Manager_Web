import { useEffect, useId, useState } from 'react';
import { FieldPath, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { ExternalLink, FolderOpen, Pencil } from 'lucide-react';
import { Badge, Button, Card, Modal, useToast } from '../ui';
import { writeInBackground } from '../../utils/firestoreWrite';
import { driveFolderIdOf } from '../../utils/driveLink';
import { driveSettingsRef } from './timData';

const DRIVE_ID = /^[a-zA-Z0-9_-]{10,200}$/;
const folderUrl = (id) => `https://drive.google.com/drive/folders/${id}`;

/** ID dari link Drive, atau teks yang sudah berupa ID. '' = kosong (Drive tidak dipakai), null = tidak sah. */
function parseFolder(text) {
  const clean = text.trim();
  if (!clean) return '';
  const id = driveFolderIdOf(clean) || clean;
  return DRIVE_ID.test(id) ? id : null;
}

function DriveFolderForm({ branchName, current, onSave, onClose }) {
  const formId = useId();
  const [text, setText] = useState(current ? folderUrl(current) : '');
  const parsed = parseFolder(text);

  return (
    <Modal
      open
      size="sm"
      title={`Folder Google Drive · ${branchName}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Batal</Button>
          <Button type="submit" form={formId} variant="primary" disabled={parsed === null}>
            Simpan
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (parsed !== null) onSave(parsed);
        }}
      >
        <p className="form-hint">
          Buat satu folder di Google Drive akun studio cabang ini, lalu tempel link-nya. Snap Me Desktop otomatis
          membuat folder bulan di dalamnya (mis. 2026-11 November) dan folder per booking saat customer datang.
        </p>
        <div className="form-group">
          <label htmlFor={`${formId}-link`}>Link atau ID folder</label>
          <input
            id={`${formId}-link`}
            className="input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="https://drive.google.com/drive/folders/…"
            autoComplete="off"
          />
          {parsed === null && <span className="form-error">Bukan link folder Google Drive yang valid.</span>}
          {parsed === '' && (
            <span className="form-hint">
              Dikosongkan = folder Drive tidak dibuat & foto tidak di-upload di cabang ini.
            </span>
          )}
        </div>
      </form>
    </Modal>
  );
}

/**
 * Folder induk Google Drive per cabang (settings/drive.rootFolders[managerId] = { folderId, updatedAt, updatedBy }).
 * Dipakai Snap Me Desktop untuk folder bulan & folder booking. folderId null = sengaja dimatikan (Desktop tidak lagi
 * memakai folder lama yang dulu diisi di Desktop).
 */
export default function DriveFolderCard({ orgId, user, branches }) {
  const toast = useToast();
  const [roots, setRoots] = useState({ key: null, value: {} });
  const [editing, setEditing] = useState(null); // cabang yang diubah
  const current = roots.key === orgId ? roots.value : {};

  useEffect(() => {
    if (!orgId) return undefined;
    return onSnapshot(
      driveSettingsRef(orgId),
      (snap) => setRoots({ key: orgId, value: snap.data()?.rootFolders || {} }),
      (err) => console.error('[Tim] Gagal memuat folder Drive', err),
    );
  }, [orgId]);

  const handleSave = (branch, folderId) => {
    const path = new FieldPath('rootFolders', branch.managerId);
    const value = { folderId: folderId || null, updatedAt: serverTimestamp(), updatedBy: user?.email || '-' };
    writeInBackground(
      () => setDoc(driveSettingsRef(orgId), { rootFolders: { [branch.managerId]: value } }, { mergeFields: [path] }),
      (err) => toast.error('Gagal menyimpan folder Drive', err.message, { persistent: true }),
    );
    toast.success(folderId ? 'Folder Drive disimpan' : 'Folder Drive dimatikan', branch.name);
    setEditing(null);
  };

  return (
    <Card
      title={
        <>
          <FolderOpen size={18} aria-hidden="true" />
          Folder Google Drive
        </>
      }
      description="Folder induk foto customer per cabang. Folder bulan & folder booking dibuat otomatis oleh Snap Me Desktop."
    >
      {branches.length === 0 ? (
        <p className="form-hint">Tambahkan akun studio dulu.</p>
      ) : (
        <ul className="tim-list">
          {branches.map((b) => {
            const entry = current[b.managerId];
            const id = entry?.folderId;
            return (
              <li key={b.managerId} className="tim-row">
                <div className="tim-row-main">
                  <span className="tim-row-title">{b.name}</span>
                  <span className="tim-row-meta">{id || (entry ? 'Dimatikan' : 'Belum diatur di Manager')}</span>
                  <span className="tim-row-badges">
                    {!entry && <Badge tone="warning">Belum diatur</Badge>}
                    {entry && !id && <Badge>Drive tidak dipakai</Badge>}
                  </span>
                </div>
                {id && (
                  <Button
                    variant="ghost"
                    iconOnly
                    icon={ExternalLink}
                    aria-label={`Buka folder Drive ${b.name}`}
                    onClick={() => window.open(folderUrl(id), '_blank', 'noopener')}
                  />
                )}
                <Button
                  variant="ghost"
                  iconOnly
                  icon={Pencil}
                  aria-label={`Ubah folder Drive ${b.name}`}
                  onClick={() => setEditing(b)}
                />
              </li>
            );
          })}
        </ul>
      )}
      {editing && (
        <DriveFolderForm
          branchName={editing.name}
          current={current[editing.managerId]?.folderId || ''}
          onSave={(folderId) => handleSave(editing, folderId)}
          onClose={() => setEditing(null)}
        />
      )}
    </Card>
  );
}
