import defaultDb from '../data/defaultDb';

const STORAGE_KEY = 'osint_app_db_v1';
const ADMIN_KEY = 'osint_app_admin_v1';

function loadRaw() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch (e) { /* fallthrough */ }
  }
  const seed = JSON.parse(JSON.stringify(defaultDb));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  return seed;
}

function saveRaw(db) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function getNextId(arr) {
  if (!arr || arr.length === 0) return 1;
  return Math.max(...arr.map(x => x.id || 0)) + 1;
}

export default {
  // Scenarios
  getScenarios() {
    const db = loadRaw();
    return db.scenarios || [];
  },
  getScenario(id) {
    const db = loadRaw();
    return (db.scenarios || []).find(s => s.id === Number(id));
  },
  addScenario({ title, description }) {
    const db = loadRaw();
    const id = getNextId(db.scenarios);
    const scen = { id, title, description };
    db.scenarios.push(scen);
    saveRaw(db);
    return scen;
  },
  updateScenario(id, { title, description }) {
    const db = loadRaw();
    const i = db.scenarios.findIndex(s => s.id === Number(id));
    if (i === -1) return null;
    db.scenarios[i] = { ...db.scenarios[i], title, description };
    saveRaw(db);
    return db.scenarios[i];
  },
  deleteScenario(id) {
    const db = loadRaw();
    db.scenarios = (db.scenarios || []).filter(s => s.id !== Number(id));
    db.tasks = (db.tasks || []).filter(t => t.scenario_id !== Number(id));
    saveRaw(db);
  },

  // Tasks
  getTasks(scenarioId) {
    const db = loadRaw();
    return (db.tasks || []).filter(t => t.scenario_id === Number(scenarioId)).sort((a,b)=>a.level_number-b.level_number);
  },
  getAllTasks() {
    const db = loadRaw();
    return db.tasks || [];
  },
  getTask(id) {
    const db = loadRaw();
    return (db.tasks || []).find(t => t.id === Number(id));
  },
  addTask({ scenario_id, level_number, flag, time_limit, hints, image_path }) {
    const db = loadRaw();
    const id = getNextId(db.tasks);
    const task = {
      id,
      scenario_id: Number(scenario_id),
      level_number: Number(level_number),
      image_path: image_path || '/uploads/default.svg',
      flag: flag || '',
      time_limit: Number(time_limit) || 20,
      hints: Array.isArray(hints) ? hints : (hints ? JSON.parse(hints) : [])
    };
    db.tasks.push(task);
    saveRaw(db);
    return task;
  },
  updateTask(id, { level_number, flag, time_limit, hints, image_path }) {
    const db = loadRaw();
    const i = db.tasks.findIndex(t => t.id === Number(id));
    if (i === -1) return null;
    db.tasks[i] = {
      ...db.tasks[i],
      level_number: level_number !== undefined ? Number(level_number) : db.tasks[i].level_number,
      flag: flag !== undefined ? flag : db.tasks[i].flag,
      time_limit: time_limit !== undefined ? Number(time_limit) : db.tasks[i].time_limit,
      hints: hints !== undefined ? (Array.isArray(hints) ? hints : JSON.parse(hints || '[]')) : db.tasks[i].hints,
      image_path: image_path !== undefined ? image_path : db.tasks[i].image_path
    };
    saveRaw(db);
    return db.tasks[i];
  },
  deleteTask(id) {
    const db = loadRaw();
    db.tasks = (db.tasks || []).filter(t => t.id !== Number(id));
    saveRaw(db);
  },

  // Admin
  getAdmin() {
    try { return JSON.parse(localStorage.getItem(ADMIN_KEY)); } catch (e) { return null; }
  },
  setAdmin({ username, password }) {
    const admin = { username, password };
    localStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
    return admin;
  },
  verifyAdmin(username, password) {
    const admin = this.getAdmin();
    if (!admin) return false;
    return admin.username === username && admin.password === password;
  },

  // Utilities
  resetToDefault() {
    const seed = JSON.parse(JSON.stringify(defaultDb));
    saveRaw(seed);
  }
};
