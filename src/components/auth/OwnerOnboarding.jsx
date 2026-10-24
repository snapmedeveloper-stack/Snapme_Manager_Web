// Diambil dari Snapme_Desktop/src/pages/OnBoarding.jsx (dihapus di rombak tanpa role); hanya jalur kode owner.
import { useState } from 'react';
import { collection, doc, getDoc, writeBatch } from 'firebase/firestore';
import { ArrowLeft, CircleCheck, LogOut } from 'lucide-react';
import { db } from '../../firebase';
import { Badge, Button, Card } from '../ui';
import logo from '../../assets/logo.png';

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
 * Owner baru: masukkan kode owner dari admin Snap Me, lalu beri nama studio. Penebusan kode dan pembuatan organisasi
 * ditulis dalam satu batch (rules: organisasi baru wajib bersama kode owner yang ditebus akun ini).
 */
export default function OwnerOnboarding({ user, onComplete, onLogout }) {
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

  return (
    <main className="screen-center">
      <Card className="screen-card">
        <img src={logo} alt="Snap Me" className="screen-logo" />
        {step === 'code' ? (
          <>
            <h1 className="page-title">Daftar sebagai owner</h1>
            <p className="page-subtitle">
              Akun ini belum memiliki studio. Masukkan kode owner dari admin Snap Me untuk membuat studio baru.
            </p>
            <form className="form-stack" onSubmit={handleVerify}>
              <input
                className="input num"
                placeholder="XXX-XXX-XXX"
                aria-label="Kode owner"
                value={code}
                onChange={(e) => {
                  setCode(formatCode(e.target.value));
                  setError('');
                }}
                maxLength={11}
                autoFocus
                spellCheck={false}
              />
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" variant="primary" size="lg" block loading={loading} disabled={!codeComplete}>
                Gunakan kode
              </Button>
            </form>
            <p className="form-hint">
              Staff tidak perlu akun: nama staff didaftarkan owner di menu Tim. Laptop studio login dengan akun studio
              di Snapme Desktop.
            </p>
          </>
        ) : (
          <>
            <Badge tone="success" icon={CircleCheck}>
              Kode owner valid
            </Badge>
            <h1 className="page-title">Beri nama studio</h1>
            <form className="form-stack" onSubmit={handleCreate}>
              <input
                className="input"
                placeholder="Contoh: Snap Me Studio Bandung"
                aria-label="Nama studio"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                autoFocus
              />
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
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
          </>
        )}
        <Button variant="ghost" size="sm" icon={LogOut} onClick={onLogout}>
          Keluar ({user.email})
        </Button>
      </Card>
    </main>
  );
}
