import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import localDb from '../storage/localDb';

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('login'); // 'login' or 'setup'
  const [confirm, setConfirm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const admin = localDb.getAdmin();
    if (!admin) setMode('setup');
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    if (localDb.verifyAdmin(username, password)) {
      sessionStorage.setItem('adminLoggedIn', username);
      navigate('/admin/dashboard');
    } else {
      alert('არასწორი პაროლი ან მომხმარებელი');
    }
  };

  const handleSetup = (e) => {
    e.preventDefault();
    if (!username || !password) return alert('შეავსეთ ყველა ველი');
    if (password !== confirm) return alert('პაროლები არ ემთხვევა');
    localDb.setAdmin({ username, password });
    sessionStorage.setItem('adminLoggedIn', username);
    navigate('/admin/dashboard');
  };

  return (
    <div className="flex-center">
      <div className="glass-panel" style={{ width: '100%', maxWidth: '480px' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '2rem', color: 'var(--danger)' }}>Admin Panel</h2>
        {mode === 'setup' ? (
          <form onSubmit={handleSetup}>
            <p style={{ marginBottom: '1rem' }}>სისტემაში ჯერ არ არის ადმინისტრატორი. მიუთითეთ ახალი მომხმარებელი და პაროლი:</p>
            <input type="text" className="input-field" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
            <input type="password" className="input-field" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
            <input type="password" className="input-field" placeholder="Confirm Password" value={confirm} onChange={e => setConfirm(e.target.value)} />
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Create Admin</button>
          </form>
        ) : (
          <form onSubmit={handleLogin}>
            <input type="text" className="input-field" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
            <input type="password" className="input-field" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="submit" className="btn btn-danger" style={{ width: '100%' }}>Login</button>
          </form>
        )}
      </div>
    </div>
  );
}
