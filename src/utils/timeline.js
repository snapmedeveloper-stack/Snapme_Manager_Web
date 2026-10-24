// Hitungan jadwal booking. Diambil dari Snapme_Desktop/src/components/timeline/timelineUtils.js (dan cara tulis
// useTimelineBookings.js) supaya aturan jadwal kedua aplikasi sama: ubah keduanya bersamaan.
// Posisi blok memakai "menit timeline" = menit sejak START_HOUR.

import { deleteField, doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { PACKAGE_FALLBACK_COLOR } from '../constants/colors';

export const START_HOUR = 4;
export const END_HOUR = 24;
export const TOTAL_HOURS = END_HOUR - START_HOUR;
/** Celah kosong minimal (menit) agar tombol tambah booking muncul. */
export const MIN_GAP_MINUTES = 20;
export const SNAP_MINUTES = 1;
export const MIN_DURATION = 10;

export const TOTAL_MINUTES = TOTAL_HOURS * 60;
/** Jam di penggaris dan garis latar track (04:00–24:00). */
export const HOURS = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => START_HOUR + i);

export const RECAP_TABS = ['Semua', 'Studio', 'Photobooth'];

/** Menit timeline dari jam mulai booking. */
export const timelineMin = (booking) => (booking.startHour - START_HOUR) * 60 + booking.startMin;
/** Jam & menit mulai dari menit timeline. */
export const clockAt = (min) => ({ startHour: Math.floor(min / 60) + START_HOUR, startMin: min % 60 });

export const packageColor = (packages, packageName) =>
  packages.find((p) => p.name === packageName)?.color || PACKAGE_FALLBACK_COLOR;

/** Nama studio/photobooth, atau id-nya bila tidak ditemukan. */
export const placeName = (placeId, studios, photobooths) =>
  studios.find((s) => s.id === placeId)?.name || photobooths.find((p) => p.id === placeId)?.name || placeId;

/**
 * Paket / item tambahan ditawarkan di ruangan ini? Item yang dibatasi ke photobooth tidak muncul di studio
 * (dan sebaliknya); item tanpa batasan muncul di semua ruangan.
 */
export function isOfferedAt(item, placeId, isPhotobooth) {
  const hasPhotobooths = item.photobooths && item.photobooths.length > 0;
  const hasStudios = item.studios && item.studios.length > 0;
  if (isPhotobooth) return hasPhotobooths ? item.photobooths.includes(placeId) : !hasStudios;
  return hasStudios ? item.studios.includes(placeId) : !hasPhotobooths;
}

// ---------- Waktu ----------

const clockText = (date) =>
  date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(/\./g, ':');

/** "09:00 - 09:30" */
export function formatTimeRange(startHour, startMin, durationMin) {
  const start = new Date();
  start.setHours(startHour, startMin, 0);
  return `${clockText(start)} - ${clockText(new Date(start.getTime() + durationMin * 60000))}`;
}

const startOf = (booking) => booking.startHour * 60 + (booking.startMin || 0);
const endOf = (booking) => startOf(booking) + (booking.duration || 60);
const nowMins = () => {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
};
const endTime = (booking) => {
  const end = new Date();
  end.setHours(booking.startHour, (booking.startMin || 0) + (booking.duration || 60), 0, 0);
  return end.getTime();
};

/** Garis waktu sekarang menyentuh blok booking (menit mulai sampai menit selesai, inklusif). */
export function isInTimeWindow(booking) {
  const now = nowMins();
  return now >= startOf(booking) && now <= endOf(booking);
}

export const isPastEnd = (booking) => Date.now() > endTime(booking);

/**
 * Keadaan jadwal booking (kunci STATUS_TONE): hanya untuk hari ini. 'active' = sedang berjalan, 'done' = sudah lewat,
 * 'waiting' = belum mulai. Tanggal lain selalu 'waiting'. Manager hanya menghitung dari jam; status datang/selesai
 * yang sebenarnya ditulis Snapme_Desktop (arrivedAt, processCompleted).
 */
export function scheduleState(booking, isToday) {
  if (!isToday) return 'waiting';
  const now = nowMins();
  if (endOf(booking) <= now) return 'done';
  if (startOf(booking) <= now) return 'active';
  return 'waiting';
}

/** "HH:MM" untuk isian jam (TimeInput) dari jam & menit booking. */
export const timeInputValue = (hour, min) => `${String(hour).padStart(2, '0')}:${String(min || 0).padStart(2, '0')}`;

/** Jam & menit dari isian "HH:MM", atau null bila kosong / di luar 04:00–23:59. */
export function parseTimeInput(value) {
  const [h, m] = String(value || '').split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < START_HOUR || h >= END_HOUR) return null;
  return { startHour: h, startMin: m };
}

// ---------- Penempatan blok (tambah, geser, ubah durasi) ----------

/** Booking lain di ruangan yang sama (menit mulai timeline + durasi), urut dari yang paling awal. */
const othersIn = (bookings, placeId, exceptId) =>
  bookings
    .filter((b) => b.studio === placeId && b.id !== exceptId)
    .map((b) => ({ id: b.id, min: timelineMin(b), duration: b.duration }))
    .sort((a, b) => a.min - b.min);

/** Menit ini kosong dan celah kosongnya cukup (≥ MIN_GAP_MINUTES) untuk booking baru? */
export function canAddAt(bookings, placeId, min) {
  if (min < 0 || min > TOTAL_MINUTES) return false;
  const ranges = othersIn(bookings, placeId).map((b) => ({ start: b.min, end: b.min + b.duration }));
  if (ranges.some((r) => min >= r.start && min < r.end)) return false;

  let freeStart = 0;
  let freeEnd = TOTAL_MINUTES;
  for (const r of ranges) {
    if (r.end <= min && r.end > freeStart) freeStart = r.end;
    if (r.start > min && r.start < freeEnd) freeEnd = r.start;
  }
  return freeEnd - freeStart >= MIN_GAP_MINUTES && min + MIN_GAP_MINUTES <= freeEnd;
}

/**
 * Letakkan blok [min, min + duration) di ruangan `placeId`. Booking yang mulai pada/sesudah blok didorong ke belakang
 * (pushes: id -> menit geser). snap = blok tidak boleh menimpa booking yang mulai lebih awal (menempel sesudahnya).
 * Mengembalikan { min, duration, pushes }, atau null bila blok/dorongannya melewati 24:00.
 */
export function placeBlock(bookings, { id, placeId, min, duration, snap }) {
  const others = othersIn(bookings, placeId, id);
  let start = Math.max(0, min);
  if (snap) {
    for (const b of others) if (b.min < start) start = Math.max(start, b.min + b.duration);
  }
  const pushes = {};
  let end = start + duration;
  for (const b of others) {
    if (b.min >= start && end > b.min) {
      pushes[b.id] = end - b.min;
      end += b.duration;
    }
  }
  return end <= TOTAL_MINUTES ? { min: start, duration, pushes } : null;
}

/** Geser booking yang terdorong. */
export const shiftBookings = (bookings, pushes) =>
  bookings.map((b) => (pushes[b.id] ? { ...b, ...clockAt(timelineMin(b) + pushes[b.id]) } : b));

/** Nama dipakai booking lain di tanggal yang sama (tanpa beda huruf besar/kecil dan spasi tepi)? */
export const isNameTaken = (bookings, name, date, exceptId) =>
  bookings.some(
    (b) =>
      b.id !== exceptId && b.date === date && (b.customerName || '').trim().toLowerCase() === name.trim().toLowerCase(),
  );

const nameTakenMessage = (name) => `Nama "${name}" sudah terdaftar hari ini. Gunakan nama unik (misal: "${name} 2").`;

/** Pesan kesalahan isian booking baru di slot { placeId, min }, atau '' bila boleh disimpan. */
export function newBookingError(form, bookings, { date, placeId, min, duration }) {
  const name = form.customerName.trim();
  if (!name) return 'Nama Customer wajib diisi!';
  if (!form.package) return 'Paket Studio wajib dipilih!';
  if (isNameTaken(bookings, name, date)) return nameTakenMessage(name);
  const others = othersIn(bookings, placeId);
  // Slot bisa terisi booking dari Desktop / bot WA selama modal terbuka
  if (others.some((b) => b.min <= min && b.min + b.duration > min))
    return 'Jam ini sudah terisi booking lain. Pilih jam lain.';
  const next = others.find((b) => b.min > min);
  const freeMinutes = (next ? next.min : TOTAL_MINUTES) - min;
  if (duration > freeMinutes) {
    return `Durasi paket ${form.package} (${duration} menit) melebihi waktu kosong di jam ini (${freeMinutes} menit). Pilih paket lain atau jam lain.`;
  }
  return '';
}

/** Pesan kesalahan perubahan booking dari modal detail, atau ''. */
export function editBookingError(edits, bookings, booking) {
  if ('customerName' in edits) {
    if (!edits.customerName) return 'Nama Customer wajib diisi!';
    if (isNameTaken(bookings, edits.customerName, booking.date, booking.id))
      return nameTakenMessage(edits.customerName);
  }
  return '';
}

/** Durasi dari isian (boleh teks saat diketik): minimal MIN_DURATION; isian kosong/tidak valid kembali ke fallback. */
export function clampDuration(value, fallback) {
  const minutes = Math.round(Number(value));
  return value === '' || !Number.isFinite(minutes) ? fallback : Math.max(MIN_DURATION, minutes);
}

// Bentuk stabil untuk dibandingkan: urutan field tidak berpengaruh (dokumen dari Firestore bisa berbeda urutan)
const stable = (value) => {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value)
    .sort()
    .reduce((out, key) => ({ ...out, [key]: stable(value[key]) }), {});
};

/** Dua nilai (boleh objek/array bersarang) sama isinya. */
export const sameValue = (a, b) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));

/** Field form yang nilainya berbeda dari booking aslinya. */
export function editedFields(original, form) {
  const edits = {};
  Object.keys(form).forEach((key) => {
    if (!sameValue(original[key], form[key])) edits[key] = form[key];
  });
  return edits;
}

// ---------- Drag & resize ----------

/**
 * Posisi blok saat digeser / diubah durasinya mengikuti kursor. Blok yang digeser menempel sesudah booking yang mulai
 * lebih awal, booking sesudahnya didorong. Saat digeser, ruangan di bawah kursor (hoverStudio) dicoba lebih dulu, lalu
 * ruangan tujuan terakhir. Bila tidak muat sebelum 24:00, posisi terakhir yang muat dipertahankan.
 */
export function dragStep(prev, clientX, pixelsPerMinute, bookings) {
  const deltaMins = Math.round((clientX - prev.startX) / pixelsPerMinute / SNAP_MINUTES) * SNAP_MINUTES;
  const isResize = prev.type === 'resize';
  // Kursor kembali ke titik awal (di ruangan asal): posisi asli, tanpa dorongan; tumpang-tindih lama tidak dirapikan
  if (deltaMins === 0 && (isResize || (prev.hoverStudio ?? prev.targetStudio) === prev.originalStudio)) {
    return {
      ...prev,
      targetStudio: prev.originalStudio,
      currentMin: prev.initialMin,
      currentDuration: prev.initialDuration,
      pushes: {},
    };
  }
  const candidates = isResize
    ? [prev.targetStudio]
    : [...new Set([prev.hoverStudio ?? prev.targetStudio, prev.targetStudio])];
  for (const placeId of candidates) {
    const placed = placeBlock(bookings, {
      id: prev.id,
      placeId,
      min: isResize ? prev.initialMin : prev.initialMin + deltaMins,
      duration: isResize ? Math.max(MIN_DURATION, prev.initialDuration + deltaMins) : prev.initialDuration,
      snap: !isResize,
    });
    if (!placed) continue;
    // Kembali ke posisi asli = tidak ada perubahan: dorongan tidak ditampilkan (drop tanpa perubahan juga tidak ditulis)
    const atOriginal =
      placeId === prev.originalStudio && placed.min === prev.initialMin && placed.duration === prev.initialDuration;
    return {
      ...prev,
      targetStudio: placeId,
      currentMin: placed.min,
      currentDuration: placed.duration,
      pushes: atOriginal ? {} : placed.pushes,
    };
  }
  return prev;
}

/** Daftar booking setelah drag dilepas: blok yang digeser pindah posisi/ruangan, booking yang terdorong ikut bergeser. */
export function applyDrop(bookings, drag) {
  const moved = bookings.map((b) =>
    b.id === drag.id ? { ...b, studio: drag.targetStudio, ...clockAt(drag.currentMin), duration: drag.currentDuration } : b,
  );
  return shiftBookings(moved, drag.pushes);
}

// ---------- Rekap ----------

export function filterByTab(bookings, tab, studios, photobooths) {
  if (tab === 'Studio') return bookings.filter((b) => studios.some((s) => s.id === b.studio));
  if (tab === 'Photobooth') return bookings.filter((b) => photobooths.some((p) => p.id === b.studio));
  return bookings;
}

/** Jumlah booking per status (hanya untuk hari ini) dan total durasi. */
export function recapSummary(bookings, isToday) {
  const now = nowMins();
  const totalMin = bookings.reduce((sum, b) => sum + (b.duration || 60), 0);
  return {
    total: bookings.length,
    running: isToday ? bookings.filter((b) => startOf(b) <= now && endOf(b) > now).length : 0,
    done: isToday ? bookings.filter((b) => endOf(b) <= now).length : 0,
    waiting: isToday ? bookings.filter((b) => startOf(b) > now).length : bookings.length,
    hours: Math.floor(totalMin / 60),
    minutes: totalMin % 60,
  };
}

// ---------- Simpan ke Firestore ----------

/** Field yang berbeda dari a ke b (untuk updateDoc); field yang tidak ada di b dihapus. */
function changedFields(a, b) {
  const fields = {};
  new Set([...Object.keys(a), ...Object.keys(b)]).forEach((key) => {
    if (key !== 'id' && !sameValue(a[key], b[key])) fields[key] = b[key] === undefined ? deleteField() : b[key];
  });
  return fields;
}

/**
 * Tulis selisih daftar booking prev -> next dalam satu batch: booking baru di-set, yang hilang dihapus, yang berubah
 * hanya field yang berubah. Field yang diubah Desktop (datang, bayar, upload, …) tidak ikut tertimpa.
 * Mengembalikan jumlah booking yang berubah; batch yang gagal melempar error.
 */
export async function writeBookingChanges(orgId, prev, next) {
  const prevById = new Map(prev.map((b) => [String(b.id), b]));
  const nextIds = new Set(next.map((b) => String(b.id)));
  const batch = writeBatch(db);
  let count = 0;
  next.forEach((after) => {
    const id = String(after.id);
    const before = prevById.get(id);
    const ref = doc(db, 'organizations', orgId, 'bookings', id);
    if (!before) {
      batch.set(ref, after);
      count += 1;
    } else if (!sameValue(before, after)) {
      batch.update(ref, changedFields(before, after));
      count += 1;
    }
  });
  prev.forEach((before) => {
    if (!nextIds.has(String(before.id))) {
      batch.delete(doc(db, 'organizations', orgId, 'bookings', String(before.id)));
      count += 1;
    }
  });
  if (count) await batch.commit();
  return count;
}
