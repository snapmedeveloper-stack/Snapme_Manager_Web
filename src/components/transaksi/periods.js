// Periode laporan Transaksi dan pengelompokan "waktu sibuk". Khusus Manager (Desktop hanya punya 5 periode tanpa grafik).

import { getLocalDateString } from '../../utils/format';

export const PERIODS = [
  { value: 'today', label: 'Hari ini' },
  { value: 'yesterday', label: 'Kemarin' },
  { value: 'day_before', label: 'Kemarin lusa' },
  { value: 'week', label: 'Minggu ini' },
  { value: 'last_week', label: 'Minggu lalu' },
  { value: 'month', label: 'Bulan ini' },
  { value: 'last_month', label: 'Bulan lalu' },
  { value: 'custom', label: 'Pilih tanggal' },
  { value: 'all', label: 'Semua' },
];

const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
const BUSY_HOURS = { from: 10, to: 22 }; // jam buka studio: selalu tampil walau kosong

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
/** "YYYY-MM-DD" → awal hari itu (waktu lokal). */
const parseDay = (value) => {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
};
/** Senin minggu ini (minggu dimulai Senin, sama dengan Snapme Manager sebelumnya). */
const mondayOf = (date) => addDays(startOfDay(date), -((date.getDay() + 6) % 7));

/**
 * Rentang query { startDate, endDate } untuk periode: endDate eksklusif (awal hari sesudahnya), null = tanpa batas.
 * custom = { from, to } "YYYY-MM-DD"; tanggal akhir boleh kosong (satu hari).
 */
export function periodRange(period, custom) {
  const today = startOfDay(new Date());
  switch (period) {
    case 'today':
      return { startDate: today, endDate: null };
    case 'yesterday':
      return { startDate: addDays(today, -1), endDate: today };
    case 'day_before':
      return { startDate: addDays(today, -2), endDate: addDays(today, -1) };
    case 'week':
      return { startDate: mondayOf(today), endDate: null };
    case 'last_week': {
      const monday = mondayOf(today);
      return { startDate: addDays(monday, -7), endDate: monday };
    }
    case 'month':
      return { startDate: new Date(today.getFullYear(), today.getMonth(), 1), endDate: null };
    case 'last_month':
      return {
        startDate: new Date(today.getFullYear(), today.getMonth() - 1, 1),
        endDate: new Date(today.getFullYear(), today.getMonth(), 1),
      };
    case 'custom': {
      if (!custom.from) return { startDate: today, endDate: addDays(today, 1) };
      const from = parseDay(custom.from);
      const to = custom.to && custom.to >= custom.from ? parseDay(custom.to) : from;
      return { startDate: from, endDate: addDays(to, 1) };
    }
    default:
      return { startDate: null, endDate: null };
  }
}

const dayText = (date) => date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

/** Label periode untuk judul laporan PDF, mis. "Minggu Lalu (13 Okt 2026 - 19 Okt 2026)". */
export function periodLabel(period, { startDate, endDate }) {
  if (period === 'all' || !startDate) return 'Semua Waktu';
  const lastDay = endDate ? addDays(endDate, -1) : startOfDay(new Date());
  const name = PERIODS.find((p) => p.value === period)?.label || '';
  const range =
    getLocalDateString(startDate) === getLocalDateString(lastDay)
      ? startDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
      : `${dayText(startDate)} - ${dayText(lastDay)}`;
  return period === 'custom' ? range : `${name} (${range})`;
}

const millisOf = (ts) => (ts?.toMillis ? ts.toMillis() : null);

/**
 * Jumlah transaksi per waktu untuk grafik waktu sibuk.
 * mode 'hour' = per jam (10:00–22:00 selalu tampil); 'day' = per tanggal dalam rentang (minggu: nama hari);
 * 'month' = per bulan (periode Semua). Mengembalikan [{ key, label, count }] urut waktu.
 */
export function busyBuckets(transactions, mode, { startDate, endDate }) {
  const buckets = new Map();
  const add = (key, label) => {
    if (!buckets.has(key)) buckets.set(key, { key, label, count: 0 });
    return buckets.get(key);
  };

  if (mode === 'hour') {
    for (let h = BUSY_HOURS.from; h <= BUSY_HOURS.to; h += 1) add(h, String(h).padStart(2, '0'));
  } else if (mode === 'day' && startDate) {
    const last = endDate ? addDays(endDate, -1) : startOfDay(new Date());
    const isWeek = (last - startDate) / 86400000 < 7;
    for (let d = startDate; d <= last; d = addDays(d, 1)) {
      add(getLocalDateString(d), isWeek ? DAY_NAMES[d.getDay()] : String(d.getDate()));
    }
  }

  transactions.forEach((tx) => {
    const millis = millisOf(tx.createdAt);
    if (millis === null) return;
    const d = new Date(millis);
    if (mode === 'hour') add(d.getHours(), String(d.getHours()).padStart(2, '0')).count += 1;
    else if (mode === 'day') {
      const bucket = buckets.get(getLocalDateString(d));
      if (bucket) bucket.count += 1;
    } else add(d.getFullYear() * 12 + d.getMonth(), `${MONTH_NAMES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`).count += 1;
  });

  return [...buckets.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}
