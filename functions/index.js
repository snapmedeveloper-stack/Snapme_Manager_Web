const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");
const PDFDocument = require("pdfkit");
const { getFirestore } = require('firebase-admin/firestore');

admin.initializeApp();

// Gunakan named database "default" agar sesuai dengan client SDK (getFirestore(app, "default"))
const db = getFirestore(admin.app(), 'default');

// HTTP function (bukan Callable) agar CORS bisa diset manual di baris pertama
exports.generateReport = functions
  .region('asia-southeast2')
  .runWith({ timeoutSeconds: 300, memory: '512MB' })
  .https.onRequest(async (req, res) => {

  // === CORS HEADERS - SELALU DI BARIS PERTAMA ===
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { orgId, startMillis, endMillis, filterTab, periodeLabel } = req.body;

  if (!orgId) {
    res.status(400).json({ error: 'orgId is required' });
    return;
  }

  console.log(`[generateReport] START orgId=${orgId} filter=${filterTab}`);

  try {
    // 1. Fetch Transactions
    let txRef = db.collection(`organizations/${orgId}/transactions`);
    let q = txRef;
    if (startMillis && endMillis) {
      q = txRef
        .where('createdAt', '>=', admin.firestore.Timestamp.fromMillis(Number(startMillis)))
        .where('createdAt', '<', admin.firestore.Timestamp.fromMillis(Number(endMillis)));
    } else if (startMillis) {
      q = txRef.where('createdAt', '>=', admin.firestore.Timestamp.fromMillis(Number(startMillis)));
    }

    const txSnap = await q.get();
    const txs = [];
    const bIds = new Set();
    txSnap.forEach(d => {
      const td = d.data();
      if (!td.isDeleted) {
        txs.push({ id: d.id, ...td });
        if (td.bookingId) bIds.add(td.bookingId);
      }
    });
    console.log(`[generateReport] Fetched ${txs.length} transactions`);

    // 2. Fetch Bookings in batches of 30
    const bookingsData = {};
    const bIdsArr = Array.from(bIds);
    for (let i = 0; i < bIdsArr.length; i += 30) {
      const batchIds = bIdsArr.slice(i, i + 30);
      const bSnap = await db.collection(`organizations/${orgId}/bookings`)
        .where(admin.firestore.FieldPath.documentId(), 'in', batchIds)
        .get();
      bSnap.forEach(d => { bookingsData[d.id] = { id: d.id, ...d.data() }; });
    }

    // 3. Fetch Catalogs
    const pbSnap = await db.collection(`organizations/${orgId}/photobooths`).get();
    const photobooths = pbSnap.docs.map(d => d.id);

    const pkgSnap = await db.collection(`organizations/${orgId}/packages`).get();
    const packages = pkgSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const tplSnap = await db.collection(`organizations/${orgId}/templates`).get();
    const templates = tplSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 4. Aggregate
    let totalNominal = 0, totalPaket = 0, totalCetak = 0, totalCustom = 0;
    let totalTunai = 0, totalTransfer = 0, transactionCount = 0;
    const dataMap = new Map();
    const filteredTxs = [];
    const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];

    txs.forEach(tx => {
      const bData = bookingsData[tx.bookingId];
      const isPb = bData && photobooths.includes(bData.studio);
      if (filterTab === 'Studio' && isPb) return;
      if (filterTab === 'Photobooth' && !isPb) return;

      filteredTxs.push({ ...tx, isPb });
      transactionCount++;
      const txTotal = tx.total || 0;
      totalNominal += txTotal;

      if (tx.paymentMethod === 'transfer') totalTransfer += txTotal;
      else totalTunai += txTotal;

      (tx.items || []).forEach(item => {
        const itemTotal = (item.price || 0) * (item.qty || 1);
        if (packages.some(p => p.id === item.id)) totalPaket += itemTotal;
        else if (item.id.startsWith('cetak_') || templates.some(t => t.id === item.id)) totalCetak += itemTotal;
        else totalCustom += itemTotal;
      });

      const d = tx.createdAt ? tx.createdAt.toDate() : new Date();
      const label = `${d.getDate().toString().padStart(2,'0')} ${months[d.getMonth()]}`;
      const sortKey = d.getFullYear() * 10000 + d.getMonth() * 100 + d.getDate();
      if (!dataMap.has(label)) dataMap.set(label, { name: label, Transaksi: 0, sortKey });
      dataMap.get(label).Transaksi += 1;
    });

    filteredTxs.sort((a, b) => {
      const tA = a.createdAt ? a.createdAt.toMillis() : 0;
      const tB = b.createdAt ? b.createdAt.toMillis() : 0;
      return tB - tA;
    });

    const sortedChartData = Array.from(dataMap.values()).sort((a, b) => a.sortKey - b.sortKey);
    const pieData = [
      { name: 'Paket', value: totalPaket },
      { name: 'Cetak', value: totalCetak },
      { name: 'Lainnya', value: totalCustom }
    ].filter(d => d.value > 0);

    console.log(`[generateReport] Filtered=${filteredTxs.length} txs, revenue=${totalNominal}`);

    // 5. Charts via QuickChart
    let barChartBuf = null;
    let pieChartBuf = null;
    try {
      if (sortedChartData.length > 0) {
        const r = await axios.post('https://quickchart.io/chart', {
          chart: {
            type: 'bar',
            data: {
              labels: sortedChartData.map(d => d.name),
              datasets: [{ label: 'Transaksi', data: sortedChartData.map(d => d.Transaksi), backgroundColor: '#8b5cf6' }]
            },
            options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
          },
          width: 500, height: 240, format: 'png', backgroundColor: 'white'
        }, { responseType: 'arraybuffer', timeout: 20000 });
        barChartBuf = Buffer.from(r.data);
        console.log(`[generateReport] Bar chart OK`);
      }
      if (pieData.length > 0) {
        const r = await axios.post('https://quickchart.io/chart', {
          chart: {
            type: 'doughnut',
            data: {
              labels: pieData.map(d => d.name),
              datasets: [{ data: pieData.map(d => d.value), backgroundColor: ['#f59e0b','#8b5cf6','#ec4899','#10b981'] }]
            },
            options: { plugins: { legend: { position: 'right' } } }
          },
          width: 340, height: 240, format: 'png', backgroundColor: 'white'
        }, { responseType: 'arraybuffer', timeout: 20000 });
        pieChartBuf = Buffer.from(r.data);
        console.log(`[generateReport] Pie chart OK`);
      }
    } catch (chartErr) {
      console.warn('[generateReport] Chart failed (continuing):', chartErr.message);
    }

    // 6. Generate PDF with pdfkit
    const formatRupiah = (num) => `Rp ${(num || 0).toLocaleString('id-ID')}`;
    const doc = new PDFDocument({ size: 'A4', margins: { top: 40, bottom: 40, left: 40, right: 40 } });
    const pageW = 515;

    doc.font('Helvetica-Bold').fontSize(18).fillColor('#0f172a').text('Laporan Rekapitulasi Snapme', { align: 'center' });
    doc.font('Helvetica').fontSize(10).fillColor('#475569').text(`Periode: ${periodeLabel || '-'} | Kategori: ${filterTab || 'Semua'}`, { align: 'center' });
    doc.fontSize(9).fillColor('#94a3b8').text(`Dicetak: ${new Date().toLocaleString('id-ID')}`, { align: 'center' });
    doc.moveDown(1.5);

    // KPI row
    const kpiLabels = ['Total Pendapatan', 'Total Transaksi', 'Transfer / QR', 'Tunai'];
    const kpiValues = [formatRupiah(totalNominal), `${transactionCount}`, formatRupiah(totalTransfer), formatRupiah(totalTunai)];
    const kpiW = pageW / 4;
    const kpiY = doc.y;
    doc.rect(40, kpiY, pageW, 20).fill('#f1f5f9');
    kpiLabels.forEach((label, i) => {
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#334155')
        .text(label, 40 + i * kpiW, kpiY + 6, { width: kpiW, align: 'center' });
    });
    const kpiValY = kpiY + 20;
    doc.rect(40, kpiValY, pageW, 24).stroke('#e2e8f0');
    kpiValues.forEach((val, i) => {
      doc.font('Helvetica-Bold').fontSize(10).fillColor(i === 0 ? '#10b981' : '#0f172a')
        .text(val, 40 + i * kpiW, kpiValY + 7, { width: kpiW, align: 'center' });
    });
    doc.y = kpiValY + 34;
    doc.moveDown(1);

    // Charts
    const chartY = doc.y;
    if (pieChartBuf || barChartBuf) {
      try {
        if (pieChartBuf) doc.image(pieChartBuf, 40, chartY, { width: 220 });
        if (barChartBuf) doc.image(barChartBuf, 275, chartY, { width: 280 });
        doc.y = chartY + 185;
        doc.moveDown(1);
      } catch (imgErr) {
        console.warn('[generateReport] Image embed failed:', imgErr.message);
        doc.moveDown(1);
      }
    }

    // Transaction table header
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#0f172a').text('Rincian Transaksi');
    doc.moveDown(0.5);

    const colW = [55, 120, 90, 55, 45, 75];
    const colH = ['Waktu', 'Pelanggan', 'No. Transaksi', 'Kategori', 'Bayar', 'Total'];
    const thY = doc.y;
    doc.rect(40, thY, pageW, 18).fill('#0f172a');
    colH.forEach((h, i) => {
      const x = 40 + colW.slice(0, i).reduce((a, b) => a + b, 0);
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#fff').text(h, x + 4, thY + 5, { width: colW[i] - 8 });
    });

    let rowY = thY + 18;
    filteredTxs.forEach((tx, idx) => {
      if (rowY + 16 > doc.page.height - 50) {
        doc.addPage();
        rowY = 40;
      }
      const d = tx.createdAt ? tx.createdAt.toDate() : new Date();
      const cells = [
        `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`,
        tx.customerName || '-',
        tx.transactionNumber || '-',
        tx.isPb ? 'Photobooth' : 'Studio',
        tx.paymentMethod === 'transfer' ? 'TF' : 'Cash',
        formatRupiah(tx.total || 0)
      ];
      doc.rect(40, rowY, pageW, 16).fill(idx % 2 === 1 ? '#f8fafc' : '#fff');
      cells.forEach((val, i) => {
        const x = 40 + colW.slice(0, i).reduce((a, b) => a + b, 0);
        const isBold = i === 5; // kolom Total
        const color = i === 4 ? (val === 'TF' ? '#3b82f6' : '#10b981') : '#0f172a';
        doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).fillColor(color)
          .text(String(val), x + 4, rowY + 4, { width: colW[i] - 8, ellipsis: true, lineBreak: false });
      });
      doc.moveTo(40, rowY + 16).lineTo(555, rowY + 16).lineWidth(0.5).stroke('#e2e8f0');
      rowY += 16;
    });

    // Collect PDF buffer
    const pdfBase64 = await new Promise((resolve, reject) => {
      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks).toString('base64')));
      doc.on('error', reject);
      doc.end();
    });

    console.log(`[generateReport] Done! size=${Math.round(pdfBase64.length / 1024)}KB rows=${filteredTxs.length}`);

    res.json({
      success: true,
      pdfBase64,
      filename: `Laporan_Snapme_${(periodeLabel || 'Semua').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
    });

  } catch (error) {
    console.error("[generateReport] ERROR:", error.message, error.stack);
    res.status(500).json({ error: error.message });
  }
});
