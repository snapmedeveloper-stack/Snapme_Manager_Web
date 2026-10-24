// Salinan Snapme_Desktop/src/components/ui/TimeInput.jsx: ubah keduanya bersamaan.
import { useState } from 'react';

const RESYNC = {}; // penanda: salin ulang value pada render berikutnya

/** Angka yang diketik → { hh, mm } apa adanya. Jam diawali 3–9 dianggap satu digit ("930" = 09:30). */
function split(text) {
  const digits = text.replace(/\D/g, '').slice(0, 4);
  if (!digits) return null;
  const oneDigitHour = digits[0] >= '3';
  const hh = oneDigitHour ? `0${digits[0]}` : digits.slice(0, 2);
  const mm = oneDigitHour ? digits.slice(1, 3) : digits.slice(2, 4);
  return { hh, mm, typedHour: oneDigitHour || digits.length >= 2 };
}

/** Tampilan saat mengetik: titik dua disisipkan otomatis ("0930" → "09:30"). */
function mask(text) {
  const parts = split(text);
  if (!parts) return '';
  if (!parts.mm) return parts.typedHour ? parts.hh : parts.hh.slice(0, 1);
  return `${parts.hh}:${parts.mm}`;
}

/** Saat keluar dari isian: lengkapi jadi "HH:MM" ("9" → "09:00", "13:3" → "13:30"). */
function complete(text) {
  const parts = split(text);
  if (!parts) return '';
  return `${parts.hh.padStart(2, '0')}:${parts.mm.padEnd(2, '0')}`;
}

/**
 * Isian jam format 24 jam "HH:MM" (docs/STANDAR_UI.md). Pengganti <input type="time">, yang tampil AM/PM bila bahasa
 * sistem/peramban bukan Indonesia. value & onChange(nilai) berupa string "HH:MM" (boleh belum lengkap saat diketik;
 * validasi oleh pemanggil, mis. utils/attendance shiftError).
 */
export default function TimeInput({ value, onChange, className = '', ...rest }) {
  const [text, setText] = useState(value || '');
  const [focused, setFocused] = useState(false);
  const [seenValue, setSeenValue] = useState(value);
  // Nilai diganti dari luar (mis. jam terisi otomatis dari jadwal). Saat sedang diketik diabaikan, karena pemanggil
  // bisa menurunkan value dari hasil parse ketikan yang belum lengkap.
  if (!focused && seenValue !== value) {
    setSeenValue(value);
    setText(value || '');
  }

  const update = (next) => {
    setText(next);
    onChange(next);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="HH:MM"
      maxLength={5}
      className={`input num${className ? ` ${className}` : ''}`}
      value={text}
      onChange={(e) => update(mask(e.target.value))}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        // Selesai mengetik: tampilkan lagi nilai dari pemanggil (ketikan yang ditolak pemanggil ikut kembali)
        setSeenValue(RESYNC);
        const next = complete(text);
        if (next !== text) update(next);
      }}
      {...rest}
    />
  );
}
