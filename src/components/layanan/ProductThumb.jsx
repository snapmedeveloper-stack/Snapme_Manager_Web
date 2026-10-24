// Salinan Snapme_Desktop/src/components/layanan/ProductThumb.jsx: ubah keduanya bersamaan.
import { useState } from 'react';
import { ImageOff } from 'lucide-react';

/** Gambar produk; kosong atau gagal dimuat (URL rusak/terhapus) → ikon pengganti, bukan gambar pecah. */
export default function ProductThumb({ src, large = false, placeholder: Placeholder = ImageOff }) {
  const [failedSrc, setFailedSrc] = useState(null);
  const showImage = src && failedSrc !== src;
  return (
    <span className={`lyn-thumb${large ? ' lyn-thumb-lg' : ''}`}>
      {showImage ? (
        <img src={src} alt="" onError={() => setFailedSrc(src)} />
      ) : (
        <Placeholder size={large ? 20 : 16} aria-hidden="true" />
      )}
    </span>
  );
}
