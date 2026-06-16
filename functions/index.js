const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");
const PdfPrinter = require("pdfmake");

admin.initializeApp();

exports.generateReport = functions.region('asia-southeast2').https.onCall(async (data, context) => {
  // if (!context.auth) {
  //   throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
  // }

  const { orgId, startMillis, endMillis, filterTab, periodeLabel } = data;
  if (!orgId) throw new functions.https.HttpsError('invalid-argument', 'orgId is required');

  const db = admin.firestore();
  
  try {
    // 1. Fetch Transactions
    let txRef = db.collection(`organizations/${orgId}/transactions`);
    let q = txRef;
    if (startMillis && endMillis) {
      q = txRef.where('createdAt', '>=', admin.firestore.Timestamp.fromMillis(startMillis))
               .where('createdAt', '<', admin.firestore.Timestamp.fromMillis(endMillis));
    } else if (startMillis) {
      q = txRef.where('createdAt', '>=', admin.firestore.Timestamp.fromMillis(startMillis));
    }
    
    const txSnap = await q.get();
    let txs = [];
    let bIds = new Set();
    txSnap.forEach(d => {
      const td = d.data();
      if (!td.isDeleted) {
        txs.push({ id: d.id, ...td });
        if (td.bookingId) bIds.add(td.bookingId);
      }
    });

    // 2. Fetch Bookings in batches
    let bookingsData = {};
    const bIdsArr = Array.from(bIds);
    for (let i = 0; i < bIdsArr.length; i += 30) {
      const batchIds = bIdsArr.slice(i, i + 30);
      const bSnap = await db.collection(`organizations/${orgId}/bookings`).where(admin.firestore.FieldPath.documentId(), 'in', batchIds).get();
      bSnap.forEach(d => {
        bookingsData[d.id] = { id: d.id, ...d.data() };
      });
    }

    // 3. Fetch Catalogs
    const photoboothsSnap = await db.collection(`organizations/${orgId}/photobooths`).get();
    const photobooths = photoboothsSnap.docs.map(d => d.id);

    const packagesSnap = await db.collection(`organizations/${orgId}/packages`).get();
    const packages = packagesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const addOnsSnap = await db.collection(`organizations/${orgId}/add_ons`).get();
    const addOns = addOnsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const templatesSnap = await db.collection(`organizations/${orgId}/templates`).get();
    const templates = templatesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const catSnap = await db.doc(`organizations/${orgId}/kasir/catalog`).get();
    let customSections = [];
    if (catSnap.exists && catSnap.data() && catSnap.data().sections) {
      customSections = catSnap.data().sections.filter(s => s.name !== 'JENIS STUDIO' && s.name !== 'ITEM TAMBAHAN' && s.name !== 'CETAK');
    }

    // 4. Aggregate Data
    let totalNominal = 0;
    let totalPaket = 0;
    let totalTambahan = 0;
    let totalCetak = 0;
    let totalCustom = 0;
    let totalTunai = 0;
    let totalTransfer = 0;
    let transactionCount = 0;

    const dataMap = new Map();
    const filteredTxs = [];

    txs.forEach(tx => {
      const bData = bookingsData[tx.bookingId];
      const isPb = bData && photobooths.includes(bData.studio);
      
      if (filterTab === 'Studio' && isPb) return;
      if (filterTab === 'Photobooth' && !isPb) return;

      // Sort tx table array later
      filteredTxs.push({ ...tx, isPb }); 

      transactionCount++;
      const txTotal = tx.total || 0;
      totalNominal += txTotal;
      
      if (tx.paymentMethod === 'transfer') totalTransfer += txTotal;
      else totalTunai += txTotal;
      
      (tx.items || []).forEach(item => {
        const itemTotal = (item.price || 0) * (item.qty || 1);
        if (packages.some(p => p.id === item.id)) totalPaket += itemTotal;
        else if (addOns.some(a => a.id === item.id)) totalTambahan += itemTotal;
        else if (item.id.startsWith('cetak_') || templates.some(t => t.id === item.id)) totalCetak += itemTotal;
        else totalCustom += itemTotal;
      });

      // Grouping
      const d = tx.createdAt ? tx.createdAt.toDate() : new Date();
      const label = `${d.getDate().toString().padStart(2, '0')} ${['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'][d.getMonth()]}`;
      const sortKey = d.getFullYear() * 10000 + d.getMonth() * 100 + d.getDate();

      if (!dataMap.has(label)) {
        dataMap.set(label, { name: label, Transaksi: 0, sortKey });
      }
      dataMap.get(label).Transaksi += 1;
    });

    // Sort transactions for the table (newest first)
    filteredTxs.sort((a,b) => {
      const tA = a.createdAt ? a.createdAt.toMillis() : 0;
      const tB = b.createdAt ? b.createdAt.toMillis() : 0;
      return tB - tA;
    });

    let sortedChartData = Array.from(dataMap.values());
    sortedChartData.sort((a, b) => a.sortKey - b.sortKey);

    const pieData = [
      { name: 'Paket', value: totalPaket },
      { name: 'Cetak', value: totalCetak },
      { name: 'Produk/Custom', value: totalCustom + totalTambahan }
    ].filter(d => d.value > 0);

    // 5. Generate Charts via QuickChart
    let barChartBase64 = null;
    let pieChartBase64 = null;

    try {
      if (sortedChartData.length > 0) {
        const barRes = await axios.post('https://quickchart.io/chart', {
          chart: {
            type: 'bar',
            data: { labels: sortedChartData.map(d => d.name), datasets: [{ label: 'Transaksi', data: sortedChartData.map(d => d.Transaksi), backgroundColor: '#8b5cf6' }] },
            options: { plugins: { legend: { display: false } } }
          }, width: 600, height: 300, format: 'png', backgroundColor: 'white'
        }, { responseType: 'arraybuffer' });
        barChartBase64 = 'data:image/png;base64,' + Buffer.from(barRes.data, 'binary').toString('base64');
      }

      if (pieData.length > 0) {
        const pieRes = await axios.post('https://quickchart.io/chart', {
          chart: {
            type: 'doughnut',
            data: { labels: pieData.map(d => d.name), datasets: [{ data: pieData.map(d => d.value), backgroundColor: ['#f59e0b', '#8b5cf6', '#ec4899', '#10b981'] }] },
            options: { plugins: { legend: { position: 'right' } } }
          }, width: 400, height: 300, format: 'png', backgroundColor: 'white'
        }, { responseType: 'arraybuffer' });
        pieChartBase64 = 'data:image/png;base64,' + Buffer.from(pieRes.data, 'binary').toString('base64');
      }
    } catch (err) {
      console.error("Gagal men-generate chart:", err);
    }

    // 6. Generate PDF
    const formatRupiah = (num) => `Rp ${(num || 0).toLocaleString('id-ID')}`;

    const fonts = {
      Helvetica: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique'
      }
    };

    const printer = new PdfPrinter(fonts);
    
    // Create standard table layout manually for basic stats
    const kpiTable = {
      table: {
        widths: ['*', '*', '*', '*'],
        body: [
          [
            { text: 'Pendapatan', bold: true, fillColor: '#f1f5f9', alignment: 'center' },
            { text: 'Transaksi', bold: true, fillColor: '#f1f5f9', alignment: 'center' },
            { text: 'Transfer / QR', bold: true, fillColor: '#f1f5f9', alignment: 'center' },
            { text: 'Tunai', bold: true, fillColor: '#f1f5f9', alignment: 'center' }
          ],
          [
            { text: formatRupiah(totalNominal), alignment: 'center', margin: [0, 5, 0, 5] },
            { text: transactionCount.toString(), alignment: 'center', margin: [0, 5, 0, 5] },
            { text: formatRupiah(totalTransfer), alignment: 'center', margin: [0, 5, 0, 5] },
            { text: formatRupiah(totalTunai), alignment: 'center', margin: [0, 5, 0, 5] }
          ]
        ]
      },
      layout: 'lightHorizontalLines',
      margin: [0, 10, 0, 20]
    };

    const txTable = {
      table: {
        headerRows: 1,
        widths: ['auto', '*', 'auto', 'auto', 'auto'],
        body: [
          [
            { text: 'Waktu', bold: true, fillColor: '#f1f5f9' }, 
            { text: 'Pelanggan', bold: true, fillColor: '#f1f5f9' }, 
            { text: 'No. Transaksi', bold: true, fillColor: '#f1f5f9' }, 
            { text: 'Kategori', bold: true, fillColor: '#f1f5f9' }, 
            { text: 'Total', bold: true, fillColor: '#f1f5f9' }
          ],
          ...filteredTxs.map(tx => {
             const d = tx.createdAt ? tx.createdAt.toDate() : new Date();
             return [
               `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`,
               tx.customerName || '-',
               tx.transactionNumber || '-',
               tx.isPb ? 'Photobooth' : 'Studio',
               formatRupiah(tx.total || 0)
             ];
          })
        ]
      },
      layout: 'lightHorizontalLines'
    };

    const docDefinition = {
      defaultStyle: { font: 'Helvetica', fontSize: 10 },
      pageSize: 'A4',
      pageOrientation: 'portrait',
      pageMargins: [40, 40, 40, 40],
      content: [
        { text: 'Laporan Rekapitulasi Snapme', fontSize: 18, bold: true, alignment: 'center', margin: [0, 0, 0, 5] },
        { text: `Periode: ${periodeLabel || '-'} | Kategori: ${filterTab}`, alignment: 'center', color: '#475569', margin: [0, 0, 0, 20] },
        
        kpiTable,
        
        {
          columns: [
            pieChartBase64 ? { image: pieChartBase64, width: 220 } : { text: '' },
            barChartBase64 ? { image: barChartBase64, width: 280 } : { text: '' }
          ],
          columnGap: 15,
          margin: [0, 0, 0, 30]
        },

        { text: 'Rincian Transaksi', fontSize: 14, bold: true, margin: [0, 0, 0, 10] },
        txTable
      ]
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);

    // 7. Upload to Firebase Storage
    const bucket = admin.storage().bucket();
    const filename = `reports/${orgId}/${Date.now()}-Laporan.pdf`;
    const file = bucket.file(filename);

    const writeStream = file.createWriteStream({
      metadata: { contentType: 'application/pdf' },
      public: true // Make URL publicly accessible
    });

    const uploadPromise = new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    pdfDoc.pipe(writeStream);
    pdfDoc.end();

    await uploadPromise;

    // Return the public download URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;
    
    return { success: true, url: publicUrl };

  } catch (error) {
    console.error("Error generating report:", error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});
