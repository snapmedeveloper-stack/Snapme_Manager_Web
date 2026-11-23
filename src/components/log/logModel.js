// Logika murni mode Log (Snapme_Desktop/docs/RENCANA_LOG_APLIKASI.md §7.2, §8). Dokumen appLogs dibaca apa adanya;
// status yang ditampilkan diturunkan dari bukti: hasil operasi, centang WhatsApp, nomor urut, dan kondisi PC. Tidak ada
// yang dianggap berhasil tanpa catatan hasilnya.
import { explainError } from './errorExplain';

export const OP_TIMEOUT_MS = 15 * 60 * 1000; // operasi tanpa hasil selama ini = "Tidak selesai"
export const OFFLINE_AFTER_MS = 15 * 60 * 1000; // PC tanpa heartbeat selama ini = offline
export const QUEUE_STALE_MS = 60 * 60 * 1000; // log tertahan di PC lebih lama dari ini = peringatan
export const CLOCK_SKEW_LIMIT_MS = 2 * 60 * 1000;
const FOLD_WINDOW_MS = 2 * 60 * 1000;

export const CATEGORY_LABEL = {
  sistem: 'Sistem',
  booking: 'Booking',
  timeline: 'Timeline',
  absensi: 'Absensi',
  kasir: 'Kasir',
  transaksi: 'Transaksi',
  file: 'File',
  print: 'Print',
  template: 'Template',
  pasfoto: 'Pas Foto',
  wa: 'WhatsApp',
  bot: 'Bot WA',
  setting: 'Setting',
  auto: 'Otomatis',
  crash: 'Error aplikasi',
  log: 'Log',
};

export const SOURCE_LABEL = { user: 'PC', bot: 'Bot WA', auto: 'Otomatis' };

/** Status tampilan operasi: label & tone Badge. */
export const OP_STATUS = {
  running: { label: 'Berjalan', tone: 'neutral' },
  succeeded: { label: 'Berhasil', tone: 'success' },
  failed: { label: 'Gagal', tone: 'danger' },
  partial: { label: 'Sebagian', tone: 'warning' },
  unconfirmed: { label: 'Tidak terkonfirmasi', tone: 'warning' },
  incomplete: { label: 'Tidak selesai', tone: 'warning' },
};

/** Timestamp Firestore / ms / Date → ms (null bila kosong). */
export function toMs(value) {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  return null;
}

const isOp = (d) => !!d.opId && !!d.status;

/**
 * Dokumen aktivitas → baris tampilan, terbaru di atas.
 * - Operasi (status/opId) digabung jadi satu baris: { kind: 'op', started, result, status, acks }. Tanpa hasil:
 *   'running' bila masih dalam batas waktu, 'incomplete' bila lewat (bukan dianggap berhasil).
 * - Centang WhatsApp (wa.message_ack/_failed/_unconfirmed) menempel ke operasi kirimnya lewat context.opRef; bila
 *   operasinya tidak ikut termuat, centang tampil sebagai baris sendiri. Error wa.send_problem dengan opRef yang
 *   operasinya termuat tidak ditampilkan lagi (sudah terlihat dari hasil operasi / centangnya).
 * - Aksi beruntun yang sama (event, objek, PC, status) dalam 2 menit dilipat: { folded: [...] }. Hasil berbeda tidak
 *   pernah dilipat bersama, jadi satu kegagalan tidak tersembunyi di antara keberhasilan.
 */
export function buildActivityRows(docs, now = Date.now()) {
  const ops = new Map();
  const singles = [];
  for (const d of docs) {
    if (isOp(d)) {
      const op = ops.get(d.opId) || { kind: 'op', opId: d.opId, started: null, result: null, acks: [] };
      if (d.status === 'started') op.started = d;
      else if (!op.result || toMs(d.occurredAt) > toMs(op.result.occurredAt)) op.result = d;
      ops.set(d.opId, op);
    } else singles.push(d);
  }
  const rows = [];
  for (const d of singles) {
    const ref = d.context?.opRef;
    // Salinan error dari kirim WA yang gagal/ditolak (tab Error): di linimasa sudah terwakili operasi & centangnya
    if (ref && d.event === 'wa.send_problem' && ops.has(ref)) continue;
    if (ref && d.event.startsWith('wa.message_') && ops.has(ref)) ops.get(ref).acks.push(d);
    else rows.push({ kind: 'single', doc: d, at: toMs(d.occurredAt) });
  }
  for (const op of ops.values()) {
    const base = op.result || op.started;
    const startedAt = toMs((op.started || op.result).occurredAt);
    op.status = op.result ? op.result.status : now - startedAt > OP_TIMEOUT_MS ? 'incomplete' : 'running';
    op.doc = base;
    op.at = toMs(base.occurredAt);
    op.acks.sort((a, b) => toMs(a.occurredAt) - toMs(b.occurredAt));
    rows.push(op);
  }
  rows.sort((a, b) => b.at - a.at);
  return foldRows(rows);
}

const foldKey = (r) =>
  [r.doc.event, r.doc.subject?.id || r.doc.message, r.doc.machineId, r.kind === 'op' ? r.status : r.doc.level].join(
    '|',
  );

function foldRows(rows) {
  const out = [];
  for (const r of rows) {
    const prev = out[out.length - 1];
    if (
      prev &&
      foldKey(prev) === foldKey(r) &&
      (prev.folded?.[prev.folded.length - 1] || prev).at - r.at <= FOLD_WINDOW_MS
    ) {
      prev.folded = prev.folded || [];
      prev.folded.push(r);
    } else out.push(r);
  }
  return out;
}

/** Ringkasan centang WhatsApp untuk satu operasi kirim: { label, tone } atau null. */
export function ackSummary(acks = []) {
  if (!acks.length) return null;
  const failed = acks.find((a) => a.event === 'wa.message_ack_failed');
  if (failed) return { label: `Ditolak WhatsApp: ${failed.context?.reason || '-'}`, tone: 'danger' };
  const best = Math.max(0, ...acks.filter((a) => a.event === 'wa.message_ack').map((a) => Number(a.context?.ack) || 0));
  if (best >= 2) return { label: 'Diterima ✓✓', tone: 'success' };
  if (best === 1) return { label: 'Terkirim ✓', tone: 'success' };
  if (acks.some((a) => a.event === 'wa.message_unconfirmed')) return { label: 'Belum terkonfirmasi', tone: 'warning' };
  return null;
}

/**
 * Error → kelompok per sidik jari. issues = { [fingerprint]: { resolvedAt } }.
 * Hasil terurut dari yang terakhir terjadi: { fingerprint, message, context & subject (kejadian terakhir), level, event,
 * count, firstAt, lastAt, machines, versions, docs, status: 'open' | 'resolved' | 'reopened', explain: { title, meaning,
 * action } }. Error yang muncul lagi setelah ditandai = 'reopened'.
 */
export function groupErrors(docs, issues = {}) {
  const groups = new Map();
  for (const d of docs) {
    const fp = d.fingerprint || `${d.event}:tanpa-sidik-jari`;
    const g = groups.get(fp) || {
      fingerprint: fp,
      event: d.event,
      message: d.message,
      context: d.context || {},
      subject: d.subject || null,
      level: d.level,
      count: 0,
      firstAt: Infinity,
      lastAt: 0,
      machines: new Set(),
      versions: new Set(),
      docs: [],
    };
    const last = toMs(d.lastAt) ?? toMs(d.occurredAt);
    g.count += d.count || 1;
    g.firstAt = Math.min(g.firstAt, toMs(d.firstAt) ?? toMs(d.occurredAt));
    if (last >= g.lastAt) {
      g.lastAt = last;
      g.message = d.message;
      g.context = d.context || {};
      g.subject = d.subject || null;
    }
    if (d.level === 'error') g.level = 'error';
    g.machines.add(d.machineName || d.machineId);
    if (d.appVersion) g.versions.add(d.appVersion);
    g.docs.push(d);
    groups.set(fp, g);
  }
  return [...groups.values()]
    .map((g) => {
      const resolvedAt = toMs(issues[g.fingerprint]?.resolvedAt);
      const status = resolvedAt == null ? 'open' : resolvedAt >= g.lastAt ? 'resolved' : 'reopened';
      return {
        ...g,
        machines: [...g.machines],
        versions: [...g.versions],
        status,
        resolvedAt,
        explain: explainError(g),
      };
    })
    .sort((a, b) => b.lastAt - a.lastAt);
}

/**
 * Kirim WhatsApp yang tercatat bermasalah tapi kemudian tetap mendapat centang (HP customer baru online): { at, ack }
 * dari centang terbaik untuk operasi itu (context.opRef), atau null. timeline = catatan objek yang sama (subject.id).
 */
export function deliveredAfter(problemDoc, timeline = []) {
  const ref = problemDoc?.context?.opRef;
  if (problemDoc?.event !== 'wa.send_problem' || !ref) return null;
  const acks = timeline.filter(
    (d) => d.event === 'wa.message_ack' && d.context?.opRef === ref && Number(d.context?.ack) >= 1,
  );
  if (!acks.length) return null;
  const best = acks.reduce((a, b) => (Number(b.context.ack) > Number(a.context.ack) ? b : a));
  return { at: toMs(best.occurredAt), ack: Number(best.context.ack) };
}

/** "3.0.10" > "3.0.9" */
export function compareVersions(a, b) {
  const pa = String(a || '0')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  const pb = String(b || '0')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  }
  return 0;
}

/**
 * Kondisi satu PC dari dokumen devices: { online, outdated, issues: [teks], ... }. latestVersion = versi tertinggi di
 * antara semua PC (PC tertinggal = versinya lebih rendah).
 */
export function deviceState(device, { now = Date.now(), latestVersion } = {}) {
  const lastSeen = toMs(device.lastSeen);
  const online = lastSeen != null && now - lastSeen <= OFFLINE_AFTER_MS;
  const oldestQueued = toMs(device.oldestQueuedAt);
  const issues = [];
  if (!online) issues.push(lastSeen ? `Offline sejak ${formatClock(lastSeen, now)}` : 'Belum pernah mengirim status');
  const outdated = !!latestVersion && compareVersions(device.appVersion, latestVersion) < 0;
  if (outdated) issues.push(`Masih versi ${device.appVersion} (terbaru ${latestVersion})`);
  if (oldestQueued && now - oldestQueued > QUEUE_STALE_MS) {
    issues.push(`${device.logsQueued || 0} log tertahan di PC sejak ${formatClock(oldestQueued, now)}`);
  }
  if (Math.abs(device.clockSkewMs || 0) > CLOCK_SKEW_LIMIT_MS) {
    issues.push(`Jam PC meleset ${Math.round(Math.abs(device.clockSkewMs) / 60000)} menit (urutan log bisa keliru)`);
  }
  if (device.logsDropped > 0) issues.push(`${device.logsDropped} log terbuang karena antrian PC penuh`);
  if (device.logsRejected > 0) issues.push(`${device.logsRejected} log ditolak validasi`);
  return { online, outdated, lastSeen, issues };
}

/** Versi tertinggi di antara PC. */
export const latestVersionOf = (devices) =>
  devices.reduce((best, d) => (compareVersions(d.appVersion, best) > 0 ? d.appVersion : best), '');

/**
 * Lompatan nomor urut per PC dalam dokumen yang termuat (aktivitas + error, satu rentang waktu):
 * [{ machineId, machineName, from, to, missing }]. Nomor yang tidak ada = catatan yang belum sampai di server: masih
 * tertahan di PC, milik akun studio lain di PC itu, ditolak server (tercatat log.upload_rejected), atau terbuang.
 */
export function seqGaps(docs) {
  const byMachine = new Map();
  for (const d of docs) {
    if (!Number.isInteger(d.seq)) continue;
    const m = byMachine.get(d.machineId) || { name: d.machineName || d.machineId, seqs: new Set() };
    m.seqs.add(d.seq);
    byMachine.set(d.machineId, m);
  }
  const gaps = [];
  for (const [machineId, m] of byMachine) {
    const seqs = [...m.seqs].sort((a, b) => a - b);
    for (let i = 1; i < seqs.length; i += 1) {
      if (seqs[i] - seqs[i - 1] > 1) {
        gaps.push({
          machineId,
          machineName: m.name,
          from: seqs[i - 1] + 1,
          to: seqs[i] - 1,
          missing: seqs[i] - seqs[i - 1] - 1,
        });
      }
    }
  }
  return gaps;
}

/** Hal yang perlu diperhatikan owner (kartu atas Ringkasan). */
export function attentionItems({ errorGroups = [], devices = [], gaps = [], now = Date.now() }) {
  const items = [];
  for (const g of errorGroups) {
    if (g.status !== 'resolved') {
      items.push({
        tone: g.level === 'error' ? 'danger' : 'warning',
        text: `${g.explain?.title || g.message}${g.count > 1 ? ` ×${g.count}` : ''}`,
        to: `error/${encodeURIComponent(g.fingerprint)}`,
      });
    }
  }
  const latestVersion = latestVersionOf(devices);
  for (const d of devices) {
    for (const issue of deviceState(d, { now, latestVersion }).issues) {
      items.push({
        tone: 'warning',
        text: `${d.machineName || d.id}: ${issue}`,
        to: `perangkat/${encodeURIComponent(d.id)}`,
      });
    }
  }
  for (const g of gaps) {
    items.push({
      tone: 'warning',
      text: `${g.missing} catatan log ${g.machineName} belum ada di server (#${g.from}–#${g.to})`,
      to: `perangkat/${encodeURIComponent(g.machineId)}`,
    });
  }
  return items;
}

/** Jumlah aktivitas per jam (0–23) pada satu hari. */
export function hourlyCounts(docs) {
  const hours = Array(24).fill(0);
  for (const d of docs) {
    const ms = toMs(d.occurredAt);
    if (ms != null) hours[new Date(ms).getHours()] += 1;
  }
  return hours;
}

const pad = (n) => String(n).padStart(2, '0');

/** Jam "14:05" bila hari ini, "Kemarin 14:05", atau "21 Nov 14:05". */
export function formatClock(ms, now = Date.now()) {
  const d = new Date(ms);
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const today = new Date(now);
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return time;
  const yesterday = new Date(now - 86400000);
  if (sameDay(d, yesterday)) return `Kemarin ${time}`;
  return `${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} ${time}`;
}

/** "2 menit lalu", "3 jam lalu", "5 hari lalu". */
export function formatAgo(ms, now = Date.now()) {
  const diff = Math.max(0, now - ms);
  if (diff < 60000) return 'baru saja';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} menit lalu`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} jam lalu`;
  return `${Math.floor(diff / 86400000)} hari lalu`;
}

/** Waktu lengkap untuk rincian: "Sabtu, 21 November 2026 14:05:09". */
export function formatFull(ms) {
  if (ms == null) return '-';
  const d = new Date(ms);
  return `${d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Kepala hari untuk pengelompokan daftar: "SABTU, 21 NOV 2026". */
export const dayKeyOf = (ms) => new Date(ms).toDateString();
export const dayLabelOf = (ms) =>
  new Date(ms).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

/** Rentang periode chip: { from, to } (Date). */
export function periodRange(key, now = Date.now()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const day = 86400000;
  if (key === 'kemarin') return { from: new Date(start.getTime() - day), to: start };
  if (key === '7hari') return { from: new Date(start.getTime() - 6 * day), to: new Date(start.getTime() + day) };
  if (key === '30hari') return { from: new Date(start.getTime() - 29 * day), to: new Date(start.getTime() + day) };
  return { from: start, to: new Date(start.getTime() + day) };
}

/** Kata kunci cocok dengan pesan, nama objek, PC, atau isian konteks (huruf besar/kecil diabaikan). */
export function matchesQuery(doc, query) {
  const words = String(query || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return true;
  const hay = [doc.message, doc.subject?.name, doc.subject?.id, doc.machineName, ...Object.values(doc.context || {})]
    .filter((v) => typeof v === 'string' || typeof v === 'number')
    .join(' ')
    .toLowerCase();
  return words.every((w) => hay.includes(w));
}

// Isian konteks yang tidak ditampilkan di tabel rincian (teknis / sudah ada di tempat lain)
const HIDDEN_CONTEXT = new Set(['stack', 'opRef', 'error', 'trxDocId', 'jobId']);
const CONTEXT_LABEL = {
  customer: 'Customer',
  target: 'Tujuan',
  name: 'Nama',
  email: 'Akun',
  version: 'Versi',
  page: 'Halaman',
  reason: 'Alasan',
  failedSteps: 'Langkah gagal',
  kind: 'Jenis',
  stage: 'Tahap',
  sender: 'Pengirim perintah',
  from: 'Sebelum',
  to: 'Sesudah',
  before: 'Sebelum',
  after: 'Sesudah',
  date: 'Tanggal',
  time: 'Jam',
  package: 'Paket',
  change: 'Perubahan',
  template: 'Template',
  state: 'Status',
  command: 'Perintah',
  chats: 'Jumlah chat',
  summary: 'Ringkasan',
  minutes: 'Menit',
  seq: 'No. catatan',
  rejectedEvent: 'Catatan',
  room: 'Ruangan',
  duration: 'Durasi',
  addOns: 'Item tambahan',
  phone: 'No. HP',
  pushed: 'Ikut terdorong',
  count: 'Jumlah',
  schedule: 'Jadwal',
  drive: 'Folder Drive',
  staff: 'Staff',
  start: 'Mulai',
  trx: 'No. transaksi',
  items: 'Item',
  total: 'Total',
  payment: 'Metode bayar',
  paid: 'Uang diterima',
  changeGiven: 'Kembalian',
  handlers: 'Penanggung jawab',
  fee: 'Fee penanggung jawab',
  tab: 'Rekap',
  display: 'Layar',
  action: 'Aksi',
  what: 'Data',
  folder: 'Folder',
  path: 'Lokasi',
  copied: 'Disalin',
  skipped: 'Sudah ada',
  raw: 'RAW',
  jpg: 'JPG',
  size: 'Ukuran',
  removed: 'Dihapus dari kartu',
  cleanupFailed: 'Gagal dihapus dari kartu',
  marked: 'Ditandai (tidak disalin)',
  destination: 'Tujuan',
  code: 'Kode',
  files: 'File',
  failed: 'Gagal',
  printer: 'Printer',
  copies: 'Salinan',
  paper: 'Kertas',
  slots: 'Area foto',
  layers: 'Layer',
  order: 'Urutan',
  file: 'File',
  field: 'Pengaturan',
  result: 'Hasil',
  port: 'Port',
  detail: 'Rincian',
  fallback: 'Pengganti',
  booking: 'Folder booking',
  seconds: 'Detik',
  attempt: 'Percobaan ke',
  friendly: 'Pesan ke staff',
  peers: 'Dari PC',
  where: 'Lokasi error',
  fix: 'Cara memperbaiki',
  open: 'Jam buka',
  close: 'Jam tutup',
};

/** Isi konteks yang ditampilkan: [{ key, label, value }]. Objek before/after ditampilkan sebagai teks. */
export function contextRows(context = {}) {
  return Object.entries(context)
    .filter(([k, v]) => !HIDDEN_CONTEXT.has(k) && v !== null && v !== '' && v !== undefined)
    .map(([k, v]) => ({
      key: k,
      label: CONTEXT_LABEL[k] || k,
      value: Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : String(v),
    }));
}

/**
 * Teks rapi untuk dikirim ke developer: ringkasan kelompok error, kejadian, detail teknis, dan aksi terakhir di PC
 * sebelum error terakhir.
 */
export function developerReport(group, lastActions = []) {
  const latest = [...group.docs].sort((a, b) => (toMs(b.lastAt) ?? 0) - (toMs(a.lastAt) ?? 0))[0] || {};
  const lines = [
    `Snap Me — laporan error`,
    `Pesan: ${group.message}`,
    ...(group.explain?.title && group.explain.title !== group.message ? [`Penjelasan: ${group.explain.title}`] : []),
    `Event: ${group.event}`,
    `Sidik jari: ${group.fingerprint}`,
    `Jumlah: ${group.count}× (pertama ${formatFull(group.firstAt)}, terakhir ${formatFull(group.lastAt)})`,
    `PC: ${group.machines.join(', ')}`,
    `Versi: ${group.versions.join(', ') || '-'}`,
    `Status: ${group.status === 'resolved' ? 'sudah ditangani' : group.status === 'reopened' ? 'muncul lagi setelah ditangani' : 'belum ditangani'}`,
    '',
    'Kejadian terbaru:',
    `- ${formatFull(toMs(latest.lastAt) ?? toMs(latest.occurredAt))} · ${latest.machineName || latest.machineId} · v${latest.appVersion || '-'}`,
    `- Error: ${latest.context?.error || '-'}`,
    ...contextRows(latest.context).map((r) => `- ${r.label}: ${r.value}`),
  ];
  if (latest.context?.stack) lines.push('', 'Stack:', latest.context.stack);
  if (lastActions.length) {
    lines.push('', 'Aksi terakhir di PC itu sebelum error:');
    for (const a of lastActions) lines.push(`- ${formatFull(toMs(a.occurredAt))} · ${a.message}`);
  }
  return lines.join('\n');
}

/**
 * Pemeriksaan silang log vs data nyata (§8.4) untuk satu catatan: { label, mismatch, path, expect: 'exists' | 'missing' } atau
 * null bila tidak ada pemeriksa untuk event itu. path relatif terhadap organizations/{orgId}.
 */
export function crossCheckFor(doc) {
  const id = doc.subject?.id;
  const ok = doc.status == null || doc.status === 'succeeded';
  if (!id || !ok) return null;
  if (doc.event === 'bot.booking_deleted' || doc.event === 'booking.deleted') {
    return {
      label: 'Booking benar-benar sudah terhapus',
      mismatch: 'Tidak cocok: booking ini masih ada di data, padahal log mencatat terhapus',
      path: ['bookings', id],
      expect: 'missing',
    };
  }
  const isTrxEvent = ['kasir.transaction_created', 'kasir.deposit_created', 'bot.deposit_created'].includes(doc.event);
  if (isTrxEvent && doc.context?.trxDocId) {
    return {
      label: 'Transaksi tersimpan di daftar transaksi',
      mismatch: 'Tidak cocok: transaksi ini tidak ditemukan di daftar transaksi',
      path: ['transactions', doc.context.trxDocId],
      expect: 'exists',
    };
  }
  return null;
}
