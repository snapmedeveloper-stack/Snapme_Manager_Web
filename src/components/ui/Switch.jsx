
/**
 * Saklar on/off standar (docs/STANDAR_UI.md §5, class .switch).
 * checked, onChange(nilaiBaru). Tanpa label teks yang terlihat, ariaLabel wajib diisi.
 */
export default function Switch({ checked, onChange, disabled, ariaLabel, className = '', ...rest }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      aria-label={ariaLabel}
      className={`switch${checked ? ' is-on' : ''}${className ? ` ${className}` : ''}`}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      {...rest}
    />
  );
}
