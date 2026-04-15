import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import localDb from '../storage/localDb';

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const adminToken = sessionStorage.getItem('adminLoggedIn');
    if (adminToken) {
      navigate('/admin/dashboard');
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const resp = await fetch('/api/admin-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await resp.json();
      
      if (data.success) {
        sessionStorage.setItem('adminLoggedIn', data.token);
        navigate('/admin/dashboard');
      } else {
        alert(data.error || 'არასწორი მონაცემები');
      }
    } catch (err) {
      console.error(err);
      alert('სერვერის შეცდომა შესვლისას');
    }
  };

  return (
    <div className="flex-center">
      <div className="glass-panel" style={{ width: '100%', maxWidth: '480px' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '2rem', color: 'var(--danger)' }}>Admin Panel</h2>
        <form onSubmit={handleLogin}>
          <input type="text" className="input-field" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
          <input type="password" className="input-field" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="submit" className="btn btn-danger" style={{ width: '100%' }}>Login</button>
        </form>
      </div>
    </div>
  );
}
