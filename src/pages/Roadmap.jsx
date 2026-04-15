import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import localDb from '../storage/localDb';

export default function Roadmap() {
  const [scenarios, setScenarios] = useState([]);
  const [userData, setUserData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const userId = sessionStorage.getItem('userId');
    if (!userId) {
      navigate('/');
      return;
    }
    // Load profile from session (ephemeral)
    const username = sessionStorage.getItem('username');
    setUserData({ id: userId, username, points: 0 });

    // Load scenarios from Supabase/Local
    (async () => {
      const data = await localDb.getScenarios();
      setScenarios(data || []);
    })();
  }, [navigate]);

  const handleStart = (scenarioId) => {
    navigate(`/game?scenarioId=${scenarioId}`);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('userId');
    sessionStorage.removeItem('username');
    navigate('/');
  };



  return (
    <div className="container">
      <div className="header-bar">
        <div>
          <h2 style={{ margin: 0 }}>OSINT-L: გზამკვლევი</h2>
          {userData && (
            <div style={{ marginTop: '0.5rem', color: 'var(--primary)' }}>
              <strong>Points: {userData.points}</strong>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn-primary" onClick={() => navigate('/leaderboard')}>🏆 ლიდერბორდი</button>
          <button className="btn btn-danger" onClick={handleLogout}>გასვლა</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '2rem' }}>
        {scenarios.map(sc => (
          <div key={sc.id} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'var(--primary)' }} />
            <h3 style={{ color: 'var(--primary)', marginTop: '1rem' }}>{sc.title}</h3>
            <p style={{ flex: 1, marginBottom: '1.5rem' }}>{sc.description}</p>
            <button className="btn btn-primary" onClick={() => handleStart(sc.id)}>მისიის დაწყება</button>
          </div>
        ))}
        {scenarios.length === 0 && <p>სცენარები ჯერ არ დამატებულა.</p>}
      </div>
    </div>
  );
}
