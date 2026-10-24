import { createContext, useContext } from 'react';

// Konteks layanan UI global (toast, konfirmasi). Provider-nya: UIProvider.jsx (dipasang di main.jsx).
export const UIContext = createContext(null);

function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('Hook UI harus dipakai di dalam <UIProvider>.');
  return ctx;
}

/** toast.success(judul, detail?) / .info / .warning / .error — pengganti alert(). */
export const useToast = () => useUI().toast;

/** await confirm({ title, message, confirmText, cancelText, destructive, signal }) → true/false — pengganti window.confirm(). signal (AbortSignal) menutup dialog dengan hasil false. */
export const useConfirm = () => useUI().confirm;
