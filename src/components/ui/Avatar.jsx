import { useState } from 'react';

/** "Budi Santoso" → "BS"; nama kosong → "#". */
function initials(name) {
  const parts = String(name || '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '#';
  return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}

/** Foto profil bulat; jika foto tidak ada atau gagal dimuat, tampilkan inisial nama. */
export default function Avatar({ src, name, size = 32 }) {
  const [brokenSrc, setBrokenSrc] = useState(null);
  const showImage = src && brokenSrc !== src;

  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}>
      {showImage ? <img src={src} alt="" onError={() => setBrokenSrc(src)} /> : initials(name)}
    </span>
  );
}
