import { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { LogIn } from 'lucide-react';
import { auth } from '../../firebase';
import { Button, useToast } from '../ui';
import AuthNotice from './AuthNotice';

/** Login Snapme Manager dengan akun Google owner (atau akun yang diberi akses). Tampilan senada dengan login Desktop. */
export default function LoginScreen() {
  const toast = useToast();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const provider = new GoogleAuthProvider();
      // Selalu tampilkan pilihan akun, supaya bisa berganti dari akun yang tidak punya akses
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('[Login] Gagal login', error);
      // Popup ditutup sendiri oleh user bukan kesalahan
      if (error.code !== 'auth/popup-closed-by-user') toast.error('Gagal login', error.message);
      setIsLoggingIn(false);
    }
  };

  return (
    <AuthNotice
      title="Snap Me Manager"
      description="Kelola jadwal, transaksi, layanan, dan tim studio dari HP. Khusus owner studio dan akun yang diberi akses."
      actions={
        <Button variant="primary" size="lg" block icon={LogIn} loading={isLoggingIn} onClick={handleLogin}>
          Masuk dengan Google
        </Button>
      }
    >
      <p className="auth-hint">Laptop studio memakai aplikasi Snap Me Desktop dengan akun studio.</p>
    </AuthNotice>
  );
}
