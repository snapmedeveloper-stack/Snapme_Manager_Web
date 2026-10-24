
/**
 * Badge status/role (docs/STANDAR_UI.md §5).
 * tone: 'neutral' | 'accent' | 'success' | 'warning' | 'danger'. icon: komponen ikon lucide-react (opsional).
 */
export default function Badge({ tone = 'neutral', icon: Icon, className = '', children, ...rest }) {
  return (
    <span className={`badge badge-${tone}${className ? ` ${className}` : ''}`} {...rest}>
      {Icon && <Icon size={12} aria-hidden="true" />}
      {children}
    </span>
  );
}
