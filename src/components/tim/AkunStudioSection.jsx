import { useId, useState } from 'react';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { History, KeyRound, Pencil, Plus } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Modal, Select, Switch, useToast } from '../ui';
import { writeInBackground } from '../../utils/firestoreWrite';
import { studioAccountRef, studioAccountsCollection } from './timData';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NEW_BRANCH = '__baru__';

/** Tambah akun (email, nama cabang, cabang) atau ubah akun (nama, aktif). */
function AccountForm({ account, branches, onSave, onClose }) {
  const formId = useId();
  const [email, setEmail] = useState(account?.id || '');
  const [name, setName] = useState(account?.name || '');
  const [branch, setBranch] = useState(account?.managerId || NEW_BRANCH);
  const [active, setActive] = useState(account ? account.active !== false : true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!account && !EMAIL_PATTERN.test(cleanEmail)) {
      setError('Isi alamat email Google yang valid.');
      return;
    }
    if (!name.trim()) {
      setError('Isi nama cabang.');
      return;
    }
    setSaving(true);
    try {
      await onSave({ email: cleanEmail, name: name.trim(), branch, active });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={account ? 'Ubah akun studio' : 'Tambah akun studio'}
      footer={
        <>
          <Button onClick={onClose}>Batal</Button>
          <Button type="submit" form={formId} variant="primary" loading={saving}>
            Simpan
          </Button>
        </>
      }
    >
      <form id={formId} className="form-stack" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor={`${formId}-email`}>Email Google</label>
          <input
            id={`${formId}-email`}
            className="input"
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder="studio@gmail.com"
            value={email}
            disabled={!!account}
            onChange={(e) => {
              setEmail(e.target.value);
              setError('');
            }}
          />
          <span className="form-hint">
            Akun ini dipakai login di Snapme Desktop dan sekaligus menjadi Google Drive studio.
          </span>
        </div>
        <div className="form-group">
          <label htmlFor={`${formId}-name`}>Nama cabang</label>
          <input
            id={`${formId}-name`}
            className="input"
            placeholder="Snap Me Selfphoto"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError('');
            }}
          />
          <span className="form-hint">Tampil di Snapme Desktop, nota, dan nama pengirim pesan.</span>
        </div>
        {!account && (
          <div className="form-group">
            <label htmlFor={`${formId}-branch`}>Data cabang</label>
            <Select id={`${formId}-branch`} value={branch} onChange={setBranch}>
              <option value={NEW_BRANCH}>Cabang baru (data kosong)</option>
              {branches.map((b) => (
                <option key={b.managerId} value={b.managerId}>
                  Pakai data {b.name}
                </option>
              ))}
            </Select>
            <span className="form-hint">
              Pilih cabang yang sudah ada bila akun ini menggantikan atau menambah login cabang tersebut.
            </span>
          </div>
        )}
        {account && (
          <label className="tim-switch-row">
            <span>
              Aktif
              <span className="form-hint">Akun nonaktif tidak bisa masuk ke Snapme Desktop.</span>
            </span>
            <Switch checked={active} onChange={setActive} ariaLabel="Akun aktif" />
          </label>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

/**
 * Akun studio: akun Google yang dipakai login di Snapme Desktop (satu login juga menyambungkan Google Drive).
 * Dokumen studioAccounts/{email}; managerId = kunci data cabang. Manager lama (sebelum rombak tanpa role) yang belum
 * terdaftar ditampilkan terpisah dan bisa didaftarkan dengan satu tombol, tanpa memindah data.
 */
export default function AkunStudioSection({ orgId, user, accounts, branches, unregisteredManagers }) {
  const toast = useToast();
  const [form, setForm] = useState(null); // null | { account: akun yang diubah | null }
  const branchName = new Map(branches.map((b) => [b.managerId, b.name]));
  const sorted = [...accounts].sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));

  const handleSave = async ({ email, name, branch, active }) => {
    if (form.account) {
      writeInBackground(
        () =>
          updateDoc(studioAccountRef(form.account.id), {
            name,
            active,
            updatedAt: serverTimestamp(),
          }),
        (err) =>
          toast.error('Gagal mengubah akun studio', err.message, {
            persistent: true,
          }),
      );
      toast.success('Akun studio diubah', form.account.id);
      setForm(null);
      return;
    }
    // Id dokumen = email, berlaku lintas organisasi: jangan menimpa akun yang sudah terdaftar
    // Rules menolak membaca akun milik organisasi lain: artinya email itu sudah dipakai di sana
    const existing = await getDoc(studioAccountRef(email)).catch((err) => {
      if (err.code === 'permission-denied') throw new Error('Email ini sudah terdaftar di organisasi lain.');
      throw err;
    });
    if (existing.exists()) {
      throw new Error(
        existing.data().orgId === orgId
          ? 'Email ini sudah terdaftar.'
          : 'Email ini sudah terdaftar di organisasi lain.',
      );
    }
    const managerId = branch === NEW_BRANCH ? doc(studioAccountsCollection()).id : branch;
    await setDoc(studioAccountRef(email), {
      orgId,
      managerId,
      name,
      active: true,
      uid: null,
      createdAt: serverTimestamp(),
      createdBy: user.email,
    });
    toast.success('Akun studio ditambahkan', `${email} bisa login di Snapme Desktop.`);
    setForm(null);
  };

  const registerLegacy = (member) =>
    writeInBackground(
      () =>
        setDoc(studioAccountRef(member.email), {
          orgId,
          managerId: member.uid,
          uid: member.uid,
          name: member.displayName || member.email,
          active: true,
          legacy: true,
          createdAt: serverTimestamp(),
          createdBy: user.email,
        }),
      (err) =>
        toast.error('Gagal mendaftarkan akun', err.message, {
          persistent: true,
        }),
    );

  return (
    <>
      <Card
        title={
          <>
            <KeyRound size={18} aria-hidden="true" />
            Akun studio
          </>
        }
        description="Akun Google yang dipakai login di Snapme Desktop. Staff tidak perlu akun sendiri."
        actions={
          <Button variant="primary" size="sm" icon={Plus} onClick={() => setForm({ account: null })}>
            Tambah
          </Button>
        }
      >
        {sorted.length === 0 ? (
          <EmptyState
            icon={KeyRound}
            title="Belum ada akun studio"
            description="Tambahkan akun Google studio yang dipakai login di laptop staff."
          />
        ) : (
          <ul className="tim-list">
            {sorted.map((a) => (
              <li key={a.id} className="tim-row">
                <div className="tim-row-main">
                  <span className={`tim-row-title${a.active === false ? ' is-muted' : ''}`}>{a.name || a.id}</span>
                  <span className="tim-row-meta">{a.id}</span>
                  <span className="tim-row-badges">
                    {a.active === false && <Badge>Nonaktif</Badge>}
                    {!a.uid && <Badge tone="warning">Belum pernah login</Badge>}
                    {branchName.get(a.managerId) !== (a.name || a.id) && (
                      <Badge>Data {branchName.get(a.managerId)}</Badge>
                    )}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  iconOnly
                  icon={Pencil}
                  aria-label={`Ubah ${a.id}`}
                  onClick={() => setForm({ account: a })}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {unregisteredManagers.length > 0 && (
        <Card
          title={
            <>
              <History size={18} aria-hidden="true" />
              Akun manager lama
            </>
          }
          description="Akun dari sistem lama yang belum didaftarkan sebagai akun studio. Mendaftarkannya tidak memindah data apa pun."
        >
          <ul className="tim-list">
            {unregisteredManagers.map((m) => (
              <li key={m.uid} className="tim-row">
                <div className="tim-row-main">
                  <span className="tim-row-title">{m.displayName || m.email}</span>
                  <span className="tim-row-meta">{m.email}</span>
                </div>
                <Button size="sm" onClick={() => registerLegacy(m)} disabled={!m.email}>
                  Daftarkan
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {form && (
        <AccountForm account={form.account} branches={branches} onSave={handleSave} onClose={() => setForm(null)} />
      )}
    </>
  );
}
