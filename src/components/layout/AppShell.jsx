import { NavLink } from 'react-router-dom';
import { CalendarDays, Package, Receipt, UserRound, Users } from 'lucide-react';
import logo from '../../assets/logo.png';
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
 */
export default function AppShell({ canManage, children }) {
  const items = NAV_ITEMS.filter((item) => !item.staffOnly || canManage);
  const linkClass = (base) => ({ isActive }) => `${base}${isActive ? ' is-active' : ''}`;

  return (
    <div className="app-shell">
      <nav className="side-rail" aria-label="Menu utama">
        <img src={logo} alt="Snap Me" className="side-rail-logo" />
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={linkClass('side-rail-item')}>
            <Icon size={18} aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>

      <main className="app-content">{children}</main>

      <nav className="bottom-nav" aria-label="Menu utama">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={linkClass('bottom-nav-item')}>
            <span className="bottom-nav-icon">
              <Icon size={22} aria-hidden="true" />
            </span>
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
