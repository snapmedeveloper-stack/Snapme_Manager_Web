import { NavLink, useNavigate } from 'react-router-dom';
import { Activity, ArrowLeft, CircleAlert, LayoutDashboard, MonitorSmartphone } from 'lucide-react';
import { Button, Select } from '../ui';
import logo from '../../assets/logo.png';
import '../layout/layout.css';

const NAV_ITEMS = [
  { to: '/log', label: 'Ringkasan', icon: LayoutDashboard, end: true },
  { to: '/log/aktivitas', label: 'Aktivitas', icon: Activity },
  { to: '/log/error', label: 'Error', icon: CircleAlert, badgeKey: 'errors' },
  { to: '/log/perangkat', label: 'Perangkat', icon: MonitorSmartphone },
];

/**
 * Kerangka "mode Log" (Snapme_Desktop/docs/RENCANA_LOG_APLIKASI.md §7.2.1): mengganti app bar & navbar Manager dengan
 * menu pemantauan sendiri, seperti membuka situs lain. ← kembali ke Profil. Pilihan cabang berlaku untuk semua menu.
 * badges = { errors: jumlah error belum ditangani }.
 */
export default function LogShell({ title, branches = [], managerId, onViewManagerChange, badges = {}, children }) {
  const navigate = useNavigate();
  const linkClass =
    (base) =>
    ({ isActive }) =>
      `${base}${isActive ? ' is-active' : ''}`;
  const badgeOf = (item) => (item.badgeKey && badges[item.badgeKey] > 0 ? badges[item.badgeKey] : null);

  return (
    <div className="app-shell log-shell">
      <nav className="side-rail" aria-label="Menu log aplikasi">
        <img src={logo} alt="Snap Me" className="side-rail-logo" />
        <span className="log-rail-title">Log aplikasi</span>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const badge = badgeOf(item);
          return (
            <NavLink key={item.to} to={item.to} end={item.end} className={linkClass('side-rail-item')}>
              <Icon size={18} aria-hidden="true" />
              {item.label}
              {badge && <span className="log-nav-badge num">{badge}</span>}
            </NavLink>
          );
        })}
        <button type="button" className="side-rail-item log-rail-back" onClick={() => navigate('/profil')}>
          <ArrowLeft size={18} aria-hidden="true" />
          Kembali ke Manager
        </button>
      </nav>

      <main className="app-content">
        <header className="app-bar log-app-bar">
          <Button
            variant="ghost"
            iconOnly
            icon={ArrowLeft}
            aria-label="Kembali ke Profil"
            className="log-back"
            onClick={() => navigate('/profil')}
          />
          <h1 className="app-bar-title">{title}</h1>
          {branches.length > 1 && (
            <div className="app-bar-actions log-branch">
              <Select value={managerId || ''} onChange={onViewManagerChange} aria-label="Cabang">
                <option value="">Semua cabang</option>
                {branches.map((b) => (
                  <option key={b.managerId} value={b.managerId}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </header>
        {children}
      </main>

      <nav className="bottom-nav" aria-label="Menu log aplikasi">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const badge = badgeOf(item);
          return (
            <NavLink key={item.to} to={item.to} end={item.end} className={linkClass('bottom-nav-item')}>
              <span className="bottom-nav-icon log-nav-icon">
                <Icon size={22} aria-hidden="true" />
                {badge && <span className="log-nav-badge num">{badge}</span>}
              </span>
              {item.label}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
