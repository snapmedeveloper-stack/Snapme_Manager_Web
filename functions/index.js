const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");
const PdfPrinter = require("pdfmake");

admin.initializeApp();

// Gunakan VFS Fonts (Roboto) yang sudah dibundel dalam pdfmake
const vfsFonts = require('pdfmake/build/vfs_fonts');
const fonts = {
  Roboto: {
    normal: Buffer.from(vfsFonts.pdfMake.vfs['Roboto-Regular.ttf'], 'base64'),
    bold: Buffer.from(vfsFonts.pdfMake.vfs['Roboto-Medium.ttf'], 'base64'),
    italics: Buffer.from(vfsFonts.pdfMake.vfs['Roboto-Italic.ttf'], 'base64'),
    bolditalics: Buffer.from(vfsFonts.pdfMake.vfs['Roboto-MediumItalic.ttf'], 'base64')
  }
};
const printer = new PdfPrinter(fonts);

exports.generateReport = functions
  .region('asia-southeast2')
  .runWith({ timeoutSeconds: 300, memory: '512MB' })
  .https.onCall(async (data, context) => {

  const { orgId, startMillis, endMillis, filterTab, periodeLabel } = data;
  if (!orgId) throw new functions.https.HttpsError('invalid-argument', 'orgId is required');

  const db = admin.firestore();
  console.log(`[generateReport] START orgId=${orgId} filter=${filterTab} start=${startMillis} end=${endMillis}`);

  try {
    // 1. Fetch Transactions
    let txRef = db.collection(`organizations/${orgId}/transactions`);
    let q = txRef;
    if (startMillis && endMillis) {
      q = txRef
        .where('createdAt', '>=', admin.firestore.Timestamp.fromMillis(startMillis))
        .where('createdAt', '<', admin.firestore.Timestamp.fromMillis(endMillis));
    } else if (startMillis) {
      q = txRef.where('createdAt', '>=', admin.firestore.Timestamp.fromMillis(startMillis));
    }

    const txSnap = await q.get();
    console.log(`[generateReport] Fetched ${txSnap.size} transactions`);

    const txs = [];
    const bIds = new Set();
    txSnap.forEach(d => {
      const td = d.data();
      if (!td.isDeleted) {
        txs.push({ id: d.id, ...td });
        if (td.bookingId) bIds.add(td.bookingId);
      }
    });

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
    console.log(`[generateReport] Fetched ${Object.keys(bookingsData).length} bookings`);

    // 3. Fetch Catalogs
    const pbSnap = await db.collection(`organizations/${orgId}/photobooths`).get();
    const photobooths = pbSnap.docs.map(d => d.id);

    const pkgSnap = await db.collection(`organizations/${orgId}/packages`).get();
    const packages = pkgSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const tplSnap = await db.collection(`organizations/${orgId}/templates`).get();
    const templates = tplSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 4. Aggregate Data
    let totalNominal = 0, totalPaket = 0, totalCetak = 0, totalCustom = 0;
    let totalTunai = 0, totalTransfer = 0, transactionCount = 0;
    const dataMap = new Map();
    const filteredTxs = [];

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
      const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
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
    console.log(`[generateReport] Filtered to ${filteredTxs.length} txs, revenue=${totalNominal}`);

    const sortedChartData = Array.from(dataMap.values()).sort((a, b) => a.sortKey - b.sortKey);
    const pieData = [
      { name: 'Paket', value: totalPaket },
      { name: 'Cetak', value: totalCetak },
      { name: 'Lainnya', value: totalCustom }
    ].filter(d => d.value > 0);

    // 5. Generate Charts via QuickChart API
    let barChartBase64 = null;
    let pieChartBase64 = null;

    try {
      if (sortedChartData.length > 0) {
        console.log(`[generateReport] Requesting bar chart for ${sortedChartData.length} data points`);
        const barRes = await axios.post('https://quickchart.io/chart', {
          chart: {
            type: 'bar',
            data: {
              labels: sortedChartData.map(d => d.name),
              datasets: [{ label: 'Transaksi', data: sortedChartData.map(d => d.Transaksi), backgroundColor: '#8b5cf6' }]
            },
            options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
          },
          width: 580, height: 270, format: 'png', backgroundColor: 'white'
        }, { responseType: 'arraybuffer', timeout: 20000 });
        barChartBase64 = 'data:image/png;base64,' + Buffer.from(barRes.data).toString('base64');
        console.log(`[generateReport] Bar chart generated OK`);
      }

      if (pieData.length > 0) {
        const pieRes = await axios.post('https://quickchart.io/chart', {
          chart: {
            type: 'doughnut',
            data: {
              labels: pieData.map(d => d.name),
              datasets: [{ data: pieData.map(d => d.value), backgroundColor: ['#f59e0b', '#8b5cf6', '#ec4899', '#10b981'] }]
            },
            options: { plugins: { legend: { position: 'right' } } }
          },
          width: 360, height: 270, format: 'png', backgroundColor: 'white'
        }, { responseType: 'arraybuffer', timeout: 20000 });
        pieChartBase64 = 'data:image/png;base64,' + Buffer.from(pieRes.data).toString('base64');
        console.log(`[generateReport] Pie chart generated OK`);
      }
    } catch (chartErr) {
      console.warn("[generateReport] Chart generation failed, continuing without charts:", chartErr.message);
    }

    // 6. Build pdfmake document definition
    const formatRupiah = (num) => `Rp ${(num || 0).toLocaleString('id-ID')}`;

    const chartColumns = [];
    if (pieChartBase64) chartColumns.push({ image: pieChartBase64, width: 200 });
    else chartColumns.push({ text: '' });
    if (barChartBase64) chartColumns.push({ image: barChartBase64, width: 260 });
    else chartColumns.push({ text: '' });

    const txTableBody = [
      [
        { text: 'Waktu', bold: true, fillColor: '#0f172a', color: '#fff', fontSize: 8 },
        { text: 'Pelanggan', bold: true, fillColor: '#0f172a', color: '#fff', fontSize: 8 },
        { text: 'No. Transaksi', bold: true, fillColor: '#0f172a', color: '#fff', fontSize: 8 },
        { text: 'Kategori', bold: true, fillColor: '#0f172a', color: '#fff', fontSize: 8 },
        { text: 'Total', bold: true, fillColor: '#0f172a', color: '#fff', fontSize: 8 }
      ],
      ...filteredTxs.map((tx, idx) => {
        const d = tx.createdAt ? tx.createdAt.toDate() : new Date();
        const bg = idx % 2 === 1 ? '#f8fafc' : null;
        const timeStr = `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
        return [
          { text: timeStr, fontSize: 8, fillColor: bg },
          { text: tx.customerName || '-', fontSize: 8, fillColor: bg },
          { text: tx.transactionNumber || '-', fontSize: 8, fillColor: bg },
          { text: tx.isPb ? 'Photobooth' : 'Studio', fontSize: 8, fillColor: bg },
          { text: formatRupiah(tx.total || 0), fontSize: 8, bold: true, fillColor: bg }
        ];
      })
    ];

    const docDefinition = {
      defaultStyle: { font: 'Roboto', fontSize: 10 },
      pageSize: 'A4',
      pageMargins: [40, 40, 40, 40],
      content: [
        { text: 'Laporan Rekapitulasi Snapme', fontSize: 18, bold: true, alignment: 'center', margin: [0,0,0,4] },
        { text: `Periode: ${periodeLabel || '-'} | Kategori: ${filterTab}`, alignment: 'center', color: '#475569', fontSize: 10, margin: [0,0,0,4] },
        { text: `Dicetak: ${new Date().toLocaleString('id-ID')}`, alignment: 'center', color: '#94a3b8', fontSize: 9, margin: [0,0,0,16] },

        // KPI Boxes
        {
          table: {
            widths: ['*','*','*','*'],
            body: [
              [
                { text: 'Total Pendapatan', bold: true, fillColor: '#f1f5f9', alignment: 'center', fontSize: 9 },
                { text: 'Total Transaksi', bold: true, fillColor: '#f1f5f9', alignment: 'center', fontSize: 9 },
                { text: 'Transfer / QR', bold: true, fillColor: '#f1f5f9', alignment: 'center', fontSize: 9 },
                { text: 'Tunai', bold: true, fillColor: '#f1f5f9', alignment: 'center', fontSize: 9 }
              ],
              [
                { text: formatRupiah(totalNominal), alignment: 'center', margin: [0,6,0,6], bold: true, color: '#10b981', fontSize: 11 },
                { text: `${transactionCount}`, alignment: 'center', margin: [0,6,0,6], bold: true, fontSize: 11 },
                { text: formatRupiah(totalTransfer), alignment: 'center', margin: [0,6,0,6] },
                { text: formatRupiah(totalTunai), alignment: 'center', margin: [0,6,0,6] }
              ]
            ]
          },
          layout: 'lightHorizontalLines',
          margin: [0,0,0,20]
        },

        // Charts (if available)
        ...(barChartBase64 || pieChartBase64 ? [{
          columns: chartColumns,
          columnGap: 10,
          margin: [0,0,0,24]
        }] : []),

        // Transaction Table
        { text: 'Rincian Transaksi', fontSize: 13, bold: true, margin: [0,0,0,10] },
        {
          table: {
            headerRows: 1,
            widths: [55, '*', 80, 55, 70],
            body: txTableBody
          },
          layout: 'lightHorizontalLines'
        }
      ]
    };

    console.log(`[generateReport] Generating PDF with ${filteredTxs.length} rows...`);
    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];
    const pdfBase64 = await new Promise((resolve, reject) => {
      pdfDoc.on('data', chunk => chunks.push(chunk));
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks).toString('base64')));
      pdfDoc.on('error', reject);
      pdfDoc.end();
    });

    console.log(`[generateReport] PDF generated successfully, size=${Math.round(pdfBase64.length / 1024)}KB`);
    return {
      success: true,
      pdfBase64,
      filename: `Laporan_Snapme_${(periodeLabel || 'Semua').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
    };

  } catch (error) {
    console.error("[generateReport] FATAL ERROR:", error.message, error.stack);
    throw new functions.https.HttpsError('internal', error.message);
  }
});
