// Diambil dari Snapme_Desktop/src/pages/OnBoarding.jsx (dihapus di rombak tanpa role); hanya jalur kode owner.
import { useState } from 'react';
import { collection, doc, getDoc, writeBatch } from 'firebase/firestore';
import { ArrowLeft, LogOut, RotateCw, Store, UserRoundX } from 'lucide-react';
import { db } from '../../firebase';
import { Button } from '../ui';
import AuthNotice from './AuthNotice';

const CODE_LENGTH = 9;

/** Rapikan ketikan menjadi format kode undangan "ABC-DEF-GHJ". */
function formatCode(value) {
  const raw = value
    .replace(/[^A-Z0-9]/gi, '')
    .toUpperCase()
    .slice(0, CODE_LENGTH);
  return [raw.slice(0, 3), raw.slice(3, 6), raw.slice(6, 9)].filter(Boolean).join('-');
}

/**
 * Akun yang belum punya akses Snapme Manager. Dua jalan: diberi akses oleh owner (lalu Coba lagi), atau owner studio
 * baru menebus kode owner dari admin Snap Me lalu memberi nama studio. Penebusan kode dan pembuatan organisasi ditulis
 * dalam satu batch (rules: organisasi baru wajib bersama kode owner yang ditebus akun ini).
 */
export default function OwnerOnboarding({ user, onComplete, onRetry, onLogout }) {
  const [step, setStep] = useState('code'); // 'code' | 'name'
  const [code, setCode] = useState('');
  const [orgName, setOrgName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const codeComplete = code.replace(/-/g, '').length === CODE_LENGTH;

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!codeComplete) return;
    setLoading(true);
    setError('');
    try {
      const snap = await getDoc(doc(db, 'inviteCodes', code));
      if (!snap.exists() || snap.data().role !== 'owner') {
        setError('Kode owner tidak valid. Periksa kembali kode dari admin Snap Me.');
      } else if (snap.data().status === 'claimed') {
        setError('Kode ini sudah dipakai akun lain.');
      } else {
        setStep('name');
      }
    } catch (err) {
      setError(`Gagal memeriksa kode: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const name = orgName.trim();
    if (!name) return;
    setLoading(true);
    setError('');
    try {
      const now = new Date().toISOString();
      const orgRef = doc(collection(db, 'organizations'));
      const batch = writeBatch(db);
      batch.update(doc(db, 'inviteCodes', code), {
        status: 'claimed',
        claimedBy: user.uid,
        claimedAt: now,
        orgId: orgRef.id,
      });
      batch.set(orgRef, { name, ownerId: user.uid, ownerEmail: user.email, createdAt: now, inviteCode: code });
      await batch.commit();
      onComplete();
    } catch (err) {
      setError(`Gagal membuat studio: ${err.message}`);
      setLoading(false);
    }
  };

  const errorMessage = error && (
    <p className="form-error" role="alert">
      {error}
    </p>
  );

  if (step === 'name') {
    return (
      <AuthNotice
        icon={Store}
        title="Beri nama studio Anda"
        description="Kode owner valid. Nama ini tampil di Snap Me Manager dan bisa diubah nanti."
        user={user}
      >
        <form className="form-stack auth-form" onSubmit={handleCreate}>
          <input
            className="input"
            placeholder="Contoh: Snap Me Studio Bandung"
            aria-label="Nama studio"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            autoFocus
          />
          {errorMessage}
          <Button type="submit" variant="primary" size="lg" block loading={loading} disabled={!orgName.trim()}>
            Buat studio
          </Button>
          <Button
            variant="ghost"
            icon={ArrowLeft}
            onClick={() => {
              setStep('code');
              setError('');
            }}
          >
            Kembali
          </Button>
        </form>
      </AuthNotice>
    );
  }

  return (
    <AuthNotice
      icon={UserRoundX}
      tone="warning"
      title="Akun ini belum punya akses"
      description="Snap Me Manager hanya bisa dibuka owner studio dan akun yang diberi akses oleh owner."
      user={user}
      steps={[
        {
          title: 'Diberi akses oleh owner?',
          text: 'Minta owner menambahkan email di atas lewat Profil → Akses Snap Me Manager, lalu tekan Coba lagi.',
        },
        {
          title: 'Salah akun?',
          text: 'Keluar, lalu masuk dengan akun Google owner atau akun yang sudah diberi akses.',
        },
      ]}
      actions={
        <>
          <Button variant="primary" size="lg" block icon={RotateCw} onClick={onRetry}>
            Coba lagi
          </Button>
          <Button size="lg" block icon={LogOut} onClick={onLogout}>
            Masuk dengan akun lain
          </Button>
        </>
      }
    >
      <div className="auth-divider">atau</div>
      <p className="auth-section-title">Owner studio baru?</p>
      <p className="auth-section-text">Masukkan kode owner dari admin Snap Me untuk membuat studio baru.</p>
      <form className="form-stack auth-form" onSubmit={handleVerify}>
        <input
          className="input num auth-code"
          placeholder="XXX-XXX-XXX"
          aria-label="Kode owner"
          value={code}
          onChange={(e) => {
            setCode(formatCode(e.target.value));
            setError('');
          }}
          maxLength={11}
          spellCheck={false}
        />
        {errorMessage}
        <Button type="submit" block loading={loading} disabled={!codeComplete}>
          Gunakan kode owner
        </Button>
      </form>
    </AuthNotice>
  );
}
