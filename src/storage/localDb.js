import { supabase } from '../lib/supabaseClient';
import defaultDb from '../data/defaultDb';
import ADMIN_SEED from './adminSeed';

const STORAGE_KEY = 'osint_app_db_v1';
const ADMIN_KEY = 'osint_app_admin_v1';

// Internal helper for local storage
function loadLocalRaw() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch (e) { /* fallthrough */ }
  }
  return JSON.parse(JSON.stringify(defaultDb));
}

function saveLocalRaw(db) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch (e) {
    console.error('Local Storage error:', e);
  }
}

export default {
  // Scenarios
  async getScenarios() {
    if (supabase) {
      const { data, error } = await supabase.from('scenarios').select('*').order('id', { ascending: true });
      if (!error) return data;
    }
    return loadLocalRaw().scenarios || [];
  },

  async getScenario(id) {
    if (supabase) {
      const { data, error } = await supabase.from('scenarios').select('*').eq('id', id).single();
      if (!error) return data;
    }
    return (loadLocalRaw().scenarios || []).find(s => s.id === Number(id));
  },

  async addScenario({ title, description }) {
    if (supabase) {
      const { data, error } = await supabase.from('scenarios').insert([{ title, description }]).select().single();
      if (!error) return data;
    }
    const db = loadLocalRaw();
    const id = (db.scenarios?.length > 0 ? Math.max(...db.scenarios.map(s => s.id)) : 0) + 1;
    const scen = { id, title, description };
    db.scenarios.push(scen);
    saveLocalRaw(db);
    return scen;
  },

  async deleteScenario(id) {
    if (supabase) {
      await supabase.from('scenarios').delete().eq('id', id);
      return;
    }
    const db = loadLocalRaw();
    db.scenarios = (db.scenarios || []).filter(s => s.id !== Number(id));
    db.tasks = (db.tasks || []).filter(t => t.scenario_id !== Number(id));
    saveLocalRaw(db);
  },

  // Tasks
  async getTasks(scenarioId) {
    if (supabase) {
      const { data, error } = await supabase.from('tasks').select('*').eq('scenario_id', scenarioId).order('level_number', { ascending: true });
      if (!error) return data;
    }
    return (loadLocalRaw().tasks || []).filter(t => t.scenario_id === Number(scenarioId)).sort((a,b)=>a.level_number-b.level_number);
  },

  async getAllTasks() {
    if (supabase) {
      const { data, error } = await supabase.from('tasks').select('*');
      if (!error) return data;
    }
    return loadLocalRaw().tasks || [];
  },

  async addTask({ scenario_id, level_number, flag, time_limit, hints, image_path }) {
    const taskObj = {
      scenario_id: Number(scenario_id),
      level_number: Number(level_number),
      image_path: image_path || '/uploads/default.svg',
      flag: flag || '',
      time_limit: Number(time_limit) || 20,
      hints: Array.isArray(hints) ? hints : (hints ? JSON.parse(hints) : [])
    };

    if (supabase) {
      const { data, error } = await supabase.from('tasks').insert([taskObj]).select().single();
      if (!error) return data;
      console.error('Supabase addTask error:', error);
    }

    const db = loadLocalRaw();
    const id = (db.tasks?.length > 0 ? Math.max(...db.tasks.map(t => t.id)) : 0) + 1;
    const task = { id, ...taskObj };
    db.tasks.push(task);
    saveLocalRaw(db);
    return task;
  },

  async deleteTask(id) {
    if (supabase) {
      await supabase.from('tasks').delete().eq('id', id);
      return;
    }
    const db = loadLocalRaw();
    db.tasks = (db.tasks || []).filter(t => t.id !== Number(id));
    saveLocalRaw(db);
  },

  // Stats
  async logResult({ username, scenario_id, points, time_spent_ms }) {
    if (supabase) {
      const { error } = await supabase.from('user_stats').insert([{
        username,
        scenario_id: Number(scenario_id),
        points: Number(points),
        time_spent_ms: Number(time_spent_ms)
      }]);
      if (error) console.error('Supabase logResult error:', error);
    }
    // Local fallback for stats
    const raw = localStorage.getItem('osint_app_stats_v1') || '[]';
    const stats = JSON.parse(raw);
    stats.push({ username, scenario_id, points, time_spent_ms, completed_at: new Date().toISOString() });
    localStorage.setItem('osint_app_stats_v1', JSON.stringify(stats));
  },

  async getUserStats() {
    if (supabase) {
      const { data, error } = await supabase.from('user_stats').select('*, scenarios(title)');
      if (!error) return data;
    }
    const raw = localStorage.getItem('osint_app_stats_v1') || '[]';
    return JSON.parse(raw);
  },

  // Admin (Keep Local for simplicity or expand later)
  getAdmin() {
    const raw = localStorage.getItem(ADMIN_KEY);
    if (raw) return JSON.parse(raw);
    localStorage.setItem(ADMIN_KEY, JSON.stringify(ADMIN_SEED));
    return ADMIN_SEED;
  },

  async verifyAdmin(username, password) {
    // This still uses the Vercel API we built earlier for real security
    const resp = await fetch('/api/admin-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    return await resp.json();
  },

  async syncToSupabase() {
    if (!supabase) return { message: 'Supabase არ არის დაკავშირებული' };
    
    const local = loadLocalRaw();
    const statsRaw = localStorage.getItem('osint_app_stats_v1') || '[]';
    const localStats = JSON.parse(statsRaw);

    // 1. Sync Scenarios
    if (local.scenarios?.length > 0) {
      await supabase.from('scenarios').upsert(local.scenarios);
    }

    // 2. Sync Tasks
    if (local.tasks?.length > 0) {
      // Ensure hints are JSON compatible
      const formattedTasks = local.tasks.map(t => ({
        ...t,
        hints: Array.isArray(t.hints) ? t.hints : []
      }));
      await supabase.from('tasks').upsert(formattedTasks);
    }

    // 3. Sync Stats
    if (localStats.length > 0) {
      const statsToUpload = localStats.map(s => ({
        username: s.username,
        scenario_id: s.scenario_id,
        points: s.points,
        time_spent_ms: s.time_spent_ms,
        completed_at: s.completed_at
      }));
      await supabase.from('user_stats').insert(statsToUpload);
    }

    return { message: 'მონაცემები წარმატებით აიტვირთა ონლაინ ბაზაში!' };
  },

  async clearAllData() {
    if (supabase) {
      // Deleting user results
      await supabase.from('user_stats').delete().neq('id', 0);
      // Deleting scenarios (will cascade to tasks if schema is set)
      const { error } = await supabase.from('scenarios').delete().neq('id', 0);
      if (error) {
        // Fallback for tasks if cascade is not enabled
        await supabase.from('tasks').delete().neq('id', 0);
        await supabase.from('scenarios').delete().neq('id', 0);
      }
    }
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('osint_app_stats_v1');
    return { success: true };
  }
};



