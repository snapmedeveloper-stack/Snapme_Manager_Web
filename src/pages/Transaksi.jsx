import React, { useState, useEffect, useMemo } from 'react';
import { Search, Download } from 'lucide-react';
import { db } from '../firebase';
import { collection, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';

const Transaksi = ({ orgId }) => {
  const [transactions, setTransactions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  });

  useEffect(() => {
    if (!orgId) return;

    // We'll fetch transactions for the selected day
    const d = new Date(filterDate);
    const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

    const q = query(
      collection(db, 'organizations', orgId, 'transactions'),
      where('createdAt', '>=', startOfDay),
      where('createdAt', '<', endOfDay)
    );

    const unsub = onSnapshot(q, (snap) => {
      const txs = [];
      snap.forEach(doc => {
        txs.push({ id: doc.id, ...doc.data() });
      });
      // Sort desc by createdAt client-side to avoid needing a composite index
      txs.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });
      setTransactions(txs);
    });

    return () => unsub();
  }, [orgId, filterDate]);

  const filtered = transactions.filter(t => {
    const term = searchTerm.toLowerCase();
    const custMatch = t.customerName?.toLowerCase().includes(term) || t.customer?.toLowerCase().includes(term);
    const idMatch = t.id.toLowerCase().includes(term);
    return custMatch || idMatch;
  });

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Riwayat Transaksi</h1>
        <button className="btn btn-primary" style={{ backgroundColor: 'var(--success-color)' }}>
          <Download size={18} /> Export Excel
        </button>
      </div>

      <div className="card">
        <div style={{ display: 'flex', marginBottom: '24px', gap: '12px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input 
              type="text" 
              placeholder="Cari ID Transaksi atau Nama..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ 
                width: '100%', 
                padding: '10px 10px 10px 40px', 
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                outline: 'none'
              }}
            />
          </div>
          <input 
            type="date" 
            className="btn" 
            style={{ border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)' }}
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
          />
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID Transaksi</th>
                <th>Waktu</th>
                <th>Customer</th>
                <th>Kasir</th>
                <th>Metode Bayar</th>
                <th>Jumlah</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                    Transaksi tidak ditemukan
                  </td>
                </tr>
              ) : (
                filtered.map((trx) => {
                  let timeStr = '-';
                  if (trx.createdAt && trx.createdAt.toDate) {
                    timeStr = trx.createdAt.toDate().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                  }

                  const amount = trx.totalAmount || trx.amount || 0;
                  const customer = trx.customerName || trx.customer || '-';
                  const kasirName = trx.cashierName || trx.createdByEmail?.split('@')[0] || '-';
                  const method = trx.paymentMethod || '-';

                  return (
                    <tr key={trx.id}>
                      <td style={{ fontWeight: 500 }}>{trx.id}</td>
                      <td>{timeStr}</td>
                      <td>{customer}</td>
                      <td>{kasirName}</td>
                      <td>
                        <span style={{ 
                          padding: '4px 8px', 
                          borderRadius: '4px', 
                          fontSize: '0.8rem',
                          backgroundColor: '#f3f4f6',
                          color: 'var(--text-secondary)',
                          fontWeight: 500
                        }}>
                          {method}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--success-color)' }}>
                        Rp {amount.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Transaksi;
