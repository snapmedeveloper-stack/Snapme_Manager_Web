import React, { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { db } from '../firebase';
import { collection, onSnapshot, query, where, getDocs } from 'firebase/firestore';

const Dashboard = ({ orgId }) => {
  const [stats, setStats] = useState({ totalBookings: 0, todayRevenue: 0, activeSessions: 0 });
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    if (!orgId) return;

    const d = new Date();
    const todayStr = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
    
    // Start of today for timestamp queries
    const startOfToday = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    // Fetch Bookings (for total bookings and active sessions)
    const bookingsRef = collection(db, 'organizations', orgId, 'bookings');
    const qBookings = query(bookingsRef, where('date', '==', todayStr));
    
    const unsubBookings = onSnapshot(qBookings, (snap) => {
      let totalBookings = 0;
      let activeSessions = 0;
      snap.forEach(doc => {
        totalBookings++;
        const data = doc.data();
        if (data.arrivedAt && !data.completedAt) {
          activeSessions++;
        }
      });
      setStats(prev => ({ ...prev, totalBookings, activeSessions }));
    });

    // Fetch Transactions (for revenue and chart)
    const txRef = collection(db, 'organizations', orgId, 'transactions');
    const qTx = query(txRef, where('createdAt', '>=', startOfToday));

    const unsubTx = onSnapshot(qTx, (snap) => {
      let todayRevenue = 0;
      const hourlyData = {};
      
      // Initialize hours 08:00 to 22:00
      for(let i = 8; i <= 22; i += 2) {
        hourlyData[`${i.toString().padStart(2, '0')}:00`] = { name: `${i.toString().padStart(2, '0')}:00`, revenue: 0, count: 0 };
      }

      snap.forEach(doc => {
        const data = doc.data();
        // Assuming data.cart exists and we sum price, or data.totalAmount
        const amount = data.totalAmount || data.amount || 0;
        todayRevenue += amount;

        let hour = 8;
        if (data.createdAt && data.createdAt.toDate) {
          const date = data.createdAt.toDate();
          hour = date.getHours();
        }
        
        // Group by 2-hour intervals
        const bin = Math.floor(hour / 2) * 2;
        const binKey = `${bin.toString().padStart(2, '0')}:00`;
        
        if (hourlyData[binKey]) {
          hourlyData[binKey].revenue += amount;
          hourlyData[binKey].count += 1;
        }
      });

      setStats(prev => ({ ...prev, todayRevenue }));
      setChartData(Object.values(hourlyData));
    });

    return () => {
      unsubBookings();
      unsubTx();
    };
  }, [orgId]);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Dashboard Analitik</h1>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>Refresh Data</button>
      </div>

      <div className="dashboard-grid">
        <div className="card stat-card">
          <span className="stat-title">Total Booking Hari Ini</span>
          <span className="stat-value">{stats.totalBookings}</span>
        </div>
        <div className="card stat-card">
          <span className="stat-title">Pendapatan Hari Ini</span>
          <span className="stat-value">Rp {stats.todayRevenue.toLocaleString('id-ID')}</span>
        </div>
        <div className="card stat-card">
          <span className="stat-title">Sesi Aktif</span>
          <span className="stat-value">{stats.activeSessions}</span>
        </div>
      </div>

      <div className="card" style={{ height: '400px' }}>
        <h3 style={{ marginBottom: '20px' }}>Grafik Pendapatan Hari Ini</h3>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#777'}} dy={10} />
            <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fill: '#777'}} dx={-10} tickFormatter={(val) => `Rp ${val / 1000}k`} />
            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
              formatter={(value) => [`Rp ${value.toLocaleString('id-ID')}`, 'Pendapatan']}
            />
            <Area yAxisId="left" type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default Dashboard;
