import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiUrl } from '../apiBase';

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const url = apiUrl(isRegister ? '/api/register' : '/api/login');
    const body = isRegister ? { username, email, password } : { username, password };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      
      if (!res.ok) {
        setErrorMsg(data.error || 'მოხდა შეცდომა');
        return;
      }

      if (data.user) {
        localStorage.setItem('userId', data.user.id);
        localStorage.setItem('username', data.user.username);
        navigate('/roadmap');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('სერვერთან კავშირი დაიკარგა');
    }
  };

  return (
    <div className="flex-center">
      <div className="glass-panel" style={{ width: '100%', maxWidth: '400px' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '2rem', color: '#ffffff', fontSize: '3rem', fontWeight: '800', letterSpacing: '4px', textShadow: '0 0 20px rgba(255,255,255,0.2)' }}>OSINT-L</h1>
        
        {errorMsg && <div style={{ color: 'var(--danger)', marginBottom: '1rem', textAlign: 'center' }}>{errorMsg}</div>}

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <button 
            type="button" 
            className={`btn ${!isRegister ? 'btn-primary' : 'glass-panel'}`} 
            style={{ flex: 1, padding: '0.5rem', border: !isRegister ? 'none' : '1px solid var(--glass-border)' }}
            onClick={() => setIsRegister(false)}>
            შესვლა
          </button>
          <button 
            type="button" 
            className={`btn ${isRegister ? 'btn-primary' : 'glass-panel'}`} 
            style={{ flex: 1, padding: '0.5rem', border: isRegister ? 'none' : '1px solid var(--glass-border)' }}
            onClick={() => setIsRegister(true)}>
            რეგისტრაცია
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            className="input-field"
            placeholder="Username (მომხმარებელი)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          {isRegister && (
            <input
              type="email"
              className="input-field"
              placeholder="Email (ელ-ფოსტა)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          )}
          <input
            type="password"
            className="input-field"
            placeholder="Password (პაროლი)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
            {isRegister ? 'რეგისტრაცია და დაწყება' : 'თამაშის დაწყება'}
          </button>
        </form>
      </div>
    </div>
  );
}
