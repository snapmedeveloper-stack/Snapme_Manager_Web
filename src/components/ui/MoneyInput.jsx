import { formatRupiah } from '../../utils/format';

// Batas digit supaya angka tetap aman sebagai Number (dan wajar untuk rupiah)
const MAX_DIGITS = 12;

/**
 * Isian rupiah (docs/STANDAR_UI.md §4): tampil "Rp 15.000" saat diketik, sedangkan value & onChange(nilai) hanya digit
 * ("15000", '' = kosong). Keyboard angka di HP. Atribut lain (id, aria-*, autoFocus, …) diteruskan ke <input>.
 */
export default function MoneyInput({ value, onChange, className = '', ...rest }) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="Rp 0"
      className={`input num${className ? ` ${className}` : ''}`}
      value={digits ? formatRupiah(Number(digits)) : ''}
      onChange={(e) =>
        onChange(
          e.target.value
            .replace(/\D/g, '')
            .replace(/^0+(?=\d)/, '')
            .slice(0, MAX_DIGITS),
        )
      }
      {...rest}
    />
  );
}
