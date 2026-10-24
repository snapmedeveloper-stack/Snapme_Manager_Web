
/** Indikator memuat. size: 'sm' | 'md' | 'lg'. */
export default function Spinner({ size = 'md', label = 'Memuat' }) {
  return <span className={`spinner${size !== 'md' ? ` spinner-${size}` : ''}`} role="status" aria-label={label} />;
}
