import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, onSnapshot, doc, getDoc, query, where, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function Transaksi({ user, orgId, userMeta }) {
  const [filter, setFilter] = useState('today'); // 'today', 'week', 'month', 'custom', 'all'
  const [customDate, setCustomDate] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, tx: null });
  const [transactions, setTransactions] = useState([]);
  const [bookingsData, setBookingsData] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const [kasirSettings, setKasirSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const dateInputRef = useRef(null);

  // Data Katalog untuk kategorisasi rekap
  const [packages, setPackages] = useState([]);
  const [addOns, setAddOns] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [customSections, setCustomSections] = useState([]);
  const [photobooths, setPhotobooths] = useState([]);
  const [filterTab, setFilterTab] = useState('Semua'); // 'Semua' | 'Studio' | 'Photobooth'

  // Menentukan batas tanggal berdasarkan filter
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    let start = null;
    let end = null;
    if (filter === 'today') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (filter === 'week') {
      start = new Date(now);
      start.setDate(now.getDate() - now.getDay()); // Mulai hari minggu
      start.setHours(0, 0, 0, 0);
    } else if (filter === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (filter === 'custom' && customDate) {
      start = new Date(customDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(end.getDate() + 1);
    }
    return { startDate: start, endDate: end };
  }, [filter, customDate]);

  // Load Settings Kasir (untuk header/footer nota)
  useEffect(() => {
    if (!orgId) return;
    const unsubKasir = onSnapshot(doc(db, 'organizations', orgId, 'settings', 'kasir'), (snap) => {
      if (snap.exists()) setKasirSettings(snap.data());
    });
    
    // Load data katalog untuk mengkategorikan item
    const unsubPkg = onSnapshot(collection(db, 'organizations', orgId, 'packages'), snap => {
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data(), order: d.data().order || 0 }));
      arr.sort((a,b) => a.order - b.order);
      setPackages(arr);
    });
    const unsubAo = onSnapshot(collection(db, 'organizations', orgId, 'add_ons'), snap => {
      setAddOns(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubTpl = onSnapshot(collection(db, 'organizations', orgId, 'templates'), snap => {
      setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubCat = onSnapshot(doc(db, 'organizations', orgId, 'kasir', 'catalog'), snap => {
      if (snap.exists() && snap.data().sections) {
        setCustomSections(snap.data().sections.filter(s => s.name !== 'JENIS STUDIO' && s.name !== 'ITEM TAMBAHAN' && s.name !== 'CETAK'));
      }
    });
    const unsubPb = onSnapshot(collection(db, 'organizations', orgId, 'photobooths'), snap => {
      setPhotobooths(snap.docs.map(d => d.id)); // just save the IDs for fast lookup
    });

    return () => {
      unsubKasir(); unsubPkg(); unsubAo(); unsubTpl(); unsubCat(); unsubPb();
    };
  }, [orgId]);

  // Load Transactions & Bookings
  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    const txRef = collection(db, 'organizations', orgId, 'transactions');
    let q;
    if (startDate && endDate) {
      q = query(txRef, where('createdAt', '>=', startDate), where('createdAt', '<', endDate));
    } else if (startDate) {
      q = query(txRef, where('createdAt', '>=', startDate));
    } else {
      q = query(txRef);
    }

    const unsub = onSnapshot(q, async (snap) => {
      const txs = [];
      const bIds = new Set();
      snap.forEach(d => {
        const data = d.data();
        txs.push({ id: d.id, ...data });
        if (data.bookingId) bIds.add(data.bookingId);
      });
      
      // Sorting desc secara manual karena query menggunakan where('createdAt')
      txs.sort((a,b) => {
        const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return tB - tA;
      });

      setTransactions(txs);

      // Fetch booking data yang terkait secara batch
      const newBookingsData = { ...bookingsData };
      const fetchPromises = [];
      for (const bId of bIds) {
        if (!newBookingsData[bId]) {
          fetchPromises.push(getDoc(doc(db, 'organizations', orgId, 'bookings', bId)).then(d => {
            if (d.exists()) {
              newBookingsData[bId] = { id: d.id, ...d.data() };
            }
          }));
        }
      }
      
      if (fetchPromises.length > 0) {
        await Promise.all(fetchPromises);
        setBookingsData(prev => ({ ...prev, ...newBookingsData }));
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching transactions:", error);
      setLoading(false);
    });

    return () => unsub();
  }, [orgId, startDate, endDate]); // eslint-disable-next-line

  const formatRupiah = (num) => `Rp ${(num || 0).toLocaleString('id-ID')}`;

  const calculateStage = (booking, isPb) => {
    if (!booking) return null;
    if (isPb) {
      if (booking.processCompleted) return 4;
      if (booking.driveFolderId && booking.arrivedAt) return 3; // Proses Pemotretan/Upload
      if (booking.arrivedAt) return 2; // Datang
      return 1; // Belum Datang
    }

    const transferDone = booking.transferDone || false;
    const printDone = booking.receiptPrinted || false;
    const printSkip = booking.printSkipped || false;
    const kasirDone = booking.paid || false;
    const hasWa = !!(booking.waNumber || booking.customerPhone);
    const waSent = booking.waSent || false;
    const captionCopied = booking.captionCopied || false;
    const fbUpload = booking.uploadProgress || {};
    const uploadRatio = (fbUpload.totalDetected || 0) > 0 ? (fbUpload.uploadedCount || 0) / fbUpload.totalDetected : 0;
    const uploadForceCompleted = booking.uploadForceCompleted || false;

    let stage = 1;
    if (transferDone) stage = 2;
    if (transferDone && (printDone || printSkip)) stage = 3;
    if (stage === 3 && kasirDone) stage = 4;
    if (stage === 4 && (hasWa || captionCopied)) stage = 5;
    if (stage === 5 && (waSent || captionCopied) && (uploadRatio >= 1 || uploadForceCompleted)) stage = 6;
    if (booking.processCompleted) stage = 6;
    return stage;
  };

  const STAGE_LABELS = ['Transfer', 'Edit & Print', 'Kasir', 'Tautkan WA', 'Caption & Upload', 'Selesai'];
  const PB_STAGE_LABELS = ['Belum Datang', 'Folder Dibuat', 'Pemotretan & Upload', 'Selesai'];

  const handlePrintNota = (tx) => {
    const createdAtMillis = tx.createdAt?.toMillis ? tx.createdAt.toMillis() : Date.now();
    const dateStr = new Date(createdAtMillis).toLocaleString('id-ID', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    
    const businessName = kasirSettings.businessName || 'Snapme Studio';
    const address = kasirSettings.address || '';
    const phone = kasirSettings.phone || '';
    const footerNote = kasirSettings.footerNote || 'Terima kasih atas kunjungannya';
    const kasirName = userMeta?.name || user?.displayName || 'Kasir';
    const folderName = tx.bookingDate ? `${tx.customerName} - ${tx.bookingDate}` : tx.customerName;

    const itemsHtml = (tx.items || []).map(item => `
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
        <span style="flex: 1;">${item.name}</span>
        <span style="width: 80px; text-align: right;">${formatRupiah(item.price * item.qty)}</span>
      </div>
      <div style="font-size: 11px; color: #555; margin-bottom: 8px;">
        ${item.qty}x @ ${formatRupiah(item.price)}
      </div>
    `).join('');

    const html = `
      <html>
        <head>
          <title>Nota Transaksi - ${tx.id}</title>
          <style>
            @page { margin: 0; size: 80mm auto; }
            body { 
              font-family: 'Courier New', Courier, monospace; 
              width: 80mm; 
              margin: 0 auto; 
              padding: 10px; 
              box-sizing: border-box; 
              font-size: 12px;
              color: #000;
            }
            .center { text-align: center; }
            .divider { border-bottom: 1px dashed #000; margin: 10px 0; }
            .bold { font-weight: bold; }
            .row { display: flex; justify-content: space-between; margin-bottom: 4px; }
          </style>
        </head>
        <body>
          <div class="center bold" style="font-size: 16px; margin-bottom: 4px;">${businessName}</div>
          <div class="center" style="margin-bottom: 4px;">${address}</div>
          <div class="center" style="margin-bottom: 12px;">Telp: ${phone}</div>
          
          <div class="row">
            <span>No:</span>
            <span>${tx.id.substring(0,8).toUpperCase()}</span>
          </div>
          <div class="row">
            <span>Tgl:</span>
            <span>${dateStr}</span>
          </div>
          <div class="row">
            <span>Kasir:</span>
            <span>${kasirName}</span>
          </div>
          <div class="row">
            <span>Pelanggan:</span>
            <span>${tx.customerName || '-'}</span>
          </div>
          <div class="row">
            <span>Folder:</span>
            <span>${folderName}</span>
          </div>

          <div class="divider"></div>
          
          ${itemsHtml}

          <div class="divider"></div>

          <div class="row bold">
            <span>Total:</span>
            <span>${formatRupiah(tx.totalAmount || tx.amountPaid)}</span>
          </div>
          <div class="row">
            <span>Metode:</span>
            <span style="text-transform: uppercase">${tx.paymentMethod}</span>
          </div>
          <div class="row">
            <span>Dibayar:</span>
            <span>${formatRupiah(tx.amountPaid)}</span>
          </div>
          <div class="row">
            <span>Kembali:</span>
            <span>${formatRupiah(tx.change)}</span>
          </div>

          <div class="divider"></div>
          <div class="center" style="margin-top: 16px;">${footerNote}</div>
          
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
    } else {
      alert('Pop-up diblokir. Harap izinkan pop-up untuk mencetak nota.');
    }
  };

  const requestToggleDeleteStatus = (tx) => {
    setConfirmDialog({ isOpen: true, tx });
  };

  const confirmToggleDeleteStatus = async () => {
    if (!orgId || !confirmDialog.tx) return;
    const tx = confirmDialog.tx;
    const isCurrentlyDeleted = !!tx.isDeleted;

    try {
      await updateDoc(doc(db, 'organizations', orgId, 'transactions', tx.id), {
        isDeleted: !isCurrentlyDeleted
      });
      setConfirmDialog({ isOpen: false, tx: null });
    } catch (err) {
      console.error('Gagal mengubah status transaksi:', err);
      alert('Gagal mengubah status: ' + err.message);
    }
  };

  // Hitung Rekap & Chart Data
  const { summary, chartData, pieData, busyHoursData, studioSummary, pbSummary } = useMemo(() => {
    let totalBokingan = 0;
    let totalNominal = 0;
    let totalPaket = 0;
    let totalTambahan = 0;
    let totalCetak = 0;
    let totalCustom = 0;
    let totalTunai = 0;
    let totalTransfer = 0;
    let transactionCount = 0;

    let studioSummary = { revenue: 0, count: 0, aov: 0 };
    let pbSummary = { revenue: 0, count: 0, aov: 0 };

    const dataMap = new Map();
    const busyHoursMap = new Map();

    transactions.forEach(tx => {
      if (tx.isDeleted) return; // ABAIKAN TRANSAKSI YANG DIHAPUS

      const bData = bookingsData[tx.bookingId];
      const isPb = bData && photobooths.includes(bData.studio);
      
      if (filterTab === 'Studio' && isPb) return;
      if (filterTab === 'Photobooth' && !isPb) return;

      transactionCount++;
      if (tx.bookingId) totalBokingan++;
      const txTotal = tx.total || 0;
      totalNominal += txTotal;
      
      if (isPb) {
        pbSummary.revenue += txTotal;
        pbSummary.count++;
      } else {
        studioSummary.revenue += txTotal;
        studioSummary.count++;
      }
      
      if (tx.paymentMethod === 'transfer') totalTransfer += txTotal;
      else totalTunai += txTotal;
      
      (tx.items || []).forEach(item => {
        const itemTotal = (item.price || 0) * (item.qty || 1);
        
        // Kategori heuristik
        if (packages.some(p => p.id === item.id)) {
          totalPaket += itemTotal;
        } else if (addOns.some(a => a.id === item.id)) {
          totalTambahan += itemTotal;
        } else if (item.id.startsWith('cetak_') || templates.some(t => t.id === item.id)) {
          totalCetak += itemTotal;
        } else {
          let isCustom = false;
          for (const sec of customSections) {
            if (sec.products && sec.products.some(p => p.id === item.id)) {
              isCustom = true;
              break;
            }
          }
          if (isCustom) totalCustom += itemTotal;
          else totalCustom += itemTotal;
        }
      });

      // --- CHART GROUPING ---
      const dateMillis = tx.createdAt?.toMillis ? tx.createdAt.toMillis() : Date.now();
      const d = new Date(dateMillis);
      let label = '';
      
      // Jam Sibuk Aggregation
      const hourStr = `${d.getHours().toString().padStart(2, '0')}:00`;
      busyHoursMap.set(hourStr, (busyHoursMap.get(hourStr) || 0) + 1);
      
      if (filter === 'today') {
        label = `${d.getHours().toString().padStart(2, '0')}:00`;
      } else if (filter === 'week') {
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        label = days[d.getDay()];
      } else if (filter === 'month') {
        label = `Tgl ${d.getDate()}`;
      } else {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
        label = months[d.getMonth()];
      }

      if (!dataMap.has(label)) {
        dataMap.set(label, { name: label, Total: 0, Bokingan: 0 });
      }
      const mapItem = dataMap.get(label);
      mapItem.Total += txTotal;
      if (tx.bookingId) mapItem.Bokingan += 1;
    });

    // Sorting chart data
    let sortedChartData = Array.from(dataMap.values());
    if (filter === 'today') {
      sortedChartData.sort((a, b) => a.name.localeCompare(b.name));
    } else if (filter === 'week') {
       const dayOrder = { 'Senin':1, 'Selasa':2, 'Rabu':3, 'Kamis':4, 'Jumat':5, 'Sabtu':6, 'Minggu':7 };
       sortedChartData.sort((a,b) => dayOrder[a.name] - dayOrder[b.name]);
    } else if (filter === 'month') {
       sortedChartData.sort((a,b) => parseInt(a.name.replace('Tgl ', '')) - parseInt(b.name.replace('Tgl ', '')));
    } else {
       const monthOrder = { 'Jan':1, 'Feb':2, 'Mar':3, 'Apr':4, 'Mei':5, 'Jun':6, 'Jul':7, 'Ags':8, 'Sep':9, 'Okt':10, 'Nov':11, 'Des':12 };
       sortedChartData.sort((a,b) => monthOrder[a.name] - monthOrder[b.name]);
    }

    const pieData = [
      { name: 'Paket', value: totalPaket },
      { name: 'Cetak', value: totalCetak },
      { name: 'Produk/Custom', value: totalCustom + totalTambahan }
    ].filter(d => d.value > 0);

    const aov = transactionCount > 0 ? Math.round(totalNominal / transactionCount) : 0;
    
    studioSummary.aov = studioSummary.count > 0 ? Math.round(studioSummary.revenue / studioSummary.count) : 0;
    pbSummary.aov = pbSummary.count > 0 ? Math.round(pbSummary.revenue / pbSummary.count) : 0;

    const busyHoursData = Array.from(busyHoursMap.entries())
      .map(([hour, count]) => ({ hour, Transaksi: count }))
      .sort((a, b) => a.hour.localeCompare(b.hour));

    return { 
      summary: { totalBokingan, totalNominal, totalPaket, totalTambahan, totalCetak, totalCustom, totalTunai, totalTransfer, transactionCount, aov },
      chartData: sortedChartData,
      pieData,
      busyHoursData,
      studioSummary,
      pbSummary
    };
  }, [transactions, packages, addOns, templates, customSections, bookingsData, photobooths, filterTab, filter]);

  const getPeriodeLabel = () => {
    if (filter === 'all') return 'Semua Waktu';
    if (filter === 'custom') return customDate;
    if (filter === 'today' && startDate) {
      return 'Hari Ini (' + startDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) + ')';
    }
    if (startDate) {
      const startStr = startDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
      const endStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
      if (filter === 'week') return 'Minggu Ini (' + startStr + ' - ' + endStr + ')';
      if (filter === 'month') return 'Bulan Ini (' + startStr + ' - ' + endStr + ')';
    }
    return '';
  };

  return (
    <>
      <div className="page-enter no-print" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)' }}>
      {/* Header & Filter */}
      <div style={{ padding: '12px 16px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 12, zIndex: 10 }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px', margin: 0, color: 'var(--text-primary)' }}>
            Transaksi
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => window.print()}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 12, cursor: 'pointer', transition: 'opacity 0.2s' }}
              onMouseOver={e => e.currentTarget.style.opacity = 0.8}
              onMouseOut={e => e.currentTarget.style.opacity = 1}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
              Cetak Laporan
            </button>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: showDeleted ? '#ef4444' : 'var(--text-secondary)', fontWeight: 600, background: showDeleted ? 'rgba(239, 68, 68, 0.1)' : 'transparent', padding: '4px 8px', borderRadius: 6, border: showDeleted ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid transparent' }}>
              <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} style={{ accentColor: '#ef4444', width: 14, height: 14, margin: 0, cursor: 'pointer' }} />
              Sampah
            </label>
          </div>
        </div>

        <div className="hide-scrollbar" style={{ display: 'flex', gap: 8, alignItems: 'center', overflowX: 'auto', paddingBottom: 4, whiteSpace: 'nowrap' }}>
          {filter === 'custom' ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                ref={dateInputRef}
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-base)',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  fontWeight: 600,
                  outline: 'none',
                  cursor: 'pointer'
                }}
              />
              <button 
                onClick={() => setFilter('today')} 
                title="Tutup Kalender"
                style={{ padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
          ) : (
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-base)',
                color: 'var(--text-primary)',
                fontWeight: 600,
                fontSize: 12,
                cursor: 'pointer',
                outline: 'none',
                appearance: 'auto'
              }}
            >
              <option value="today">Hari Ini</option>
              <option value="week">Minggu Ini</option>
              <option value="month">Bulan Ini</option>
              <option value="all">Semua</option>
              <option value="custom">Pilih Tanggal...</option>
            </select>
          )}
          
          <select
            value={filterTab}
            onChange={(e) => setFilterTab(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-base)',
              color: 'var(--text-primary)',
              fontWeight: 600,
              fontSize: 12,
              cursor: 'pointer',
              outline: 'none',
              appearance: 'auto'
            }}
          >
            <option value="Semua">Kategori: Semua</option>
            <option value="Studio">Kategori: Studio</option>
            <option value="Photobooth">Kategori: Photobooth</option>
          </select>


        </div>
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 16px' }}>
        
        {/* Executive Dashboard Section */}
        {!loading && transactions.length > 0 && (
          <div style={{ marginBottom: 40, maxWidth: 1200, margin: '0 auto 40px auto' }}>
            
            {/* Top Row: Main KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
              
              <div style={{ background: 'var(--bg-surface)', padding: '16px', borderRadius: 16, border: '1px solid var(--border-subtle)', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Total Pendapatan</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{formatRupiah(summary.totalNominal)}</div>
                </div>
              </div>

              <div style={{ background: 'var(--bg-surface)', padding: '16px', borderRadius: 16, border: '1px solid var(--border-subtle)', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Total Transaksi</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>
                    {summary.transactionCount} <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>({summary.totalBokingan} Booking)</span>
                  </div>
                </div>
              </div>

              <div style={{ background: 'var(--bg-surface)', padding: '16px', borderRadius: 16, border: '1px solid var(--border-subtle)', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"></path><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"></path></svg>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Rata-rata Order (AOV)</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{formatRupiah(summary.aov)}</div>
                </div>
              </div>
            </div>

            {/* Middle Row: Charts & Breakdowns */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
              
              {/* Pie Chart & Breakdown */}
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', gridColumn: '1 / -1' }}>
                
                {/* Pie Chart: Sumber Pendapatan */}
                <div style={{ background: 'var(--bg-surface)', padding: '24px', borderRadius: 24, border: '1px solid var(--border-subtle)', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', flex: '1 1 300px' }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: 16, color: 'var(--text-primary)' }}>Sumber Pendapatan</h3>
                  {pieData.length > 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <div style={{ width: 140, height: 140 }}>
                        <ResponsiveContainer>
                          <PieChart>
                            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={65} stroke="none">
                              {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={['#f59e0b', '#8b5cf6', '#ec4899', '#10b981'][index % 4]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value) => formatRupiah(value)} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', background: 'var(--bg-surface)' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, paddingLeft: 16 }}>
                        {pieData.map((entry, index) => (
                          <div key={index} style={{ display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <div style={{ width: 10, height: 10, borderRadius: '50%', background: ['#f59e0b', '#8b5cf6', '#ec4899', '#10b981'][index % 4] }}></div>
                              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{entry.name}</span>
                            </div>
                            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', paddingLeft: 18 }}>{formatRupiah(entry.value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Belum ada data pendapatan.</div>
                  )}
                </div>

                {/* Metode Pembayaran */}
                <div style={{ background: 'var(--bg-surface)', padding: '24px', borderRadius: 24, border: '1px solid var(--border-subtle)', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', flex: '1 1 240px' }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: 16, color: 'var(--text-primary)' }}>Metode Pembayaran</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 16 }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 14, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}><span style={{fontSize:18}}>💳</span> Transfer / QR</span>
                        <span style={{ fontSize: 15, fontWeight: 700 }}>{formatRupiah(summary.totalTransfer)}</span>
                      </div>
                      <div style={{ height: 8, background: 'var(--bg-base)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: '#3b82f6', width: summary.totalNominal > 0 ? `${(summary.totalTransfer/summary.totalNominal)*100}%` : '0%' }}></div>
                      </div>
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 14, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}><span style={{fontSize:18}}>💵</span> Tunai</span>
                        <span style={{ fontSize: 15, fontWeight: 700 }}>{formatRupiah(summary.totalTunai)}</span>
                      </div>
                      <div style={{ height: 8, background: 'var(--bg-base)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: '#10b981', width: summary.totalNominal > 0 ? `${(summary.totalTunai/summary.totalNominal)*100}%` : '0%' }}></div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Jam Sibuk Chart */}
            <div style={{ background: 'var(--bg-surface)', padding: '24px', borderRadius: 24, border: '1px solid var(--border-subtle)', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', marginTop: 24 }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: 16, color: 'var(--text-primary)' }}>Analisis Jam Sibuk</h3>
              <div style={{ height: 250 }}>
                {busyHoursData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={busyHoursData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
                      <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                      <Tooltip cursor={{ fill: 'var(--bg-hover)' }} contentStyle={{ borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }} />
                      <Bar dataKey="Transaksi" fill="#a855f7" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Belum ada data jam sibuk.</div>
                )}
              </div>
            </div>

          </div>
        )}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-muted)' }}>
            Loading transaksi...
          </div>
        ) : transactions.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>🧾</span>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Belum ada transaksi</div>
            <div style={{ fontSize: 14 }}>Ubah filter untuk melihat periode waktu lainnya.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 900, margin: '0 auto' }}>
            {transactions.filter(tx => showDeleted ? tx.isDeleted : !tx.isDeleted).map(tx => {
              const bData = tx.bookingId ? bookingsData[tx.bookingId] : null;
              const isPb = bData && photobooths.includes(bData.studio);
              
              if (filterTab === 'Studio' && isPb) return null;
              if (filterTab === 'Photobooth' && !isPb) return null;

              const stage = calculateStage(bData, isPb);
              const isExpanded = expandedId === tx.id;
              
              const dateMillis = tx.createdAt?.toMillis ? tx.createdAt.toMillis() : Date.now();
              const formattedDate = new Date(dateMillis).toLocaleString('id-ID', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
              });

              return (
                <div key={tx.id} style={{
                  background: 'var(--bg-surface)',
                  borderRadius: 16,
                  border: isExpanded ? '2px solid var(--accent-primary)' : (tx.isDeleted ? '1px solid #ef4444' : '1px solid var(--border-subtle)'),
                  opacity: tx.isDeleted ? 0.75 : 1,
                  filter: tx.isDeleted && !isExpanded ? 'grayscale(0.4)' : 'none',
                  overflow: 'hidden',
                  transition: 'all 0.3s ease',
                  boxShadow: isExpanded ? '0 8px 30px rgba(0,0,0,0.1)' : '0 2px 10px rgba(0,0,0,0.02)'
                }}>
                  {/* Card Header (Summary) */}
                  <div 
                    onClick={() => setExpandedId(isExpanded ? null : tx.id)}
                    style={{ 
                      padding: '12px 16px', 
                      display: 'flex', 
                      flexWrap: 'wrap',
                      gap: 12,
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      cursor: 'pointer',
                      background: isExpanded ? 'var(--bg-base)' : 'transparent'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '1 1 250px' }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--accent-subtle)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                        {tx.paymentMethod === 'transfer' ? '💳' : '💵'}
                      </div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                          {tx.customerName}
                          {isPb && <span style={{ marginLeft: 8, fontSize: 9, background: 'rgba(168,85,247,0.1)', color: '#a855f7', padding: '2px 6px', borderRadius: 4 }}>PHOTOBOOTH</span>}
                          {tx.isDeleted && <span style={{ fontSize: 9, background: '#ef4444', color: '#fff', padding: '2px 6px', borderRadius: 4, fontWeight: 800 }}>DIHAPUS</span>}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{formattedDate} • {tx.transactionNumber}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: '1 1 200px', justifyContent: 'space-between' }}>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 2 }}>{formatRupiah(tx.total)}</div>
                        <div style={{ 
                          fontSize: 9, fontWeight: 800, 
                          color: (isPb && stage === 4) || (!isPb && stage === 6) ? '#10b981' : 'var(--accent-primary)',
                          background: (isPb && stage === 4) || (!isPb && stage === 6) ? 'rgba(16,185,129,0.1)' : 'rgba(56, 189, 248, 0.1)', 
                          padding: '4px 8px', borderRadius: 6,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          display: 'inline-block'
                        }}>
                          {stage ? `Tahap ${stage}: ${isPb ? PB_STAGE_LABELS[stage - 1] : STAGE_LABELS[stage - 1]}` : 'Tanpa Booking'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handlePrintNota(tx, true); }}
                          title="Simpan & Cetak Nota"
                          style={{ background: 'var(--bg-hover)', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
                          onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-active)'}
                          onMouseOut={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                        </button>
                        <div style={{ 
                          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', 
                          transition: 'transform 0.3s',
                          color: 'var(--text-muted)'
                        }}>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Body (Expanded Detail) */}
                  {isExpanded && (
                    <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                        {/* Kolom Kiri: Detail Items */}
                        <div>
                          <h4 style={{ fontSize: 14, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>Item Transaksi</h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {tx.items && tx.items.map((item, idx) => (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                  {item.image ? (
                                    <img src={item.image} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover' }} />
                                  ) : (
                                    <div style={{ width: 36, height: 36, borderRadius: 6, background: item.color || 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📸</div>
                                  )}
                                  <div>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.qty}x @ {formatRupiah(item.price)}</div>
                                  </div>
                                </div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                                  {formatRupiah(item.price * item.qty)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Kolom Kanan: Info Pembayaran & Actions */}
                        <div>
                          <h4 style={{ fontSize: 14, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>Info Pembayaran</h4>
                          <div style={{ background: 'var(--bg-base)', padding: '16px', borderRadius: 12, border: '1px solid var(--border-subtle)', marginBottom: 24 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                              <span style={{ color: 'var(--text-secondary)' }}>Metode</span>
                              <span style={{ fontWeight: 600, textTransform: 'uppercase' }}>{tx.paymentMethod}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                              <span style={{ color: 'var(--text-secondary)' }}>Total Dibayar</span>
                              <span style={{ fontWeight: 600 }}>{formatRupiah(tx.amountPaid)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px dashed var(--border-active)' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>Kembalian</span>
                              <span style={{ fontWeight: 600, color: '#10b981' }}>{formatRupiah(tx.change)}</span>
                            </div>
                          </div>

                          <h4 style={{ fontSize: 14, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>Tindakan</h4>
                          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                            <button 
                              onClick={() => handlePrintNota(tx)}
                              className="btn btn-primary"
                              style={{ flex: 1, minWidth: 140, padding: '10px', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                              Cetak Nota
                            </button>
                            
                            {(bData?.waNumber || bData?.customerPhone) && (
                              <button 
                                onClick={() => window.open(`https://wa.me/${(bData.waNumber || bData.customerPhone).replace(/\D/g, '')}`, '_blank')}
                                style={{ flex: 1, minWidth: 140, padding: '10px', borderRadius: 8, background: '#25D366', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 600, cursor: 'pointer' }}
                              >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                                Hubungi WA
                              </button>
                            )}

                            <button 
                              onClick={() => requestToggleDeleteStatus(tx)}
                              style={{ flex: 1, minWidth: 140, padding: '10px', borderRadius: 8, background: tx.isDeleted ? '#3b82f6' : 'rgba(239, 68, 68, 0.1)', color: tx.isDeleted ? '#fff' : '#ef4444', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                {tx.isDeleted 
                                  ? <><polyline points="1 4 1 10 7 10"></polyline><polyline points="23 20 23 14 17 14"></polyline><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path></>
                                  : <><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></>
                                }
                              </svg>
                              {tx.isDeleted ? 'Pulihkan Transaksi' : 'Hapus Transaksi'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>

      {/* ----------------- HIDDEN PRINT LAYOUT (PDF EXPORT) ----------------- */}
      <div className="print-only" style={{ display: 'none' }}>
        <style>{`
          @media print {
            body { background: white !important; margin: 0; padding: 0; }
            .no-print { display: none !important; }
            
            /* Hide the global layout elements */
            .sidebar, .mobile-header { display: none !important; }
            
            /* Reset layout constraints so the print content fills the page */
            .app-container, .layout-body, .main-content {
              display: block !important;
              margin: 0 !important;
              padding: 0 !important;
              width: 100% !important;
              height: auto !important;
              overflow: visible !important;
            }

            .print-only { 
              display: block !important; 
              width: 100%; 
              padding: 20mm; 
              box-sizing: border-box;
              color: #000;
              font-family: Arial, sans-serif;
            }
            .page-enter { display: none !important; }
            .print-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
            .print-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; background: #f8fafc; }
            .print-card h4 { margin: 0 0 10px 0; font-size: 14px; color: #475569; text-transform: uppercase; }
            .print-card .stat { font-size: 24px; font-weight: bold; color: #0f172a; margin-bottom: 4px; }
            .print-card .sub-stat { font-size: 12px; color: #64748b; }
            .print-table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
            .print-table th { background: #f1f5f9; padding: 10px; text-align: left; border-bottom: 2px solid #cbd5e1; }
            .print-table td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
            @page { size: A4 portrait; margin: 0; }
          }
        `}</style>
        
        <div style={{ textAlign: 'center', marginBottom: 30, borderBottom: '2px solid #0f172a', paddingBottom: 20 }}>
          <h1 style={{ margin: '0 0 8px 0', fontSize: 24, color: '#0f172a' }}>Laporan Rekapitulasi Snapme</h1>
          <p style={{ margin: 0, color: '#475569', fontSize: 14 }}>
            Periode: {getPeriodeLabel()} 
            {' | '}
            Kategori Filter: {filterTab}
          </p>
          <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: 12 }}>Dicetak pada: {new Date().toLocaleString('id-ID')}</p>
        </div>

        <div className="print-grid">
          <div className="print-card" style={{ background: '#ecfdf5', borderColor: '#a7f3d0' }}>
            <h4 style={{ color: '#047857' }}>Studio Performa</h4>
            <div className="stat">{formatRupiah(studioSummary.revenue)}</div>
            <div className="sub-stat">{studioSummary.count} Transaksi | AOV: {formatRupiah(studioSummary.aov)}</div>
          </div>
          <div className="print-card" style={{ background: '#faf5ff', borderColor: '#e9d5ff' }}>
            <h4 style={{ color: '#7e22ce' }}>Photobooth Performa</h4>
            <div className="stat">{formatRupiah(pbSummary.revenue)}</div>
            <div className="sub-stat">{pbSummary.count} Transaksi | AOV: {formatRupiah(pbSummary.aov)}</div>
          </div>
          <div className="print-card" style={{ background: '#eff6ff', borderColor: '#bfdbfe' }}>
            <h4 style={{ color: '#1d4ed8' }}>Transfer / QRIS</h4>
            <div className="stat">{formatRupiah(summary.totalTransfer)}</div>
          </div>
          <div className="print-card" style={{ background: '#fdf4ff', borderColor: '#fbcfe8' }}>
            <h4 style={{ color: '#be185d' }}>Uang Tunai (Cash)</h4>
            <div className="stat">{formatRupiah(summary.totalTunai)}</div>
          </div>
        </div>

        <div style={{ marginBottom: 30, pageBreakInside: 'avoid' }}>
          <h3 style={{ fontSize: 16, color: '#0f172a', marginBottom: 16, borderBottom: '1px solid #cbd5e1', paddingBottom: 8 }}>Analisis Jam Sibuk</h3>
          {busyHoursData.length > 0 ? (
            <div style={{ height: 250, width: '100%', display: 'flex', justifyContent: 'center' }}>
              <BarChart width={650} height={250} data={busyHoursData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} dy={5} />
                <YAxis tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
                <Bar dataKey="Transaksi" fill="#8b5cf6" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </div>
          ) : (
            <div style={{ color: '#64748b', fontSize: 12, fontStyle: 'italic' }}>Tidak ada data jam sibuk pada periode ini.</div>
          )}
        </div>

        <div>
          <h3 style={{ fontSize: 16, color: '#0f172a', marginBottom: 16, borderBottom: '1px solid #cbd5e1', paddingBottom: 8 }}>Rincian Transaksi</h3>
          <table className="print-table">
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Pelanggan</th>
                <th>No. Transaksi</th>
                <th>Kategori</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {transactions.filter(tx => !tx.isDeleted).map(tx => {
                const bData = tx.bookingId ? bookingsData[tx.bookingId] : null;
                const isPb = bData && photobooths.includes(bData.studio);
                if (filterTab === 'Studio' && isPb) return null;
                if (filterTab === 'Photobooth' && !isPb) return null;

                const dateMillis = tx.createdAt?.toMillis ? tx.createdAt.toMillis() : Date.now();
                const d = new Date(dateMillis);
                return (
                  <tr key={tx.id}>
                    <td>{`${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`}</td>
                    <td style={{ fontWeight: 'bold' }}>{tx.customerName}</td>
                    <td style={{ fontFamily: 'monospace', color: '#475569' }}>{tx.transactionNumber}</td>
                    <td>{isPb ? 'Photobooth' : 'Studio'}</td>
                    <td style={{ fontWeight: 'bold' }}>{formatRupiah(tx.total || 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Custom Confirmation Modal */}
      {confirmDialog.isOpen && confirmDialog.tx && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: 'var(--bg-surface)',
            borderRadius: 24,
            padding: 32,
            width: '90%',
            maxWidth: 400,
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            transform: 'scale(1)',
            animation: 'scaleUp 0.2s ease-out',
            textAlign: 'center'
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', margin: '0 auto 20px auto', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: confirmDialog.tx.isDeleted ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              color: confirmDialog.tx.isDeleted ? '#3b82f6' : '#ef4444'
            }}>
              {confirmDialog.tx.isDeleted ? (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"></polyline><polyline points="23 20 23 14 17 14"></polyline><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path></svg>
              ) : (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
              )}
            </div>
            <h3 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12 }}>
              {confirmDialog.tx.isDeleted ? 'Pulihkan Transaksi?' : 'Hapus Transaksi?'}
            </h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 32, lineHeight: 1.5 }}>
              {confirmDialog.tx.isDeleted 
                ? 'Transaksi ini akan dikembalikan dan dimasukkan kembali ke dalam perhitungan rekapitulasi Anda.' 
                : 'Transaksi ini akan disembunyikan dari rekapitulasi pendapatan. Anda masih bisa memulihkannya nanti melalui filter Sampah.'}
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button 
                onClick={() => setConfirmDialog({ isOpen: false, tx: null })}
                style={{ flex: 1, padding: '14px', borderRadius: 12, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer' }}
              >
                Batal
              </button>
              <button 
                onClick={confirmToggleDeleteStatus}
                style={{ flex: 1, padding: '14px', borderRadius: 12, background: confirmDialog.tx.isDeleted ? '#3b82f6' : '#ef4444', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer', boxShadow: confirmDialog.tx.isDeleted ? '0 4px 12px rgba(59, 130, 246, 0.3)' : '0 4px 12px rgba(239, 68, 68, 0.3)' }}
              >
                Ya, {confirmDialog.tx.isDeleted ? 'Pulihkan' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
