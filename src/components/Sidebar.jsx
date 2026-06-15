import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, Receipt, LogOut, User, X } from 'lucide-react';

const Sidebar = ({ user, onLogout, isOpen, onClose }) => {
  return (
    <>
      {/* Sidebar Backdrop Overlay */}
      {isOpen && <div className="sidebar-overlay-bg" onClick={onClose} />}
      
      <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Snapme Manager</h2>
          <button className="mobile-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <nav className="nav-menu" style={{ flex: 1 }}>
          <NavLink 
            to="/" 
            className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}
            onClick={onClose}
          >
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </NavLink>
          
          <NavLink 
            to="/timeline" 
            className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}
            onClick={onClose}
          >
            <CalendarDays size={20} />
            <span>Timeline</span>
          </NavLink>
          
          <NavLink 
            to="/transaksi" 
            className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}
            onClick={onClose}
          >
            <Receipt size={20} />
            <span>Transaksi</span>
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Avatar" />
              ) : (
                <User size={20} color="var(--text-secondary)" />
              )}
            </div>
            <div className="user-info">
              <span className="user-name">{user?.displayName || user?.email?.split('@')[0]}</span>
              <span className="user-email">{user?.email}</span>
            </div>
          </div>
          <button className="btn btn-logout" onClick={onLogout}>
            <LogOut size={18} />
            <span>Keluar</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
