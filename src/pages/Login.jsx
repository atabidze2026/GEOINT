import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function generateId() {
  return `guest_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

export default function Login() {
  const [username, setUsername] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!username.trim()) return;
    const id = generateId();
    sessionStorage.setItem('userId', id);
    sessionStorage.setItem('username', username.trim());
    navigate('/roadmap');
  };

  return (
    <div className="flex-center">
      <div className="glass-panel" style={{ width: '100%', maxWidth: '400px' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '2rem', color: '#ffffff', fontSize: '3rem', fontWeight: '800', letterSpacing: '4px', textShadow: '0 0 20px rgba(255,255,255,0.2)' }}>OSINT-L</h1>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            className="input-field"
            placeholder="Username (მომხმარებელი)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
            დაწყება
          </button>
        </form>
      </div>
    </div>
  );
}
