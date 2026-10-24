import { useEffect, useState } from 'react';
import { arrayRemove, arrayUnion, doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { KeyRound, Plus, Trash2 } from 'lucide-react';
import { db } from '../../firebase';
import { Badge, Button, Card, useConfirm, useToast } from '../ui';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Akses Snapme Manager: email Google tambahan yang hak aksesnya sama dengan owner (organizations/{orgId}.ownerEmails,
 * dicek juga oleh firestore.rules dan Cloud Function laporan). Hanya owner utama yang boleh menambah/menghapus.
 * Akun studio tidak boleh ditambahkan karena dipakai bersama semua staff di Snapme Desktop.
 */
export default function ManagerAccess({ orgId, isPrimaryOwner }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [org, setOrg] = useState(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const orgRef = doc(db, 'organizations', orgId);

  useEffect(() => {
    if (!orgId) return undefined;
    return onSnapshot(
      doc(db, 'organizations', orgId),
      (snap) => setOrg(snap.exists() ? snap.data() : null),
      (err) => console.error('[Akses] Gagal membaca organisasi', err),
    );
  }, [orgId]);

  const emails = org?.ownerEmails || [];

  const handleAdd = async (e) => {
    e.preventDefault();
    const email = draft.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email)) {
      setError('Isi alamat email Google yang valid.');
      return;
    }
    if (email === org?.ownerEmail?.toLowerCase() || emails.includes(email)) {
      setError('Email ini sudah punya akses.');
      return;
    }
    setSaving(true);
    try {
      // Akun studio (organisasi ini maupun lain; yang lain ditolak rules saat dibaca) tidak boleh jadi owner
      const studio = await getDoc(doc(db, 'studioAccounts', email)).catch((err) => {
        if (err.code === 'permission-denied') return { exists: () => true };
        throw err;
      });
      if (studio.exists()) {
        setError('Email ini akun studio untuk Snapme Desktop dan tidak bisa diberi akses Manager.');
        return;
      }
      await updateDoc(orgRef, { ownerEmails: arrayUnion(email) });
      toast.success('Akses ditambahkan', `${email} bisa login ke Snapme Manager.`);
      setDraft('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (email) => {
    const ok = await confirm({
      title: 'Cabut akses Manager?',
      message: `${email} tidak bisa lagi membuka Snapme Manager.`,
      confirmText: 'Cabut',
      destructive: true,
    });
    if (!ok) return;
    try {
      await updateDoc(orgRef, { ownerEmails: arrayRemove(email) });
      toast.success('Akses dicabut', email);
    } catch (err) {
      toast.error('Gagal mencabut akses', err.message);
    }
  };

  return (
    <Card
      title={
        <>
          <KeyRound size={18} aria-hidden="true" />
          Akses Snapme Manager
        </>
      }
      description="Akun Google yang boleh membuka Snapme Manager. Hak aksesnya sama dengan owner."
    >
      <ul className="profile-access-list">
        <li className="profile-access-row">
          <span className="profile-access-email">{org?.ownerEmail || 'Owner utama'}</span>
          <Badge tone="accent">Owner utama</Badge>
        </li>
        {emails.map((email) => (
          <li key={email} className="profile-access-row">
            <span className="profile-access-email">{email}</span>
            {isPrimaryOwner && (
              <Button
                variant="ghost"
                iconOnly
                icon={Trash2}
                aria-label={`Cabut akses ${email}`}
                onClick={() => handleRemove(email)}
              />
            )}
          </li>
        ))}
      </ul>

      {isPrimaryOwner ? (
        <form className="profile-access-add" onSubmit={handleAdd}>
          <div className="profile-access-field">
            <input
              className={`input${error ? ' is-error' : ''}`}
              type="email"
              inputMode="email"
              autoComplete="off"
              placeholder="email@gmail.com"
              aria-label="Email Google yang diberi akses"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setError('');
              }}
            />
            {error && <span className="form-error">{error}</span>}
          </div>
          <Button type="submit" variant="primary" icon={Plus} loading={saving} disabled={!draft.trim()}>
            Tambah
          </Button>
        </form>
      ) : (
        <p className="form-hint">Hanya owner utama yang bisa menambah atau mencabut akses.</p>
      )}
    </Card>
  );
}
