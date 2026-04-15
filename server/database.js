import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'database.sqlite');

const db = new Database(dbPath);

// Enable foreign keys with CASCADE
db.pragma('foreign_keys = ON');

function initDb() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            points INTEGER DEFAULT 0,
            badges TEXT DEFAULT '[]'
        );

        CREATE TABLE IF NOT EXISTS scenarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT
        );

        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scenario_id INTEGER NOT NULL,
            level_number INTEGER NOT NULL,
            image_path TEXT NOT NULL,
            flag TEXT NOT NULL,
            time_limit INTEGER NOT NULL,
            hints TEXT DEFAULT '[]',
            UNIQUE(scenario_id, level_number),
            FOREIGN KEY(scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS user_scenario_progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            scenario_id INTEGER NOT NULL,
            current_level INTEGER DEFAULT 1,
            UNIQUE(user_id, scenario_id),
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS user_progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            level_id INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'in_progress',
            started_at INTEGER,
            completed_at INTEGER,
            hints_used INTEGER DEFAULT 0,
            UNIQUE(user_id, level_id),
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(level_id) REFERENCES tasks(id) ON DELETE CASCADE
        );
    `);

    // Seed data
    const scenarioCount = db.prepare('SELECT count(*) as count FROM scenarios').get().count;
    const taskCount = db.prepare('SELECT count(*) as count FROM tasks').get().count;
    
    if (scenarioCount === 0 || taskCount === 0) {
        // Only insert if not exists to avoid duplicates if partially seeded
        let scenarioId;
        const existing = db.prepare('SELECT id FROM scenarios WHERE title = ?').get('საწყისი OSINT მისია');
        if (existing) {
            scenarioId = existing.id;
        } else {
            const info = db.prepare('INSERT INTO scenarios (title, description) VALUES (?, ?)').run(
                'საწყისი OSINT მისია',
                'ეს არის პირველი TEST სცენარი GEOINT მიმართულებით. გამოიცანით ლოკაციები მიცემული ფოტოების მიხედვით.'
            );
            scenarioId = info.lastInsertRowid;
        }

        // Create tasks for this scenario if it has none
        const scenarioTaskCount = db.prepare('SELECT count(*) as count FROM tasks WHERE scenario_id = ?').get(scenarioId).count;
        if (scenarioTaskCount === 0) {
            let time = 20;
            const insertTask = db.prepare('INSERT INTO tasks (scenario_id, level_number, image_path, flag, time_limit, hints) VALUES (?, ?, ?, ?, ?, ?)');
            for (let i = 1; i <= 10; i++) {
                const hints = JSON.stringify([`ეტაპი ${i} - მინიშნება 1`, `ეტაპი ${i} - მინიშნება 2`]);
                insertTask.run(scenarioId, i, '/uploads/default.jpg', `osint{test_${i}}`, time, hints);
                time -= 2;
                if (time < 2) time = 2;
            }
        }
    }
}

initDb();

export default db;
