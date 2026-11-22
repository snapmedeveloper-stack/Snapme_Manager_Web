import { NavLink } from 'react-router-dom';
import { CalendarDays, Package, Receipt, UserRound, Users } from 'lucide-react';
import logo from '../../assets/logo.png';
import { useNewErrorCount } from '../log/useLogData';
import './layout.css';

// Menu utama. staffOnly = hanya owner & manager (sama dengan akses halaman Layanan di Snapme_Desktop).
const NAV_ITEMS = [
  { to: '/timeline', label: 'Timeline', icon: CalendarDays },
  { to: '/transaksi', label: 'Transaksi', icon: Receipt },
  { to: '/layanan', label: 'Layanan', icon: Package, staffOnly: true },
  { to: '/tim', label: 'Tim', icon: Users, staffOnly: true },
  { to: '/profil', label: 'Profil', icon: UserRound },
];

/**
 * Kerangka aplikasi: navbar bawah di HP, rail samping di layar lebar (≥1024px). Hanya satu yang tampil (CSS).
 * Halaman dirender di .app-content: setinggi layar dan bisa di-scroll; app bar halaman memakai AppBar.
 * Owner: menu Profil diberi tanda jumlah error baru dari Snap Me Desktop (pintu masuk Log aplikasi ada di Profil).
 */
export default function AppShell({ canManage, orgId, children }) {
  const items = NAV_ITEMS.filter((item) => !item.staffOnly || canManage);
  const newErrors = useNewErrorCount(canManage ? orgId : null);
  const badgeOf = (to) => (to === '/profil' && newErrors > 0 ? newErrors : null);
  const badgeLabel = (n) => `${n} error baru di log aplikasi`;
  const linkClass =
    (base) =>
    ({ isActive }) =>
      `${base}${isActive ? ' is-active' : ''}`;

  return (
    <div className="app-shell">
      <nav className="side-rail" aria-label="Menu utama">
        <img src={logo} alt="Snap Me" className="side-rail-logo" />
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={linkClass('side-rail-item')}>
            <Icon size={18} aria-hidden="true" />
            {label}
            {badgeOf(to) && (
              <span className="nav-badge num" aria-label={badgeLabel(badgeOf(to))}>
                {badgeOf(to)}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <main className="app-content">{children}</main>

      <nav className="bottom-nav" aria-label="Menu utama">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={linkClass('bottom-nav-item')}>
            <span className="bottom-nav-icon">
              <Icon size={22} aria-hidden="true" />
              {badgeOf(to) && (
                <span className="nav-badge num" aria-label={badgeLabel(badgeOf(to))}>
                  {badgeOf(to)}
                </span>
              )}
            </span>
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
