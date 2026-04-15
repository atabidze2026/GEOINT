import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiUrl } from '../apiBase';

export default function AdminDashboard() {
  const [stats, setStats] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [scenarios, setScenarios] = useState([]);
  
  const [newScenario, setNewScenario] = useState({ title: '', description: '' });
  const [newTask, setNewTask] = useState({ scenario_id: '', level_number: '', flag: '', time_limit: '', hints: ['', '', '', '', ''] });
  const [imageFile, setImageFile] = useState(null);
  
  // For Editing Tasks
  const [editingTask, setEditingTask] = useState(null);
  const [editImageFile, setEditImageFile] = useState(null);

  // For Editing Scenarios
  const [editingScenario, setEditingScenario] = useState(null);

  const token = localStorage.getItem('adminToken');
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      navigate('/admin');
      return;
    }
    fetchData();
  }, [token]);

  const fetchData = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const [statsRes, tasksRes, scRes] = await Promise.all([
        fetch(apiUrl('/api/admin/stats'), { headers }),
        fetch(apiUrl('/api/admin/tasks'), { headers }),
        fetch(apiUrl('/api/scenarios'))
      ]);
      
      if (statsRes.status === 401) {
        navigate('/admin');
        return;
      }

      setStats(await statsRes.json());
      setTasks(await tasksRes.json());
      setScenarios(await scRes.json());
    } catch (err) {
      console.error(err);
    }
  };

  // === Scenario Handlers ===
  const handleCreateScenario = async (e) => {
    e.preventDefault();
    await fetch(apiUrl('/api/admin/scenarios'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(newScenario)
    });
    setNewScenario({ title: '', description: '' });
    fetchData();
  };

  const handleEditScenarioSubmit = async (e) => {
    e.preventDefault();
    await fetch(apiUrl(`/api/admin/scenarios/${editingScenario.id}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ title: editingScenario.title, description: editingScenario.description })
    });
    setEditingScenario(null);
    fetchData();
  };

  const handleDeleteScenario = async (id) => {
    if (window.confirm("ნამდვილად წავშალოთ სცენარი და მისი ყველა დავალება?")) {
      const res = await fetch(apiUrl(`/api/admin/scenarios/${id}`), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json();
        alert('შეცდომა: ' + (data.error || 'Unknown error'));
      }
      fetchData();
    }
  };

  // === Task Handlers ===
  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!imageFile) {
      alert("გთხოვთ ატვირთოთ სურათი");
      return;
    }
    // Filter out empty hints
    const filteredHints = newTask.hints.filter(h => h.trim() !== '');

    const formData = new FormData();
    formData.append('scenario_id', newTask.scenario_id);
    formData.append('level_number', newTask.level_number);
    formData.append('flag', newTask.flag);
    formData.append('time_limit', newTask.time_limit);
    formData.append('hints', JSON.stringify(filteredHints));
    formData.append('image', imageFile);

    const res = await fetch(apiUrl('/api/admin/tasks'), {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    if (!res.ok) {
      const data = await res.json();
      alert('შეცდომა: ' + (data.error || 'Unknown error'));
    }
    setNewTask({ scenario_id: newTask.scenario_id, level_number: '', flag: '', time_limit: '', hints: ['', '', '', '', ''] });
    setImageFile(null);
    fetchData();
  };

  const startEditTask = (t) => {
    let parsedHints = [];
    try { parsedHints = JSON.parse(t.hints || '[]'); } catch(e) { parsedHints = []; }
    // Pad to 5 slots
    while (parsedHints.length < 5) parsedHints.push('');
    setEditingTask({ ...t, hintsArray: parsedHints });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const filteredHints = editingTask.hintsArray.filter(h => h.trim() !== '');

    const formData = new FormData();
    formData.append('level_number', editingTask.level_number);
    formData.append('flag', editingTask.flag);
    formData.append('time_limit', editingTask.time_limit);
    formData.append('hints', JSON.stringify(filteredHints));
    if (editImageFile) formData.append('image', editImageFile);

    const res = await fetch(apiUrl(`/api/admin/tasks/${editingTask.id}`), {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    if (!res.ok) {
      const data = await res.json();
      alert('შეცდომა: ' + (data.error || 'Unknown error'));
    }
    setEditingTask(null);
    setEditImageFile(null);
    fetchData();
  };

  const handleDeleteTask = async (id) => {
    if (window.confirm("ნამდვილად წავშალოთ ეს დავალება?")) {
      const res = await fetch(apiUrl(`/api/admin/tasks/${id}`), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json();
        alert('შეცდომა: ' + (data.error || 'Unknown error'));
      }
      fetchData();
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    navigate('/admin');
  };

  // Helper for updating hint at index
  const updateNewHint = (idx, val) => {
    const copy = [...newTask.hints];
    copy[idx] = val;
    setNewTask({ ...newTask, hints: copy });
  };

  const updateEditHint = (idx, val) => {
    const copy = [...editingTask.hintsArray];
    copy[idx] = val;
    setEditingTask({ ...editingTask, hintsArray: copy });
  };

  const getHintCount = (hintsJson) => {
    try {
      return JSON.parse(hintsJson || '[]').filter(h => h.trim() !== '').length;
    } catch(e) { return 0; }
  };

  return (
    <div className="container" style={{ maxWidth: '1400px' }}>
      <div className="header-bar">
        <h2>Admin Dashboard</h2>
        <button className="btn btn-danger" onClick={handleLogout}>გასვლა</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        
        {/* Users Stats */}
        <div className="glass-panel" style={{ gridColumn: '1 / -1' }}>
          <h3>რეგისტრირებული მოთამაშეები</h3>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>ქულა</th>
                  <th>გავლილი ეტაპები</th>
                  <th>დრო (წთ)</th>
                  <th>სცენარების პროგრესი</th>
                </tr>
              </thead>
              <tbody>
                {stats.map(user => (
                  <tr key={user.id}>
                    <td>{user.id}</td>
                    <td>{user.username}</td>
                    <td>{user.email}</td>
                    <td style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{user.points} PT</td>
                    <td>{user.completedTasks}</td>
                    <td>{user.totalTimeSpent}</td>
                    <td>
                      {user.scenariosInfo.map((s, idx) => (
                         <div key={idx} style={{ fontSize: '0.85rem' }}>{s.title}: (დონე {s.current_level})</div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Scenarios Management */}
        <div className="glass-panel">
          <h3>სცენარების მართვა</h3>
          <form onSubmit={handleCreateScenario} style={{ marginBottom: '2rem' }}>
            <input type="text" className="input-field" placeholder="სცენარის სათაური" required value={newScenario.title} onChange={e => setNewScenario({ ...newScenario, title: e.target.value })} />
            <input type="text" className="input-field" placeholder="მოკლე აღწერა" required value={newScenario.description} onChange={e => setNewScenario({ ...newScenario, description: e.target.value })} />
            <button type="submit" className="btn btn-primary">სცენარის დამატება</button>
          </form>

          {editingScenario && (
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem' }}>
              <h4 style={{ color: 'var(--primary)' }}>სცენარის რედაქტირება (ID: {editingScenario.id})</h4>
              <form onSubmit={handleEditScenarioSubmit}>
                <input type="text" className="input-field" placeholder="სათაური" required value={editingScenario.title} onChange={e => setEditingScenario({ ...editingScenario, title: e.target.value })} />
                <input type="text" className="input-field" placeholder="აღწერა" required value={editingScenario.description} onChange={e => setEditingScenario({ ...editingScenario, description: e.target.value })} />
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button type="submit" className="btn btn-primary">შენახვა</button>
                  <button type="button" className="btn btn-danger" onClick={() => setEditingScenario(null)}>გაუქმება</button>
                </div>
              </form>
            </div>
          )}

          <table>
            <thead>
              <tr><th>ID</th><th>სათაური</th><th>მოქმედება</th></tr>
            </thead>
            <tbody>
              {scenarios.map(sc => (
                <tr key={sc.id}>
                  <td>{sc.id}</td>
                  <td>{sc.title}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-primary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} onClick={() => setEditingScenario(sc)}>რედაქტირება</button>
                      <button className="btn btn-danger" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} onClick={() => handleDeleteScenario(sc.id)}>წაშლა</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add New Task */}
        <div className="glass-panel">
          <h3>ახალი დავალების დამატება</h3>
          <form onSubmit={handleCreateTask}>
            <select className="input-field" value={newTask.scenario_id} onChange={e => setNewTask({ ...newTask, scenario_id: e.target.value })} required>
              <option value="">-- აირჩიეთ სცენარი --</option>
              {scenarios.map(sc => <option key={sc.id} value={sc.id}>{sc.title}</option>)}
            </select>
            <input type="number" className="input-field" placeholder="დონის ნომერი (მაგ: 1)" required value={newTask.level_number} onChange={e => setNewTask({ ...newTask, level_number: e.target.value })} />
            <input type="file" className="input-field" accept="image/*" required onChange={e => setImageFile(e.target.files[0])} />
            <input type="text" className="input-field" placeholder="Flag (მაგ: osint{paris})" required value={newTask.flag} onChange={e => setNewTask({ ...newTask, flag: e.target.value })} />
            <input type="number" className="input-field" placeholder="დროის ლიმიტი (წუთებში)" required value={newTask.time_limit} onChange={e => setNewTask({ ...newTask, time_limit: e.target.value })} />
            
            <p style={{ color: 'var(--primary)', marginTop: '1rem', marginBottom: '0.5rem', fontSize: '0.9rem' }}>მინიშნებები (არასავალდებულო, მაქს. 5):</p>
            {newTask.hints.map((h, idx) => (
              <input key={idx} type="text" className="input-field" placeholder={`მინიშნება ${idx + 1}`} value={h} onChange={e => updateNewHint(idx, e.target.value)} />
            ))}

            <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>დამატება</button>
          </form>
        </div>

        {/* List & Edit Tasks */}
        <div className="glass-panel" style={{ gridColumn: '1 / -1' }}>
          <h3>არსებული დავალებები</h3>
          
          {editingTask && (
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem' }}>
              <h4 style={{ color: 'var(--primary)' }}>ამოცანის რედაქტირება (ID: {editingTask.id})</h4>
              <form onSubmit={handleEditSubmit}>
                <input type="number" className="input-field" placeholder="დონე" value={editingTask.level_number} onChange={e => setEditingTask({ ...editingTask, level_number: e.target.value })} />
                <p>ძველი სურათი: {editingTask.image_path} (ახალი ასატვირთად)</p>
                <input type="file" className="input-field" accept="image/*" onChange={e => setEditImageFile(e.target.files[0])} />
                <input type="text" className="input-field" placeholder="Flag" value={editingTask.flag} onChange={e => setEditingTask({ ...editingTask, flag: e.target.value })} />
                <input type="number" className="input-field" placeholder="დრო (წთ)" value={editingTask.time_limit} onChange={e => setEditingTask({ ...editingTask, time_limit: e.target.value })} />
                
                <p style={{ color: 'var(--primary)', marginTop: '1rem', marginBottom: '0.5rem', fontSize: '0.9rem' }}>მინიშნებები (არასავალდებულო, მაქს. 5):</p>
                {editingTask.hintsArray.map((h, idx) => (
                  <input key={idx} type="text" className="input-field" placeholder={`მინიშნება ${idx + 1}`} value={h} onChange={e => updateEditHint(idx, e.target.value)} />
                ))}

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <button type="submit" className="btn btn-primary">შენახვა</button>
                  <button type="button" className="btn btn-danger" onClick={() => { setEditingTask(null); setEditImageFile(null); }}>გაუქმება</button>
                </div>
              </form>
            </div>
          )}

          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>სცენარი</th>
                  <th>Lvl</th>
                  <th>სურათი</th>
                  <th>Flag</th>
                  <th>დრო</th>
                  <th>მინიშნებები</th>
                  <th style={{ width: '200px' }}>მოქმედება</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map(t => (
                  <tr key={t.id}>
                    <td>{t.scenario_title}</td>
                    <td>{t.level_number}</td>
                    <td><img src={apiUrl(t.image_path)} alt="task" width="50" style={{ borderRadius: '4px' }} /></td>
                    <td>{t.flag}</td>
                    <td>{t.time_limit}წთ</td>
                    <td>{getHintCount(t.hints)} ცალი</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-primary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} onClick={() => startEditTask(t)}>რედაქტირება</button>
                        <button className="btn btn-danger" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} onClick={() => handleDeleteTask(t.id)}>წაშლა</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
