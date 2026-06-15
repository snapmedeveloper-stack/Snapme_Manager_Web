import React from 'react';
import Sidebar from './Sidebar';

const Layout = ({ children, user, onLogout }) => {
  return (
    <div className="app-container">
      <Sidebar user={user} onLogout={onLogout} />
      <main className="main-content">
        {children}
      </main>
    </div>
  );
};

export default Layout;
