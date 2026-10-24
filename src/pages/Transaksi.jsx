import { useCallback, useMemo, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { CircleAlert, FileDown, Receipt, Trash2 } from 'lucide-react';
import { db } from '../firebase';
import { Button, EmptyState, Spinner, Tabs, useConfirm, useToast } from '../components/ui';
import AppBar from '../components/layout/AppBar';
import TransactionSummary from '../components/transaksi/TransactionSummary';
import TransactionCard from '../components/transaksi/TransactionCard';
import BusyChart from '../components/transaksi/BusyChart';
import { PERIODS, periodLabel, periodRange } from '../components/transaksi/periods';
import { printReceipt } from '../components/transaksi/printReceipt';
import { shareReport } from '../components/transaksi/shareReport';
import { useTransaksiCatalog, useTransactions } from '../hooks/useTransaksiData';
import { summarizeTransactions } from '../utils/transactions';
import './Transaksi.css';

const KINDS = [
  { value: 'Semua', label: 'Semua' },
  { value: 'Studio', label: 'Studio' },
  { value: 'Photobooth', label: 'Photobooth' },
];
const VIEWS = [
  { value: 'active', label: 'Aktif' },
  { value: 'trash', label: 'Sampah', icon: Trash2 },
];
const SINGLE_DAY = ['today', 'yesterday', 'day_before'];

/**
 * Transaksi: rekap & daftar transaksi per periode. Data, rekap, dan tahap booking sama dengan Snapme_Desktop
 * (hooks/useTransaksiData, utils/transactions). Tambahan Manager: periode lebih lengkap, grafik waktu sibuk,
 * dan laporan PDF (Cloud Function).
 */
export default function Transaksi({ user, orgId, userMeta }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [period, setPeriod] = useState('today');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [kind, setKind] = useState('Semua');
  const [view, setView] = useState('active');
  const [expandedId, setExpandedId] = useState(null);
  const [isSharing, setIsSharing] = useState(false);

  const range = useMemo(() => periodRange(period, custom), [period, custom]);
  const { transactions, bookings, loading, error } = useTransactions(orgId, range.startDate, range.endDate);
  const { kasirSettings, packages, addOns, templates, photobooths } = useTransaksiCatalog(orgId);

  const isPhotobooth = useCallback(
    (tx) => {
      const booking = bookings[tx.bookingId];
      return !!booking && photobooths.includes(booking.studio);
    },
    [bookings, photobooths],
  );
  const matchesKind = useCallback((tx) => kind === 'Semua' || (kind === 'Photobooth') === isPhotobooth(tx), [kind, isPhotobooth]);

  // Rekap hanya menghitung transaksi aktif (yang di sampah diabaikan)
  const active = useMemo(() => transactions.filter((tx) => !tx.isDeleted && matchesKind(tx)), [transactions, matchesKind]);
  const summary = useMemo(() => summarizeTransactions(active, { packages, addOns, templates }), [active, packages, addOns, templates]);
  const inTrash = view === 'trash';
  const visible = transactions.filter((tx) => inTrash === !!tx.isDeleted && matchesKind(tx));

  const isSingleDay = SINGLE_DAY.includes(period) || (period === 'custom' && (!custom.to || custom.to === custom.from));
  const busyMode = isSingleDay ? 'hour' : period === 'all' ? 'month' : 'day';

  const handlePrint = (tx) => {
    if (!printReceipt(tx, { user, userMeta, kasirSettings })) {
      toast.warning('Pop-up diblokir', 'Izinkan pop-up untuk situs ini agar nota bisa dicetak.');
    }
  };

  // Hapus = pindah ke sampah (isDeleted), bisa dipulihkan; sama dengan Desktop
  const handleToggleDeleted = async (tx) => {
    const restoring = !!tx.isDeleted;
    const ok = await confirm(
      restoring
        ? {
            title: 'Pulihkan transaksi?',
            message: 'Transaksi ini akan dikembalikan dan dihitung lagi di rekap pendapatan.',
            confirmText: 'Pulihkan',
          }
        : {
            title: 'Hapus transaksi?',
            message: 'Transaksi ini disembunyikan dari rekap pendapatan. Anda masih bisa memulihkannya dari Sampah.',
            confirmText: 'Hapus',
            destructive: true,
          },
    );
    if (!ok) return;
    try {
      await updateDoc(doc(db, 'organizations', orgId, 'transactions', tx.id), { isDeleted: !restoring });
      toast.success(restoring ? 'Transaksi dipulihkan' : 'Transaksi dipindah ke sampah', tx.customerName);
    } catch (err) {
      console.error('[Transaksi] Gagal mengubah status transaksi', err);
      toast.error('Gagal mengubah status transaksi', err.message);
    }
  };

  const handleShare = async () => {
    setIsSharing(true);
    try {
      await shareReport({ user, orgId, range, filterTab: kind, label: periodLabel(period, range) });
    } catch (err) {
      console.error('[Transaksi] Gagal membuat laporan', err);
      toast.error('Gagal membuat laporan', err.message);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <>
      <AppBar
        title="Transaksi"
        actions={
          <Button variant="ghost" size="sm" icon={FileDown} loading={isSharing} onClick={handleShare}>
            Laporan
          </Button>
        }
      />

      <div className="trx-toolbar">
        <div className="chip-row" role="group" aria-label="Periode">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              className={`chip${period === p.value ? ' is-active' : ''}`}
              aria-pressed={period === p.value}
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="trx-custom">
            <input
              type="date"
              className="input"
              aria-label="Dari tanggal"
              value={custom.from}
              onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
            />
            <span>s/d</span>
            <input
              type="date"
              className="input"
              aria-label="Sampai tanggal"
              value={custom.to}
              min={custom.from || undefined}
              onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
            />
          </div>
        )}
        <div className="trx-filters">
          <Tabs options={KINDS} value={kind} onChange={setKind} ariaLabel="Jenis layanan" />
          <Tabs options={VIEWS} value={view} onChange={setView} ariaLabel="Tampilan" />
        </div>
      </div>

      <div className="page-body">
        {loading ? (
          <div className="page-loading">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <EmptyState icon={CircleAlert} title="Gagal memuat transaksi" description={error} />
        ) : (
          <>
            {!inTrash && (
              <>
                <TransactionSummary summary={summary} />
                {active.length > 0 && <BusyChart transactions={active} baseMode={busyMode} range={range} />}
              </>
            )}

            <div className="trx-list-head">
              <h2 className="trx-list-title">{inTrash ? 'Transaksi di sampah' : 'Daftar transaksi'}</h2>
              <span className="trx-list-count num">{visible.length} transaksi</span>
            </div>
            {visible.length === 0 ? (
              <EmptyState
                icon={inTrash ? Trash2 : Receipt}
                title={inTrash ? 'Sampah kosong' : 'Belum ada transaksi'}
                description={
                  inTrash
                    ? 'Transaksi yang dihapus pada periode ini akan muncul di sini.'
                    : 'Ubah periode atau jenis layanan untuk melihat transaksi lain.'
                }
              />
            ) : (
              <div className="trx-list">
                {visible.map((tx) => (
                  <TransactionCard
                    key={tx.id}
                    tx={tx}
                    booking={bookings[tx.bookingId]}
                    isPhotobooth={isPhotobooth(tx)}
                    expanded={expandedId === tx.id}
                    onToggle={() => setExpandedId(expandedId === tx.id ? null : tx.id)}
                    onPrint={handlePrint}
                    onToggleDeleted={handleToggleDeleted}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
