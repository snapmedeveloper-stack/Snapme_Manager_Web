// Salinan Snapme_Desktop/src/utils/attendance.js: ubah keduanya bersamaan.
// Absensi staff (docs/RENCANA_TANPA_ROLE.md §3): catatan kerja (attendance) dinilai dari jam buka & tutup cabang
// (buka terlambat, lembur); jadwal mingguan berversi (shiftSchedules) hanya acuan siapa yang jaga. Semua tanggal
// "YYYY-MM-DD" kalender lokal, jam "HH:mm". Minggu dimulai Senin.
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

/** Label & tone Badge per status baris dayRows. Jadwal hanya info ("Terjadwal"), tidak dinilai. */
export const STATUS_INFO = {
  hadir: { label: 'Hadir', tone: 'success' },
  jaga: { label: 'Sedang jaga', tone: 'accent' },
  terjadwal: { label: 'Terjadwal', tone: 'neutral' },
};

/** Catatan yang masih berlaku (belum dihapus). */
export const activeRecords = (records) => records.filter((r) => !r.deletedAt);

/** Sedang jaga: catatan dari "Mulai jaga" (Timeline Snapme Desktop) yang jam selesainya masih kosong. */
export const isOnDuty = (record) => !record.deletedAt && !record.end;

/** "09:00–17:00", atau "09:00–sekarang" untuk jaga yang belum selesai. */
export const recordRange = (record) => `${record.start}–${record.end || 'sekarang'}`;

/** Jam sekarang "HH:MM" (waktu lokal). */
export const currentTime = (date = new Date()) =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

/** Lama jaga sampai sekarang, dalam menit, untuk catatan yang belum selesai. */
export const dutyMinutes = (record, now = new Date()) => shiftMinutes(record.start, currentTime(now));

/** Lama jaga: 45 → "45m", 135 → "2j 15m". */
export const formatElapsed = (minutes) => (minutes < 60 ? `${minutes}m` : formatDuration(minutes));

/** Jam kerja ringkas untuk kalender, dibulatkan ke setengah jam: 480 → "8j", 450 → "7,5j", 45 → "45m". */
export const formatHoursShort = (minutes) =>
  minutes < 60 ? `${minutes}m` : `${String(Math.round(minutes / 30) / 2).replace('.', ',')}j`;

/** Inisial untuk ruang sempit: "Ani Nur" → "AN", "Budi" → "BU". */
export function nameInitials(name) {
  const words = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return '?';
  return (words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2)).toUpperCase();
}

/** Nama depan: "Ani Nur" → "Ani". */
export const firstName = (name) =>
  String(name || '')
    .trim()
    .split(/\s+/)[0] || '?';

// ----- Jam buka & tutup -----
// Disimpan per cabang di settings/attendance.openingHours[managerId] = { mon: { open, close } | { closed: true }, … }.
// Penilaian absensi memakai jam ini (bukan jadwal mingguan): buka terlambat dan lembur.

export const DEFAULT_OPENING = { open: '09:00', close: '21:00' };

/** Jam buka tanggal itu: { open, close }, { closed: true } bila tutup, null bila jam buka cabang belum diatur. */
export function hoursOn(openingHours, dateStr) {
  const day = openingHours?.[dayKeyOf(dateStr)];
  return day?.closed || (minutesOf(day?.open) !== null && minutesOf(day?.close) !== null) ? day : null;
}

/** Pesan kesalahan jam buka satu hari, atau '' bila valid (tutup selalu valid). */
export function openingError(day) {
  if (day.closed) return '';
  if (minutesOf(day.open) === null || minutesOf(day.close) === null) return 'Isi jam buka dan jam tutup.';
  if (!shiftMinutes(day.open, day.close)) return 'Jam tutup harus setelah jam buka.';
  return '';
}

/** Selisih menit yang melewati toleransi; 0 bila masih dalam toleransi. */
const beyondTolerance = (minutes, toleranceMin) => (minutes > toleranceMin ? minutes : 0);

/**
 * Penilaian satu tanggal dari catatan kerjanya (tanpa yang dihapus) dan jam buka hari itu (hoursOn):
 * - opener: catatan yang paling awal dimulai (staff yang membuka);
 * - lateOpenMin: jaga pertama dimulai lewat jam buka, setelah toleransi (0 bila tepat waktu / jam belum diatur);
 * - overtimeByStaff: { staffId: menit kerja lewat jam tutup, setelah toleransi }. Jaga yang belum selesai belum dihitung.
 * Hari tutup atau jam buka yang belum diatur tidak dinilai.
 */
export function assessDay({ records, hours, toleranceMin = DEFAULT_TOLERANCE_MIN }) {
  const startOf = (r) => minutesOf(r.start) ?? Infinity;
  const opener = records.reduce((first, r) => (!first || startOf(r) < startOf(first) ? r : first), null);
  const result = { opener, lateOpenMin: 0, overtimeByStaff: {} };
  if (!hours || hours.closed) return result;

  const open = minutesOf(hours.open);
  const close = minutesOf(hours.close);
  if (opener && startOf(opener) !== Infinity)
    result.lateOpenMin = beyondTolerance(startOf(opener) - open, toleranceMin);

  const over = {};
  records.forEach((r) => {
    const end = minutesOf(r.end);
    if (end === null) return;
    // Kerja yang baru dimulai setelah tutup dihitung lembur seluruhnya
    const minutes = end - Math.max(close, minutesOf(r.start) ?? close);
    if (minutes > 0) over[r.staffId] = (over[r.staffId] || 0) + minutes;
  });
  Object.entries(over).forEach(([staffId, minutes]) => {
    const counted = beyondTolerance(minutes, toleranceMin);
    if (counted) result.overtimeByStaff[staffId] = counted;
  });
  return result;
}

/**
 * Baris per staff pada satu tanggal: yang mencatat kerja (urut jam mulai, dinilai dari jam buka & tutup), lalu yang
 * terjadwal tetapi tidak mencatat (info saja; jadwal mingguan tidak ikut penilaian). records: catatan tanggal itu tanpa
 * yang dihapus; openingHours: jam buka cabang.
 * Baris: { staffId, shift, records, minutes, status: 'hadir' | 'jaga' | 'terjadwal', isOpener, lateOpenMin, overtimeMin }
 */
export function dayRows({ versions, records, dateStr, openingHours, toleranceMin }) {
  const shiftOf = new Map(scheduledOn(versions, dateStr).map((s) => [s.staffId, s]));
  const { opener, lateOpenMin, overtimeByStaff } = assessDay({
    records,
    hours: hoursOn(openingHours, dateStr),
    toleranceMin,
  });
  const byStaff = new Map();
  [...records]
    .sort((a, b) => (minutesOf(a.start) ?? 0) - (minutesOf(b.start) ?? 0))
    .forEach((r) => byStaff.set(r.staffId, [...(byStaff.get(r.staffId) || []), r]));

  const rows = [...byStaff].map(([staffId, own]) => {
    const isOpener = opener?.staffId === staffId;
    return {
      staffId,
      shift: shiftOf.get(staffId) || null,
      records: own,
      minutes: own.reduce((sum, r) => sum + shiftMinutes(r.start, r.end), 0),
      status: own.some((r) => !r.end) ? 'jaga' : 'hadir',
      isOpener,
      lateOpenMin: isOpener ? lateOpenMin : 0,
      overtimeMin: overtimeByStaff[staffId] || 0,
    };
  });
  shiftOf.forEach((shift, staffId) => {
    if (!byStaff.has(staffId))
      rows.push({
        staffId,
        shift,
        records: [],
        minutes: 0,
        status: 'terjadwal',
        isOpener: false,
        lateOpenMin: 0,
        overtimeMin: 0,
      });
  });
  return rows;
}

/** Ringkasan satu tanggal untuk sel kalender: jumlah staff yang bekerja, buka terlambat, ada lembur. */
export function daySummary(rows) {
  return {
    present: rows.filter((r) => r.records.length).length,
    lateOpen: rows.some((r) => r.lateOpenMin),
    overtime: rows.some((r) => r.overtimeMin),
  };
}

/**
 * Rekap per staff dalam rentang tanggal: { [staffId]: { days, minutes, lateOpen, overtimeMin } }
 * - days: hari bekerja, minutes: total jam kerja (jaga yang belum selesai belum dihitung);
 * - lateOpen: berapa kali staff ini membuka studio terlambat; overtimeMin: total menit lembur.
 */
export function attendanceRecap({ records, from, to, openingHours, toleranceMin }) {
  const byDate = new Map();
  activeRecords(records).forEach((r) => {
    if (r.date >= from && r.date <= to) byDate.set(r.date, [...(byDate.get(r.date) || []), r]);
  });

  const recap = {};
  byDate.forEach((dayRecords, dateStr) => {
    dayRows({ versions: [], records: dayRecords, dateStr, openingHours, toleranceMin }).forEach((row) => {
      const r = (recap[row.staffId] ||= { days: 0, minutes: 0, lateOpen: 0, overtimeMin: 0 });
      r.days += 1;
      r.minutes += row.minutes;
      if (row.lateOpenMin) r.lateOpen += 1;
      r.overtimeMin += row.overtimeMin;
    });
  });
  return recap;
}

/**
 * Catatan baru bertumpuk dengan catatan staff yang sama di tanggal yang sama? (exceptId = catatan yang sedang diubah)
 * Jaga yang belum selesai dianggap berlangsung sampai akhir hari.
 */
export function overlapsRecord(records, { staffId, date, start, end }, exceptId) {
  const a = minutesOf(start);
  const b = minutesOf(end);
  return activeRecords(records).some(
    (r) =>
      r.id !== exceptId &&
      r.staffId === staffId &&
      r.date === date &&
      minutesOf(r.start) < b &&
      a < (r.end ? minutesOf(r.end) : 24 * 60),
  );
}
