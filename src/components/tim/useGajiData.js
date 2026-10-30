import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import {
  payrollBonusCollection,
  payrollCollection,
  payrollSettingsCollection,
  transactionCollection,
} from './gajiData';
import { monthBounds } from './gajiUtils';

const withId = (d) => ({ id: d.id, ...d.data() });
const logError = (what) => (err) => console.error(`[Gaji] Gagal memuat ${what}`, err);

/**
 * Data Gaji satu bulan: transaksi bulan itu (query rentang createdAt, indeks satu field), paket (fee transaksi lama),
 * pengaturan gaji cabang (semua bulan; dipilih dengan gajiUtils.payrollSettingsFor), bonus dan tanda dibayar bulan itu.
 * Penyaringan transaksi per cabang dilakukan di gajiUtils.buildPayroll.
 * Data per bulan disimpan bersama bulannya, jadi saat bulan diganti loading langsung true tanpa angka bulan lama.
 */
export function useGajiData(orgId, managerId, month) {
  const [packages, setPackages] = useState(null);
  const [settingsDocs, setSettingsDocs] = useState(null);
  const [monthly, setMonthly] = useState({ transactions: null, bonuses: null, payrolls: null });
  const [error, setError] = useState('');

  useEffect(() => {
    if (!orgId) return undefined;
    const fail = (what, setEmpty) => (err) => {
      logError(what)(err);
      setError(err.message);
      setEmpty();
    };
    const unsubs = [
      onSnapshot(
        collection(db, 'organizations', orgId, 'packages'),
        (snap) => setPackages(snap.docs.map(withId)),
        fail('paket', () => setPackages([])),
      ),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [orgId]);

  useEffect(() => {
    if (!orgId || !managerId) return undefined;
    return onSnapshot(
      query(payrollSettingsCollection(orgId), where('managerId', '==', managerId)),
      (snap) => setSettingsDocs({ managerId, docs: snap.docs.map(withId) }),
      (err) => {
        logError('pengaturan gaji')(err);
        setError(err.message);
        setSettingsDocs({ managerId, docs: [] });
      },
    );
  }, [orgId, managerId]);

  useEffect(() => {
    if (!orgId || !month) return undefined;
    const { start, end } = monthBounds(month);
    const store = (key, value) => setMonthly((prev) => ({ ...prev, [key]: { month, value } }));
    const fail = (what, key, empty) => (err) => {
      logError(what)(err);
      setError(err.message);
      store(key, empty);
    };
    const unsubs = [
      onSnapshot(
        query(transactionCollection(orgId), where('createdAt', '>=', start), where('createdAt', '<', end)),
        (snap) => store('transactions', snap.docs.map(withId)),
        fail('transaksi', 'transactions', []),
      ),
      onSnapshot(
        query(payrollBonusCollection(orgId), where('month', '==', month)),
        (snap) => store('bonuses', snap.docs.map(withId)),
        fail('bonus', 'bonuses', []),
      ),
      onSnapshot(
        query(payrollCollection(orgId), where('month', '==', month)),
        (snap) => store('payrolls', Object.fromEntries(snap.docs.map((d) => [d.data().staffId, withId(d)]))),
        fail('tanda dibayar', 'payrolls', {}),
      ),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [orgId, month]);

  const current = (key) => (monthly[key]?.month === month ? monthly[key].value : null);
  const transactions = current('transactions');
  const bonuses = current('bonuses');
  const payrolls = current('payrolls');
  const settings = settingsDocs?.managerId === managerId ? settingsDocs.docs : null;

  return {
    transactions: transactions || [],
    packages: packages || [],
    settingsDocs: settings || [],
    bonuses: bonuses || [],
    payrolls: payrolls || {},
    error,
    loading: !packages || !settings || !transactions || !bonuses || !payrolls,
  };
}
