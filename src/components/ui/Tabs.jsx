
/**
 * Tab / segmented control standar (docs/STANDAR_UI.md §5, class .tabs + .tab).
 * options: [{ value, label, icon? }] — icon berupa komponen lucide. ariaLabel menamai kelompok tab.
 */
export default function Tabs({ options, value, onChange, ariaLabel }) {
  return (
    <div className="tabs" role="group" aria-label={ariaLabel}>
      {options.map(({ value: optionValue, label, icon: Icon }) => (
        <button
          key={optionValue}
          type="button"
          className={`tab${optionValue === value ? ' is-active' : ''}`}
          aria-pressed={optionValue === value}
          onClick={() => onChange(optionValue)}
        >
          {Icon && <Icon size={14} aria-hidden="true" />}
          {label}
        </button>
      ))}
    </div>
  );
}
