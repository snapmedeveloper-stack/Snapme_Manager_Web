import { useState } from 'react';
import { Card, Tabs } from '../ui';
import { busyBuckets } from './periods';

const TITLE = { hour: 'Jam sibuk', day: 'Hari sibuk', month: 'Bulan sibuk' };

/**
 * Grafik batang jumlah transaksi per waktu (tanpa library grafik). baseMode dari periode: satu hari = per jam,
 * Semua = per bulan, selain itu per hari dengan pilihan akumulasi per jam.
 */
export default function BusyChart({ transactions, baseMode, range }) {
  const [mode, setMode] = useState(baseMode);
  // Periode berganti (mis. Hari ini → Bulan ini): kembali ke tampilan bawaan periode itu
  const [lastBase, setLastBase] = useState(baseMode);
  if (lastBase !== baseMode) {
    setLastBase(baseMode);
    setMode(baseMode);
  }

  const buckets = busyBuckets(transactions, mode, range);
  const max = Math.max(1, ...buckets.map((b) => b.count));

  return (
    <Card
      title={TITLE[mode]}
      actions={
        baseMode === 'day' && (
          <Tabs
            options={[
              { value: 'day', label: 'Per hari' },
              { value: 'hour', label: 'Per jam' },
            ]}
            value={mode}
            onChange={setMode}
            ariaLabel="Kelompok waktu"
          />
        )
      }
    >
      <div className="trx-chart" role="img" aria-label={`${TITLE[mode]}: jumlah transaksi per waktu`}>
        {buckets.map((b) => (
          <div key={b.key} className="trx-chart-col" title={`${b.label}: ${b.count} transaksi`}>
            <span className="trx-chart-value num">{b.count || ''}</span>
            <div className="trx-chart-track">
              <div className="trx-chart-bar" style={{ height: `${(b.count / max) * 100}%` }} />
            </div>
            <span className="trx-chart-label num">{b.label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
