import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import localDb from '../storage/localDb';

export default function Leaderboard() {
  const [users, setUsers] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const rawStats = await localDb.getUserStats();
      // Aggregate by username
      const userAggregates = {};
      rawStats.forEach(entry => {
        if (!userAggregates[entry.username]) {
          userAggregates[entry.username] = { username: entry.username, total_points: 0, total_time_ms: 0, completed_tasks: 0 };
        }
        userAggregates[entry.username].total_points += (entry.points || 0);
        userAggregates[entry.username].total_time_ms += (entry.time_spent_ms || 0);
        userAggregates[entry.username].completed_tasks += 1;
      });

      // Sort: Most points first, then least time
      const sorted = Object.values(userAggregates).sort((a, b) => {
        if (b.total_points !== a.total_points) return b.total_points - a.total_points;
        return a.total_time_ms - b.total_time_ms;
      });

      setUsers(sorted);
    })();
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
              <th>მონაწილე</th>
              <th>ეტაპები</th>
              <th>ქულები</th>
              <th>დრო</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, idx) => {

              const totalMins = u.total_time_ms ? Math.floor(u.total_time_ms / 60000) : 0;
              const totalSecs = u.total_time_ms ? Math.floor((u.total_time_ms % 60000) / 1000) : 0;
              return (
                <tr key={idx}>
                  <td style={{ fontSize: '1.2rem', fontWeight: 'bold', color: idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? '#cd7f32' : 'var(--text-main)' }}>
                    {idx + 1}
                  </td>
                  <td style={{ fontSize: '1.1rem' }}>{u.username}</td>

                  <td style={{ fontWeight: '500' }}>{u.completed_tasks}</td>
                  <td style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{u.total_points} PT</td>
                  <td style={{ opacity: 0.8 }}>
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
