import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Game() {
  const [task, setTask] = useState(null);
  const [scenario, setScenario] = useState(null);
  const [status, setStatus] = useState('');
  const [timeLeft, setTimeLeft] = useState(null);
  const [flag, setFlag] = useState('');
  const [hintsUsed, setHintsUsed] = useState(0);
  const [totalHints, setTotalHints] = useState(0);
  const [unlockedHints, setUnlockedHints] = useState([]);
  const [message, setMessage] = useState('');
  const [successInfo, setSuccessInfo] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const userId = localStorage.getItem('userId');
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const scenarioId = searchParams.get('scenarioId');

  useEffect(() => {
    if (!userId || !scenarioId) {
      navigate('/roadmap');
      return;
    }
    syncGame();
  }, [userId, scenarioId]);

  const syncGame = async () => {
    try {
      const res = await fetch(`http://localhost:3001/api/sync/${scenarioId}/${userId}`);
      const data = await res.json();
      
      if (data.status === 'empty_scenario') {
        setStatus('empty_scenario');
        return;
      }
      if (data.status === 'completed_all') {
        setStatus('completed_all');
        return;
      }
      if (data.status === 'game_over' || data.task === undefined) {
        setStatus('game_over');
        return;
      }

      setTask(data.task);
      setScenario(data.scenario);
      setStatus(data.status);
      setHintsUsed(data.hintsUsed || 0);
      setTotalHints(data.totalHintsAvailable || 0);
      setUnlockedHints(data.unlockedHints || []);
      setMessage('');
      setFlag('');
      
      if (data.startedAt) {
        const timeLimitMs = data.task.time_limit * 60 * 1000;
        const endTime = data.startedAt + timeLimitMs;
        
        const updateTimer = () => {
          const now = Date.now();
          const diff = endTime - now;
          if (diff <= 0) {
            setTimeLeft(0);
            setStatus('game_over');
          } else {
            setTimeLeft(diff);
          }
        };
        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
      }
    } catch (err) {
      console.error(err);
      setMessage('სერვერთან კავშირი ვერ დამყარდა (Sync Failed)');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    navigate('/');
  };

  const handleRestart = async () => {
    await fetch('http://localhost:3001/api/restart-level', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, taskId: task?.id })
    });
    setSuccessInfo(null);
    syncGame();
  };

  const getNextHint = async () => {
    if (hintsUsed >= totalHints) return;
    
    const nextNum = hintsUsed + 1;
    if (window.confirm(`ყურადღება! მინიშნება ${nextNum}-ის გახსნა დაგაკარგვინებთ 30 ქულას. გსურთ გაგრძელება?`)) {
      const res = await fetch('http://localhost:3001/api/hint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, taskId: task?.id })
      });
      const data = await res.json();
      if (data.success) {
        setHintsUsed(data.hintsUsed);
        setTotalHints(data.totalHintsAvailable);
        setUnlockedHints(data.unlockedHints);
      } else if (data.error) {
        setMessage(data.error);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setMessage('');
    
    try {
      const res = await fetch('http://localhost:3001/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, scenarioId, flag })
      });
      
      const data = await res.json();
      
      if (res.status === 429) {
        setMessage(data.error || 'ზედმეტად ბევრი მცდელობა. გთხოვთ მოიცადოთ 60 წამი');
        setIsSubmitting(false);
        return;
      }

      if (!res.ok) {
        setMessage(data.error || 'სერვერზე მოხდა შეცდომა');
        setIsSubmitting(false);
        return;
      }

      if (data.timeout) {
        setStatus('game_over');
      } else if (data.correct) {
        setSuccessInfo({ points: data.points, newBadges: data.newBadges });
        setTimeout(() => {
          setSuccessInfo(null);
          syncGame();
        }, 3000);
      } else {
        setMessage('არასწორია (Flag Format: osint{name})');
      }
    } catch (err) {
      console.error(err);
      setMessage('სერვერთან კავშირი ვერ დამყარდა (Submit Failed)');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (ms) => {
    if (ms == null) return "00:00";
    const totalSecs = Math.floor(ms / 1000);
    const m = Math.floor(totalSecs / 60).toString().padStart(2, '0');
    const s = (totalSecs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (status === 'empty_scenario') {
    return (
      <div className="flex-center">
        <div className="glass-panel" style={{ textAlign: 'center' }}>
          <h2>ამ სცენარში დავალებები ჯერ არ არის</h2>
          <p>გთხოვთ, დაბრუნდეთ მოგვიანებით ან აირჩიოთ სხვა სცენარი.</p>
          <div style={{ marginTop: '2rem' }}>
            <button className="btn btn-primary" onClick={() => navigate('/roadmap')}>გზამკვლევში დაბრუნება</button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'completed_all') {
    return (
      <div className="flex-center">
        <div className="glass-panel" style={{ textAlign: 'center' }}>
          <h2>გილოცავთ!</h2>
          <p>თქვენ დაასრულეთ ეს სცენარი წარმატებით.</p>
          <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => navigate('/roadmap')}>გზამკვლევში დაბრუნება</button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'game_over') {
    return (
      <div className="flex-center">
        <div className="glass-panel" style={{ textAlign: 'center' }}>
          <h2 style={{ color: 'var(--danger)' }}>GAME OVER</h2>
          <p>დრო ამოიწურა ამ დავალებისთვის.</p>
          <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={handleRestart}>თავიდან დაწყება</button>
            <button className="btn btn-danger" onClick={() => navigate('/roadmap')}>გზამკვლევში დაბრუნება</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header-bar">
        <div>
          <h2 style={{ margin: 0 }}>მოთამაშე: {localStorage.getItem('username')}</h2>
          <p style={{ margin: 0 }}>ეტაპი {task?.level_number || 1}</p>
        </div>
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
          <div className="timer-text">{formatTime(timeLeft)}</div>
          <button className="btn btn-primary" onClick={() => navigate('/roadmap')}>გზამკვლევი</button>
          <button className="btn btn-danger" onClick={handleLogout}>გასვლა</button>
        </div>
      </div>

      {successInfo && (
        <div className="glass-panel" style={{ maxWidth: '800px', margin: '0 auto 2rem auto', textAlign: 'center', borderColor: 'var(--primary)', background: 'rgba(16, 185, 129, 0.1)' }}>
          <h2 style={{ color: 'var(--primary)' }}>ლოკაცია ნაპოვნია!</h2>
          <p style={{ fontSize: '1.2rem' }}>მოგებული ქულები: <strong>+{successInfo.points}</strong></p>
          {successInfo.newBadges && successInfo.newBadges.length > 0 && (
             <p style={{ marginTop: '1rem' }}>მიღებული ახალი მედლები: <br/> 
                {successInfo.newBadges.map(b => <span key={b} style={{ fontSize: '1.5rem', margin: '0 5px' }}>{b}</span>)}
             </p>
          )}
          <p style={{ marginTop: '1rem', opacity: 0.7 }}>გადავდივართ შემდეგ ეტაპზე...</p>
        </div>
      )}

      {task && !successInfo && (
        <div className="glass-panel" style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h3>{scenario?.description || 'სად არის გადაღებული ეს ფოტო?'}</h3>
          <div style={{ width: '100%', marginBottom: '1.5rem', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'center' }}>
            <img src={`http://localhost:3001${task.image_path}`} alt="OSINT Task" style={{ maxWidth: '100%', display: 'block', maxHeight: '500px' }} />
          </div>

          <form onSubmit={handleSubmit}>
            <input
              type="text"
              className="input-field"
              placeholder="პასუხი (მაგ: osint{tbilisi})"
              value={flag}
              onChange={(e) => setFlag(e.target.value)}
            />
            {message && <p style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{message}</p>}
            
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'space-between' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isSubmitting}>
                {isSubmitting ? 'იგზავნება...' : 'გაგზავნა'}
              </button>
              {totalHints > 0 && (
                <button 
                  type="button" 
                  className="btn glass-panel" 
                  style={{ padding: '0.75rem 1.5rem', border: '1px solid var(--glass-border)', color: hintsUsed >= totalHints ? 'var(--text-muted)' : 'var(--text-main)', cursor: hintsUsed >= totalHints ? 'not-allowed' : 'pointer', background: 'transparent' }}
                  onClick={getNextHint}
                  disabled={hintsUsed >= totalHints}
                >
                  {hintsUsed >= totalHints ? `მინიშნებები ამოწურულია (${hintsUsed}/${totalHints})` : `მინიშნება ${hintsUsed + 1}/${totalHints} (-30pt)`}
                </button>
              )}
            </div>
          </form>

          {unlockedHints.length > 0 && (
            <div style={{ marginTop: '1.5rem' }}>
              {unlockedHints.map((hint, idx) => (
                <div key={idx} style={{ marginTop: '0.5rem', padding: '0.75rem 1rem', background: 'rgba(56, 189, 248, 0.08)', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                  <strong style={{ color: '#38bdf8' }}>მინიშნება {idx + 1}:</strong> {hint}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
