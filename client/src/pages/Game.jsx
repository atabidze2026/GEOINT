import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import localDb from '../storage/localDb';

// Helper for ephemeral progress stored in sessionStorage
const getProgressKey = (userId, scenarioId) => `progress_${userId}_${scenarioId}`;

function loadProgress(userId, scenarioId) {
  const key = getProgressKey(userId, scenarioId);
  const raw = sessionStorage.getItem(key);
  if (raw) return JSON.parse(raw);
  return null;
}

function saveProgress(userId, scenarioId, progress) {
  const key = getProgressKey(userId, scenarioId);
  sessionStorage.setItem(key, JSON.stringify(progress));
}


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
  
  const userId = sessionStorage.getItem('userId');
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const scenarioId = searchParams.get('scenarioId');
  useEffect(() => {
    if (!userId || !scenarioId) {
      navigate('/roadmap');
      return;
    }
    syncLocalGame();
  }, [userId, scenarioId]);

  const syncLocalGame = () => {
    const scenId = Number(scenarioId);
    const scen = localDb.getScenario(scenId);
    if (!scen) {
      setStatus('empty_scenario');
      return;
    }

    const tasks = localDb.getTasks(scenId);
    if (tasks.length === 0) {
      setStatus('empty_scenario');
      return;
    }

    let progress = loadProgress(userId, scenId);
    if (!progress) {
      progress = { userId, scenarioId: scenId, current_level: 1, user_progress: {} };
    }

    // Ensure current level exists
    const currentTask = tasks.find(t => t.level_number === progress.current_level);
    if (!currentTask) {
      setStatus('completed_all');
      return;
    }

    if (!progress.user_progress[currentTask.id]) {
      progress.user_progress[currentTask.id] = { status: 'in_progress', started_at: Date.now(), hints_used: 0 };
      saveProgress(userId, scenId, progress);
    }

    const pEntry = progress.user_progress[currentTask.id];

    setTask(currentTask);
    setScenario(scen);
    setStatus(pEntry.status || 'in_progress');
    setHintsUsed(pEntry.hints_used || 0);
    setTotalHints(currentTask.hints.length || 0);
    setUnlockedHints((currentTask.hints || []).slice(0, pEntry.hints_used || 0));
    setMessage('');
    setFlag('');

    // Timer
    if (pEntry.started_at) {
      const timeLimitMs = (currentTask.time_limit || 20) * 60 * 1000;
      const endTime = pEntry.started_at + timeLimitMs;
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
  };

  const handleLogout = () => {
    sessionStorage.removeItem('userId');
    sessionStorage.removeItem('username');
    navigate('/');
  };

  const handleRestart = () => {
    if (!task) return;
    const scenId = Number(scenarioId);
    const progress = loadProgress(userId, scenId) || { userId, scenarioId: scenId, current_level: 1, user_progress: {} };
    progress.user_progress[task.id] = { status: 'in_progress', started_at: Date.now(), hints_used: 0 };
    saveProgress(userId, scenId, progress);
    setSuccessInfo(null);
    syncLocalGame();
  };

  const getNextHint = () => {
    if (!task) return;
    if (hintsUsed >= totalHints) return;
    const nextNum = hintsUsed + 1;
    if (!window.confirm(`ყურადღება! მინიშნება ${nextNum}-ის გახსნა დაგაკარგვინებთ 30 ქულას. გსურთ გაგრძელება?`)) return;
    const scenId = Number(scenarioId);
    const progress = loadProgress(userId, scenId);
    if (!progress) return;
    const entry = progress.user_progress[task.id] || { status: 'in_progress', started_at: Date.now(), hints_used: 0 };
    entry.hints_used = (entry.hints_used || 0) + 1;
    progress.user_progress[task.id] = entry;
    saveProgress(userId, scenId, progress);
    setHintsUsed(entry.hints_used);
    setUnlockedHints((task.hints || []).slice(0, entry.hints_used));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isSubmitting || !task) return;
    setIsSubmitting(true);
    setMessage('');

    const scenId = Number(scenarioId);
    const progress = loadProgress(userId, scenId);
    if (!progress) {
      setMessage('პროგრესი არ არის დაარეგისტრირებული');
      setIsSubmitting(false);
      return;
    }

    const entry = progress.user_progress[task.id];
    if (!entry || entry.status !== 'in_progress') {
      setMessage('დავალება არ არის გააქტიურებული (მიაკითეთ გვერდი)');
      setIsSubmitting(false);
      return;
    }

    const now = Date.now();
    const elapsedMinutes = (now - entry.started_at) / 1000 / 60;
    if (elapsedMinutes > (task.time_limit || 0)) {
      entry.status = 'timeout';
      progress.user_progress[task.id] = entry;
      saveProgress(userId, scenId, progress);
      setStatus('game_over');
      setIsSubmitting(false);
      return;
    }

    const submittedFlag = (flag || '').trim().toLowerCase();
    const dbFlag = (task.flag || '').trim().toLowerCase();
    if (dbFlag === submittedFlag) {
      // success
      entry.status = 'completed';
      entry.completed_at = now;
      progress.user_progress[task.id] = entry;

      // Points calculation
      const hints = entry.hints_used || 0;
      let earnedPoints = 100 - Math.floor((elapsedMinutes || 0) * 2) - (hints * 30);
      if (isNaN(earnedPoints) || earnedPoints < 10) earnedPoints = 10;

      // badges
      const newBadges = [];
      if (elapsedMinutes < 2 && !newBadges.includes('⚡ Speedrunner')) newBadges.push('⚡ Speedrunner');
      if (hints === 0 && !newBadges.includes('🕵️ Ghost')) newBadges.push('🕵️ Ghost');

      // advance level
      progress.current_level = (progress.current_level || 1) + 1;
      // If next level exists, create in_progress entry
      const nextTask = db.tasks.find(t => t.scenario_id === scenId && t.level_number === progress.current_level);
      if (nextTask) {
        progress.user_progress[nextTask.id] = { status: 'in_progress', started_at: Date.now(), hints_used: 0 };
      }

      saveProgress(userId, scenId, progress);

      setSuccessInfo({ points: earnedPoints, newBadges });
      setTimeout(() => {
        setSuccessInfo(null);
        syncLocalGame();
      }, 1500);
    } else {
      setMessage('არასწორია (Flag Format: osint{name})');
    }

    setIsSubmitting(false);
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
            <h2 style={{ margin: 0 }}>მოთამაშე: {sessionStorage.getItem('username')}</h2>
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
            <img src={task.image_path} alt="OSINT Task" style={{ maxWidth: '100%', display: 'block', maxHeight: '500px' }} />
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
