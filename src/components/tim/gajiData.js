// Akses Firestore bagian Gaji (hanya owner; rules: payrollSettings, payrollBonuses & payrolls). Tarif & bonus tidak
// disimpan di staff atau settings karena keduanya dibaca Snapme Desktop yang dipakai semua staff
// (docs/RENCANA_TANPA_ROLE.md §3).
import { addDoc, collection, deleteDoc, doc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';

export const payrollSettingsCollection = (orgId) => collection(db, 'organizations', orgId, 'payrollSettings');
export const payrollBonusCollection = (orgId) => collection(db, 'organizations', orgId, 'payrollBonuses');
export const payrollCollection = (orgId) => collection(db, 'organizations', orgId, 'payrolls');
export const transactionCollection = (orgId) => collection(db, 'organizations', orgId, 'transactions');
const payrollRef = (orgId, month, staffId) => doc(payrollCollection(orgId), `${month}_${staffId}`);

/**
 * Simpan pengaturan gaji cabang mulai bulan itu (payrollSettings/{managerId}_{YYYY-MM}: hourlyRate, mealAllowance,
 * adminAllowance, csAllowance), sekaligus fee paket yang berubah ({ [packageId]: handlerFee }), dalam satu batch.
 */
export function savePayrollSettings(orgId, user, { managerId, month, packageFees, ...rates }) {
  const batch = writeBatch(db);
  batch.set(doc(payrollSettingsCollection(orgId), `${managerId}_${month}`), {
    managerId,
    month,
    hourlyRate: rates.hourlyRate,
    mealAllowance: rates.mealAllowance,
    adminAllowance: rates.adminAllowance,
    csAllowance: rates.csAllowance,
    updatedAt: serverTimestamp(),
    updatedBy: user.email,
  });
  Object.entries(packageFees).forEach(([packageId, handlerFee]) =>
    batch.update(doc(db, 'organizations', orgId, 'packages', packageId), { handlerFee }),
  );
  return batch.commit();
}

/** Bonus satu staff di bulan itu (boleh lebih dari satu): { managerId, month, staffId, staffName, amount, note }. */
export const addBonus = (orgId, user, bonus) =>
  addDoc(payrollBonusCollection(orgId), { ...bonus, createdAt: serverTimestamp(), createdBy: user.email });

export const deleteBonus = (orgId, bonusId) => deleteDoc(doc(payrollBonusCollection(orgId), bonusId));

/** Tandai gaji satu staff satu bulan sudah dibayar; angkanya dibekukan supaya perubahan kemudian terlihat. */
export const markPaid = (orgId, user, slip) =>
  setDoc(payrollRef(orgId, slip.month, slip.staffId), {
    ...slip,
    paidAt: serverTimestamp(),
    paidBy: user.email,
  });

export const unmarkPaid = (orgId, month, staffId) => deleteDoc(payrollRef(orgId, month, staffId));

/** Koreksi penanggung jawab transaksi. handlerFee ikut disimpan supaya transaksi lama memakai fee saat dikoreksi. */
export const saveHandlers = (orgId, user, txId, { handlers, handlerFee }) =>
  updateDoc(doc(transactionCollection(orgId), txId), {
    handlers,
    handlerFee,
    handlersUpdatedAt: serverTimestamp(),
    handlersUpdatedBy: user.email,
  });
