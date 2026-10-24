import { ChevronDown } from 'lucide-react';

/**
 * Select standar (docs/STANDAR_UI.md §5, class .select + .select-wrap dengan ikon panah).
 * onChange(nilaiBaru) menerima nilai string, bukan event. Isinya elemen <option>.
 */
export default function Select({ value, onChange, className = '', children, ...rest }) {
  return (
    <div className={`select-wrap${className ? ` ${className}` : ''}`}>
      <select className="select" value={value} onChange={(e) => onChange(e.target.value)} {...rest}>
        {children}
      </select>
      <ChevronDown size={14} aria-hidden="true" />
    </div>
  );
}
