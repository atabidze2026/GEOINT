import defaultDb from '../data/defaultDb';
import ADMIN_SEED from './adminSeed';

const STORAGE_KEY = 'osint_app_db_v1';
const ADMIN_KEY = 'osint_app_admin_v1';

// Compute SHA-256 hex digest. Uses Web Crypto API in browser, falls back to
// Node's crypto if available (only executed at runtime when needed).
async function hashSha256Hex(str) {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const enc = new TextEncoder();
    const data = enc.encode(str);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Node fallback
  try {
    // require only at runtime
    // eslint-disable-next-line global-require
    const { createHash } = require('crypto');
    return createHash('sha256').update(str, 'utf8').digest('hex');
  } catch (e) {
    // Last-resort (non-crypto) fallback — should not be used in real deployments
    let h = 0;
    for (let i = 0; i < str.length; i++) h = Math.imul(31, h) + str.charCodeAt(i) | 0;
    return (h >>> 0).toString(16).padStart(64, '0');
  }
}

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
    try {
      const raw = localStorage.getItem(ADMIN_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }

    // If no admin present, seed initial admin (synchronously using the
    // precomputed hash in `adminSeed.js`). This avoids needing to prompt for
    // setup on first load and makes the seeded credentials available.
    try {
      localStorage.setItem(ADMIN_KEY, JSON.stringify(ADMIN_SEED));
      return ADMIN_SEED;
    } catch (e) {
      return null;
    }
  },
  async setAdmin({ username, password }) {
    const passwordHash = await hashSha256Hex(password);
    const admin = { username, passwordHash };
    localStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
    return admin;
  },
  async verifyAdmin(username, password) {
    const admin = this.getAdmin();
    if (!admin) return false;
    const passwordHash = await hashSha256Hex(password);
    return admin.username === username && admin.passwordHash === passwordHash;
  },

  // Utilities
  resetToDefault() {
    const seed = JSON.parse(JSON.stringify(defaultDb));
    saveRaw(seed);
  }
};
