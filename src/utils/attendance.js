// Salinan Snapme_Desktop/src/utils/attendance.js: ubah keduanya bersamaan.
// Absensi staff (docs/RENCANA_TANPA_ROLE.md §3): jadwal mingguan berversi (shiftSchedules) dibandingkan dengan catatan
// kerja (attendance). Semua tanggal "YYYY-MM-DD" kalender lokal, jam "HH:mm". Minggu dimulai Senin.
import { getLocalDateString } from './format';

export const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const DAY_LABEL = {
  mon: 'Senin',
  tue: 'Selasa',
  wed: 'Rabu',
  thu: 'Kamis',
  fri: 'Jumat',
  sat: 'Sabtu',
  sun: 'Minggu',
};
export const DAY_SHORT = {
  mon: 'Sen',
  tue: 'Sel',
  wed: 'Rab',
  thu: 'Kam',
  fri: 'Jum',
  sat: 'Sab',
  sun: 'Min',
};
export const DEFAULT_TOLERANCE_MIN = 10;
export const DEFAULT_SHIFT = { start: '09:00', end: '17:00' };

const MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const parseDate = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const dayKeyOf = (dateStr) => DAY_KEYS[(parseDate(dateStr).getDay() + 6) % 7];

export function addDays(dateStr, days) {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + days);
  return getLocalDateString(d);
}

/** Senin pada minggu tanggal ini. */
export const weekStartOf = (dateStr) => addDays(dateStr, -DAY_KEYS.indexOf(dayKeyOf(dateStr)));

/** "2026-10" → { from: '2026-10-01', to: '2026-10-31' } */
export function monthRange(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return { from: `${monthKey}-01`, to: getLocalDateString(new Date(y, m, 0)) };
}

export const monthKeyOf = (dateStr) => dateStr.slice(0, 7);

export function addMonths(monthKey, months) {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1 + months, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** "2026-10" → "Oktober 2026" */
export function formatMonth(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** "2026-10-24" → "Sabtu, 24 Oktober 2026" (short: "Sab, 24 Okt") */
export function formatDay(dateStr, { short = false } = {}) {
  const d = parseDate(dateStr);
  const day = DAY_KEYS[(d.getDay() + 6) % 7];
  if (short) return `${DAY_SHORT[day]}, ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
  return `${DAY_LABEL[day]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Semua tanggal dari from sampai to (termasuk keduanya). */
export function datesBetween(from, to) {
  const dates = [];
  for (let d = from; d <= to; d = addDays(d, 1)) dates.push(d);
  return dates;
}

/** "09:30" → 570; isian tidak valid → null. */
export function minutesOf(hhmm) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  return h < 24 && m < 60 ? h * 60 + m : null;
}

/** Lama shift dalam menit; 0 bila jam tidak valid atau selesai ≤ mulai (shift lewat tengah malam tidak didukung). */
export function shiftMinutes(start, end) {
  const a = minutesOf(start);
  const b = minutesOf(end);
  return a !== null && b !== null && b > a ? b - a : 0;
}

/** 450 → "7j 30m", 480 → "8j", 0 → "0j" */
export function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}j ${m}m` : `${h}j`;
}

/** Pesan kesalahan isian jam kerja, atau '' bila valid. */
export function shiftError(start, end) {
  if (minutesOf(start) === null || minutesOf(end) === null) return 'Isi jam mulai dan jam selesai.';
  if (!shiftMinutes(start, end)) return 'Jam selesai harus setelah jam mulai.';
  return '';
}

/** Id dokumen versi jadwal: satu versi per cabang per tanggal mulai (menyimpan ulang = menimpa versi itu). */
export const scheduleDocId = (managerId, effectiveFrom) => `${managerId}_${effectiveFrom}`;

/** Versi jadwal yang berlaku pada tanggal: effectiveFrom ≤ tanggal yang paling baru. null bila belum ada. */
export function scheduleVersionOn(versions, dateStr) {
  let found = null;
  versions.forEach((v) => {
    if (v.effectiveFrom <= dateStr && (!found || v.effectiveFrom > found.effectiveFrom)) found = v;
  });
  return found;
}

/** Shift terjadwal pada tanggal: [{ staffId, start, end }] urut jam mulai. */
export function scheduledOn(versions, dateStr) {
  const version = scheduleVersionOn(versions, dateStr);
  const shifts = version?.days?.[dayKeyOf(dateStr)] || [];
  return [...shifts].sort((a, b) => (minutesOf(a.start) ?? 0) - (minutesOf(b.start) ?? 0));
}

/** Label & tone Badge per status staffDayStatus. */
export const STATUS_INFO = {
  hadir: { label: 'Hadir', tone: 'success' },
  terlambat: { label: 'Terlambat', tone: 'warning' },
  'tidak-hadir': { label: 'Tidak hadir', tone: 'danger' },
  belum: { label: 'Belum dicatat', tone: 'neutral' },
  terjadwal: { label: 'Terjadwal', tone: 'neutral' },
  tambahan: { label: 'Tambahan', tone: 'accent' },
};

/** Catatan yang masih berlaku (belum dihapus). */
export const activeRecords = (records) => records.filter((r) => !r.deletedAt);

/**
 * Status satu staff pada satu tanggal.
 * - shift: jadwalnya (atau null), records: catatan kerjanya hari itu
 * - status: 'hadir' | 'terlambat' | 'tidak-hadir' | 'belum' (hari ini, belum dicatat) | 'terjadwal' (tanggal depan) |
 *   'tambahan' (hadir tanpa jadwal)
 * - lateMin / earlyMin: terlambat / pulang lebih awal dibanding jadwal, setelah toleransi
 */
export function staffDayStatus({ shift, records, dateStr, today, toleranceMin = DEFAULT_TOLERANCE_MIN }) {
  const minutes = records.reduce((sum, r) => sum + shiftMinutes(r.start, r.end), 0);
  if (!records.length) {
    const status = dateStr > today ? 'terjadwal' : dateStr === today ? 'belum' : 'tidak-hadir';
    return { status, minutes: 0, lateMin: 0, earlyMin: 0 };
  }
  if (!shift) return { status: 'tambahan', minutes, lateMin: 0, earlyMin: 0 };

  const firstStart = Math.min(...records.map((r) => minutesOf(r.start) ?? Infinity));
  const lastEnd = Math.max(...records.map((r) => minutesOf(r.end) ?? -Infinity));
  const late = firstStart - (minutesOf(shift.start) ?? firstStart);
  const early = (minutesOf(shift.end) ?? lastEnd) - lastEnd;
  const lateMin = late > toleranceMin ? late : 0;
  const earlyMin = early > toleranceMin ? early : 0;
  return {
    status: lateMin ? 'terlambat' : 'hadir',
    minutes,
    lateMin,
    earlyMin,
  };
}

/**
 * Baris per staff pada satu tanggal: semua yang terjadwal, ditambah yang mencatat kerja tanpa jadwal.
 * records: catatan tanggal itu (sudah tanpa yang dihapus). Hasil urut: terjadwal dulu (urut jam), lalu tambahan.
 */
export function dayRows({ versions, records, dateStr, today, toleranceMin }) {
  const shifts = scheduledOn(versions, dateStr);
  const byStaff = new Map();
  records.forEach((r) => byStaff.set(r.staffId, [...(byStaff.get(r.staffId) || []), r]));

  const rows = shifts.map((shift) => {
    const own = byStaff.get(shift.staffId) || [];
    byStaff.delete(shift.staffId);
    return {
      staffId: shift.staffId,
      shift,
      records: own,
      ...staffDayStatus({ shift, records: own, dateStr, today, toleranceMin }),
    };
  });
  byStaff.forEach((own, staffId) =>
    rows.push({
      staffId,
      shift: null,
      records: own,
      ...staffDayStatus({
        shift: null,
        records: own,
        dateStr,
        today,
        toleranceMin,
      }),
    }),
  );
  return rows;
}

/** Ringkasan satu tanggal untuk sel kalender: jumlah terjadwal, hadir, bermasalah (terlambat/tidak hadir). */
export function daySummary(rows) {
  const count = (statuses) => rows.filter((r) => statuses.includes(r.status)).length;
  return {
    scheduled: rows.filter((r) => r.shift).length,
    present: count(['hadir', 'terlambat', 'tambahan']),
    late: count(['terlambat']),
    absent: count(['tidak-hadir']),
  };
}

const emptyRecap = () => ({
  scheduled: 0,
  present: 0,
  absent: 0,
  extra: 0,
  late: 0,
  earlyLeave: 0,
  minutes: 0,
});

/**
 * Rekap performa per staff dalam rentang tanggal: { [staffId]: { scheduled, present, absent, extra, late, earlyLeave,
 * minutes } }. Shift di tanggal yang belum lewat tidak dihitung sebagai jadwal (belum bisa dinilai), kecuali sudah
 * ada catatannya.
 */
export function attendanceRecap({ versions, records, from, to, today, toleranceMin }) {
  const byDate = new Map();
  activeRecords(records).forEach((r) => {
    if (r.date >= from && r.date <= to) byDate.set(r.date, [...(byDate.get(r.date) || []), r]);
  });

  const recap = {};
  const of = (staffId) => (recap[staffId] ||= emptyRecap());
  datesBetween(from, to).forEach((dateStr) => {
    dayRows({
      versions,
      records: byDate.get(dateStr) || [],
      dateStr,
      today,
      toleranceMin,
    }).forEach((row) => {
      if (row.status === 'terjadwal' || row.status === 'belum') return;
      const r = of(row.staffId);
      if (row.shift) r.scheduled += 1;
      if (row.status === 'tidak-hadir') r.absent += 1;
      else r.present += 1;
      if (row.status === 'tambahan') r.extra += 1;
      if (row.lateMin) r.late += 1;
      if (row.earlyMin) r.earlyLeave += 1;
      r.minutes += row.minutes;
    });
  });
  return recap;
}

/** Catatan baru bertumpuk dengan catatan staff yang sama di tanggal yang sama? (exceptId = catatan yang sedang diubah) */
export function overlapsRecord(records, { staffId, date, start, end }, exceptId) {
  const a = minutesOf(start);
  const b = minutesOf(end);
  return activeRecords(records).some(
    (r) =>
      r.id !== exceptId && r.staffId === staffId && r.date === date && minutesOf(r.start) < b && a < minutesOf(r.end),
  );
}
