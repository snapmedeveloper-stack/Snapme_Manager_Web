// Salinan Snapme_Desktop/src/components/ui/ColorPicker.jsx: ubah keduanya bersamaan.
import { CATEGORY_COLORS } from '../../constants/colors';

const sameColor = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

/**
 * Pemilih warna kategori (docs/STANDAR_UI.md §3.6): 8 warna --cat-*.
 * Warna lama di luar daftar ditampilkan sebagai pilihan pertama supaya tetap tersimpan bila tidak diganti.
 */
export default function ColorPicker({ value, onChange, ariaLabel = 'Pilih warna', colors = CATEGORY_COLORS }) {
  const isLegacy = value && !colors.some((c) => sameColor(c.value, value));
  const options = isLegacy ? [{ value, label: 'Warna saat ini' }, ...colors] : colors;

  return (
    <div className="color-picker" role="radiogroup" aria-label={ariaLabel}>
      {options.map((c) => {
        const selected = sameColor(c.value, value);
        return (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={c.label}
            title={c.label}
            className={`swatch${selected ? ' is-selected' : ''}`}
            style={{ '--swatch': c.value }}
            onClick={() => onChange(c.value)}
          />
        );
      })}
    </div>
  );
}
