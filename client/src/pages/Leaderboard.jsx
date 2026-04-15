import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import db from '../data/defaultDb';

export default function Leaderboard() {
  const [users, setUsers] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    // Offline: leaderboard not available. You could compute session-only stats here.
    setUsers([]);
  }, []);

  return (
    <div className="container">
      <div className="header-bar">
        <h2>🏆 ლიდერბორდი (Top Hackers)</h2>
        <button className="btn btn-primary" onClick={() => navigate('/roadmap')}>გზამკვლევში დაბრუნება</button>
      </div>

      <div className="glass-panel" style={{ maxWidth: '800px', margin: '0 auto' }}>
        <table style={{ width: '100%', textAlign: 'left' }}>
          <thead>
            <tr>
              <th>#</th>
              <th>მომხმარებელი</th>
              <th>მედლები</th>
              <th>პროგრესი</th>
              <th>დრო</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, idx) => {
              const badges = JSON.parse(u.badges || '[]');
              const totalMins = u.total_time_ms ? Math.floor(u.total_time_ms / 60000) : 0;
              const totalSecs = u.total_time_ms ? Math.floor((u.total_time_ms % 60000) / 1000) : 0;
              return (
                <tr key={u.id}>
                  <td style={{ fontSize: '1.2rem', fontWeight: 'bold', color: idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? '#cd7f32' : 'var(--text-main)' }}>
                    {idx + 1}
                  </td>
                  <td style={{ fontSize: '1.1rem' }}>{u.username}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {badges.map((b, i) => <span key={i} title={b} style={{ fontSize: '1.5rem' }}>{b.split(' ')[0]}</span>)}
                    </div>
                  </td>
                  <td style={{ fontWeight: '500' }}>{u.completed_tasks} ეტაპი</td>
                  <td style={{ color: 'var(--primary)', fontWeight: 'bold' }}>
                    {u.total_time_ms ? `${totalMins}წთ ${totalSecs}წმ` : '---'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
