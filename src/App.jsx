import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';
import { LogOut, MonitorSmartphone, RotateCw, WifiOff } from 'lucide-react';
import { auth, db } from './firebase';
import { managerTeamIds } from './utils/managerScope';
import { useStudioAccounts } from './hooks/useStudioAccounts';
import { canManageStaff } from './constants/roles';
import { Button, Spinner } from './components/ui';
import AppShell from './components/layout/AppShell';
import OwnerOnboarding from './components/auth/OwnerOnboarding';
import AuthNotice from './components/auth/AuthNotice';
import LoginScreen from './components/auth/LoginScreen';
import { refreshAccessClaims, resolveAccess } from './components/auth/access';

// Halaman dimuat saat dibuka, supaya kode satu halaman tidak ikut diunduh di awal
const Timeline = lazy(() => import('./pages/Timeline'));
const Transaksi = lazy(() => import('./pages/Transaksi'));
const Layanan = lazy(() => import('./pages/Layanan'));
const Tim = lazy(() => import('./pages/Tim'));
const Profil = lazy(() => import('./pages/Profil'));

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
  const [access, setAccess] = useState(null); // hasil resolveAccess, atau { status: 'error', message }

  // Owner dikenali dari organisasi miliknya (components/auth/access.js); akun tanpa organisasi diarahkan menebus kode owner
  const checkAccess = useCallback(async (currentUser) => {
    try {
      const result = await resolveAccess(currentUser);
      // Tanda akses untuk unggah gambar (Storage) diperbarui di belakang; halaman tidak menunggu
      if (result.status === 'ok') {
        refreshAccessClaims(currentUser).catch((e) => console.error('[Akses] Gagal memperbarui tanda akses', e));
      }
      setAccess(result);
      setOrgId(result.orgId || null);
      setUserMeta(result.userMeta || null);
    } catch (e) {
      console.error('[Akses] Gagal memeriksa akun', e);
      setAccess({ status: 'error', message: e.message });
      setOrgId(null);
      setUserMeta(null);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      setUser(currentUser);
      if (currentUser) await checkAccess(currentUser);
      else {
        setAccess(null);
        setOrgId(null);
        setUserMeta(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [checkAccess]);

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

  // Cabang = akun studio (docs/RENCANA_TANPA_ROLE.md). Manager = cabangnya sendiri, operator = cabang managernya
  // (keduanya hanya selama masa transisi), owner = cabang yang dipilih di Profil/Tim (kosong = semua cabang; hanya
  // satu cabang = otomatis cabang itu). Pilihan owner diingat di perangkat ini.
  const role = userMeta?.role;
  const studio = useStudioAccounts(orgId, members);
  const { branches } = studio;
  // Cabang tersimpan yang sudah tidak ada (atau daftarnya belum termuat sesaat setelah login): pakai semua cabang
  const savedBranch = viewManager && branches.some((b) => b.managerId === viewManager) ? viewManager : null;
  const viewManagerId = role === 'owner' ? savedBranch || (branches.length === 1 ? branches[0].managerId : null) : null;
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
    return <LoginScreen />;
  }

  if (access?.status === 'onboarding') {
    return (
      <OwnerOnboarding
        user={user}
        onComplete={() => checkAccess(user)}
        onRetry={() => checkAccess(user)}
        onLogout={handleLogout}
      />
    );
  }

  if (access?.status === 'studio') {
    return (
      <AuthNotice
        icon={MonitorSmartphone}
        tone="warning"
        title="Akun ini khusus Snap Me Desktop"
        description="Akun studio dipakai bersama semua staff di laptop studio, jadi tidak bisa membuka Snap Me Manager."
        user={user}
        steps={[
          { title: 'Owner studio', text: 'Masuk dengan akun Google pribadi owner.' },
          {
            title: 'Pengelola studio',
            text: 'Minta owner menambahkan email pribadi Anda lewat Profil → Akses Snap Me Manager, lalu masuk dengan email itu.',
          },
        ]}
        actions={
          <Button variant="primary" size="lg" block icon={LogOut} onClick={handleLogout}>
            Masuk dengan akun lain
          </Button>
        }
      />
    );
  }

  if (access?.status !== 'ok' || !orgId) {
    return (
      <AuthNotice
        icon={WifiOff}
        tone="danger"
        title="Gagal memeriksa akun"
        description={`Periksa koneksi internet, lalu coba lagi.${access?.message ? ` (${access.message})` : ''}`}
        user={user}
        actions={
          <>
            <Button variant="primary" size="lg" block icon={RotateCw} onClick={() => checkAccess(user)}>
              Coba lagi
            </Button>
            <Button size="lg" block icon={LogOut} onClick={handleLogout}>
              Keluar
            </Button>
          </>
        }
      />
    );
  }

  const session = { user, orgId, userMeta, managerId, managerIds };
  const branchProps = { branches, onViewManagerChange: changeViewManager };
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
            {canManage && <Route path="/tim" element={<Tim {...session} {...branchProps} studio={studio} />} />}
            <Route
              path="/profil"
              element={<Profil {...session} {...branchProps} viewManagerId={viewManagerId} onLogout={handleLogout} />}
            />
            <Route path="*" element={<Navigate to="/timeline" replace />} />
          </Routes>
        </Suspense>
      </AppShell>
    </Router>
  );
}

export default App;
