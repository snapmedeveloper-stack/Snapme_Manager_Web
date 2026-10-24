import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, collection, onSnapshot } from 'firebase/firestore';
import { LogIn, LogOut } from 'lucide-react';
import { auth, db } from './firebase';
import { managerTeamIds } from './utils/managerScope';
import { canManageStaff } from './constants/roles';
import { Button, Card, Spinner, useToast } from './components/ui';
import logo from './assets/logo.png';
import AppShell from './components/layout/AppShell';

// Halaman dimuat saat dibuka, supaya kode satu halaman tidak ikut diunduh di awal
const Timeline = lazy(() => import('./pages/Timeline'));
const Transaksi = lazy(() => import('./pages/Transaksi'));
const Layanan = lazy(() => import('./pages/Layanan'));
const Profil = lazy(() => import('./pages/Profil'));

function Login() {
  const toast = useToast();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
      console.error('Gagal login', error);
      // Popup ditutup sendiri oleh user bukan kesalahan
      if (error.code !== 'auth/popup-closed-by-user') toast.error('Gagal login', error.message);
      setIsLoggingIn(false);
    }
  };

  return (
    <main className="screen-center">
      <Card className="screen-card">
        <img src={logo} alt="Snap Me" className="screen-logo" />
        <h1 className="page-title">Snapme Manager</h1>
        <p className="page-subtitle">Masuk untuk memantau jadwal, transaksi, dan layanan studio.</p>
        <div className="form-stack">
          <Button variant="primary" size="lg" block icon={LogIn} loading={isLoggingIn} onClick={handleLogin}>
            Login dengan Google
          </Button>
        </div>
      </Card>
    </main>
  );
}

const VIEW_MANAGER_KEY = 'snapme.owner.viewManager';
const readViewManager = () => {
  try {
    return localStorage.getItem(VIEW_MANAGER_KEY);
  } catch {
    return null;
  }
};

function App() {
  const [user, setUser] = useState(null);
  const [orgId, setOrgId] = useState(null);
  const [userMeta, setUserMeta] = useState(null);
  const [members, setMembers] = useState([]);
  const [viewManager, setViewManager] = useState(readViewManager);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      setErrorMsg('');
      setUser(currentUser);

      if (currentUser) {
        try {
          // Organisasi diambil dari data user, sama seperti Snapme_Desktop. Akun yang belum terdaftar tidak diberi akses.
          const snap = await getDoc(doc(db, 'users', currentUser.uid));
          const data = snap.exists() ? snap.data() : null;
          setUserMeta(data);
          const oid = data?.orgId || data?.defaultOrgId || data?.ownedOrgIds?.[0];

          if (oid) {
            setOrgId(oid);
          } else {
            setOrgId(null);
            setErrorMsg('Akun Anda belum terdaftar di organisasi mana pun. Daftarkan akun lewat Snapme Desktop atau hubungi Owner.');
          }
        } catch (e) {
          console.error('Error fetching user meta:', e);
          setErrorMsg('Terjadi kesalahan saat mengambil data: ' + e.message);
          setOrgId(null);
        }
      } else {
        setOrgId(null);
        setUserMeta(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Anggota organisasi: daftar manager (pilihan owner) dan operator per manager (lingkup filter data). Bila tidak boleh
  // dibaca, lingkup tetap berisi manager + akun ini sendiri (utils/managerScope).
  useEffect(() => {
    if (!orgId) return undefined;
    return onSnapshot(
      collection(db, 'organizations', orgId, 'members'),
      (snap) => setMembers(snap.docs.map((d) => ({ uid: d.id, ...d.data() }))),
      () => setMembers([]),
    );
  }, [orgId]);

  // Sama dengan Snapme_Desktop: manager = dirinya, operator = managernya, owner = manager yang dipilih di Profil
  // (kosong = semua manager, tanpa filter). Pilihan owner diingat di perangkat ini.
  const role = userMeta?.role;
  const managers = useMemo(() => (role === 'owner' ? members.filter((m) => m.role === 'manager') : []), [members, role]);
  // Manager yang tersimpan tapi tidak ada di daftar anggota (sudah keluar, atau daftarnya belum termuat sesaat setelah
  // login): pakai semua manager
  const viewManagerId = viewManager && managers.some((m) => m.uid === viewManager) ? viewManager : null;
  const changeViewManager = (uid) => {
    setViewManager(uid || null);
    try {
      if (uid) localStorage.setItem(VIEW_MANAGER_KEY, uid);
      else localStorage.removeItem(VIEW_MANAGER_KEY);
    } catch {
      // Penyimpanan diblokir: pilihan hanya berlaku sampai halaman ditutup
    }
  };
  const managerId = role === 'manager' ? user?.uid : role === 'operator' ? userMeta?.managedBy : viewManagerId;
  const managerIdsKey = (managerTeamIds(managerId, members, role === 'operator' ? user?.uid : null) || []).join(',');
  const managerIds = useMemo(() => (managerIdsKey ? managerIdsKey.split(',') : null), [managerIdsKey]);

  const handleLogout = async () => {
    setLoading(true);
    await signOut(auth);
    setLoading(false);
  };

  if (loading) {
    return (
      <main className="screen-center">
        <Spinner size="lg" />
        <span>Memuat data...</span>
      </main>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (!orgId) {
    return (
      <main className="screen-center">
        <Card className="screen-card">
          <h1 className="page-title">Akses ditolak</h1>
          <p className="page-subtitle">
            {errorMsg || 'Akun Anda tidak terkait dengan organisasi mana pun. Hubungi Owner.'}
          </p>
          <div className="form-stack">
            <div className="account-box">
              Email: <strong>{user.email}</strong>
              <br />
              UID: <span className="num">{user.uid}</span>
            </div>
            <Button block icon={LogOut} onClick={handleLogout}>
              Keluar
            </Button>
          </div>
        </Card>
      </main>
    );
  }

  const session = { user, orgId, userMeta, managerId, managerIds };
  const canManage = canManageStaff(role);

  return (
    <Router>
      <AppShell canManage={canManage}>
        <Suspense
          fallback={
            <div className="page-loading">
              <Spinner size="lg" />
            </div>
          }
        >
          <Routes>
            <Route path="/timeline" element={<Timeline {...session} />} />
            <Route path="/transaksi" element={<Transaksi {...session} />} />
            {canManage && <Route path="/layanan" element={<Layanan {...session} />} />}
            <Route
              path="/profil"
              element={
                <Profil
                  {...session}
                  managers={managers}
                  viewManagerId={viewManagerId}
                  onViewManagerChange={changeViewManager}
                  onLogout={handleLogout}
                />
              }
            />
            <Route path="*" element={<Navigate to="/timeline" replace />} />
          </Routes>
        </Suspense>
      </AppShell>
    </Router>
  );
}

export default App;
