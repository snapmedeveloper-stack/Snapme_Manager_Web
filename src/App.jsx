import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, limit, query } from 'firebase/firestore';
import { auth, db } from './firebase';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Timeline from './pages/Timeline';
import Transaksi from './pages/Transaksi';
import './index.css';

function Login() {
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Gagal login", error);
      alert("Gagal login: " + error.message);
      setIsLoggingIn(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: 'var(--bg-color)' }}>
      <div className="card" style={{ textAlign: 'center', maxWidth: 400, width: '100%' }}>
        <h2 style={{ marginBottom: 16 }}>Snapme Manager</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>Silakan login untuk memantau data studio.</p>
        <button 
          className="btn btn-primary" 
          style={{ width: '100%', padding: '12px', opacity: isLoggingIn ? 0.7 : 1 }} 
          onClick={handleLogin}
          disabled={isLoggingIn}
        >
          {isLoggingIn ? 'Memproses...' : 'Login dengan Google'}
        </button>
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [orgId, setOrgId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      setErrorMsg('');
      setUser(currentUser);
      
      if (currentUser) {
        try {
          let oid = null;
          
          // 1. Coba ambil dari data user
          const snap = await getDoc(doc(db, 'users', currentUser.uid));
          if (snap.exists()) {
            const data = snap.data();
            oid = data.orgId || data.defaultOrgId || (data.ownedOrgIds?.[0]);
          }

          // 2. Jika tidak ada, coba ambil organisasi pertama dari koleksi (fallback)
          if (!oid) {
            const orgsSnap = await getDocs(query(collection(db, 'organizations'), limit(1)));
            if (!orgsSnap.empty) {
              oid = orgsSnap.docs[0].id;
              console.log("Fallback ke organisasi pertama:", oid);
            }
          }

          if (oid) {
            setOrgId(oid);
          } else {
            setOrgId(null);
            setErrorMsg('Tidak dapat menemukan data Organisasi di database. Pastikan database tidak kosong.');
          }
        } catch (e) {
          console.error("Error fetching user meta:", e);
          setErrorMsg('Terjadi kesalahan saat mengambil data: ' + e.message);
          setOrgId(null);
        }
      } else {
        setOrgId(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleLogout = async () => {
    setLoading(true);
    await signOut(auth);
    setLoading(false);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: '16px' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <span style={{ color: '#6b7a99' }}>Memuat data...</span>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (!orgId) {
    return (
      <div style={{ display: 'flex', height: '100vh', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', backgroundColor: 'var(--bg-color)' }}>
        <div className="card" style={{ textAlign: 'center', maxWidth: 450, width: '100%' }}>
          <h2 style={{ color: 'var(--danger-color)', marginBottom: 16 }}>Akses Ditolak</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
            {errorMsg || 'Akun Anda tidak terkait dengan Organisasi manapun. Hubungi Administrator.'}
          </p>
          <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', marginBottom: '24px', fontSize: '0.85rem', color: '#64748b', textAlign: 'left', wordBreak: 'break-all' }}>
            Email Anda: <strong>{user.email}</strong><br/>
            UID: {user.uid}
          </div>
          <button className="btn btn-primary" onClick={handleLogout} style={{ width: '100%' }}>
            Keluar (Logout)
          </button>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Layout user={user} onLogout={handleLogout}>
        <Routes>
          <Route path="/" element={<Dashboard orgId={orgId} />} />
          <Route path="/timeline" element={<Timeline orgId={orgId} user={user} />} />
          <Route path="/transaksi" element={<Transaksi orgId={orgId} user={user} />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
