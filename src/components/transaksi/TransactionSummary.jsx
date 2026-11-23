import { Card } from '../ui';
import { formatRupiah } from '../../utils/format';

// Sama dengan TransactionSummary Snapme_Desktop
const CATEGORIES = [
  { key: 'paket', label: 'Paket' },
  { key: 'tambahan', label: 'Item tambahan' },
  { key: 'cetak', label: 'Cetak' },
  { key: 'lainnya', label: 'Produk & lainnya' },
  // DP bersih: DP diterima dikurangi DP yang dipotong saat pelunasan di periode ini (bisa negatif); tampil bila ada
  { key: 'dp', label: 'DP (bersih)', optional: true },
];

const percentOf = (part, total) => (total > 0 ? Math.round((part / total) * 100) : 0);

function StatTile({ label, value, hint, hero = false }) {
  return (
    <div className={`card trx-stat${hero ? ' is-hero' : ''}`}>
      <span className="trx-stat-label">{label}</span>
      <span className="num trx-stat-value">{value}</span>
      <span className="trx-stat-hint">{hint}</span>
    </div>
  );
}

/** Rekap periode terpilih: kartu angka, lalu porsi pendapatan per kategori item (summarizeTransactions). */
export default function TransactionSummary({ summary }) {
  const { revenue, count, bookingCount, depositCount, average, cash, transfer, byCategory } = summary;
  const categories = CATEGORIES.filter(({ key, optional }) => !optional || byCategory[key] !== 0);
  const categoryTotal = categories.reduce((sum, { key }) => sum + Math.max(0, byCategory[key]), 0);

  return (
    <>
      <div className="trx-stats">
        <StatTile hero label="Pendapatan" value={formatRupiah(revenue)} hint={`Rata-rata ${formatRupiah(average)} per transaksi`} />
        <StatTile
          label="Transaksi"
          value={count}
          hint={`${bookingCount} dari booking${depositCount ? ` · ${depositCount} DP` : ''}`}
        />
        <StatTile label="Tunai" value={formatRupiah(cash)} hint={`${percentOf(cash, revenue)}% pendapatan`} />
        <StatTile label="Transfer" value={formatRupiah(transfer)} hint={`${percentOf(transfer, revenue)}% pendapatan`} />
      </div>

      <Card title="Pendapatan per kategori">
        <ul className="trx-categories">
          {categories.map(({ key, label }) => {
            const share = percentOf(Math.max(0, byCategory[key]), categoryTotal);
            return (
              <li key={key} className="trx-category">
                <div className="trx-category-head">
                  <span>{label}</span>
                  <span className="num trx-category-value">
                    {formatRupiah(byCategory[key])} · {share}%
                  </span>
                </div>
                <div className="trx-bar" aria-hidden="true">
                  <div className="trx-bar-fill" style={{ width: `${share}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}
