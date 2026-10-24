
const ICON_SIZE = { sm: 14, md: 16, lg: 18 };

/**
 * Tombol standar (docs/STANDAR_UI.md §5).
 * variant: 'default' | 'primary' | 'ghost' | 'danger'; size: 'sm' | 'md' | 'lg'.
 * icon: komponen ikon lucide-react. iconOnly wajib disertai aria-label.
 */
export default function Button({
  variant = 'default',
  size = 'md',
  icon: Icon,
  iconOnly = false,
  loading = false,
  block = false,
  type = 'button',
  className = '',
  disabled,
  children,
  ...rest
}) {
  const classes = [
    'btn',
    variant !== 'default' && `btn-${variant}`,
    size !== 'md' && `btn-${size}`,
    iconOnly && 'btn-icon',
    block && 'btn-block',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? (
        <span className="spinner spinner-sm" aria-hidden="true" />
      ) : (
        Icon && <Icon size={ICON_SIZE[size]} aria-hidden="true" />
      )}
      {!iconOnly && children}
    </button>
  );
}
