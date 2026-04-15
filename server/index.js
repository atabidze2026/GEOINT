import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import db from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

const submitLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 6,
    message: { error: 'ზედმეტად ბევრი მცდელობა. გთხოვთ მოიცადოთ 60 წამი' }
});

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}
app.use('/uploads', express.static(uploadsDir));

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// === USER APIs ===

app.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
        return res.status(400).json({ error: 'ყველა ველი სავალდებულოა' });
    }
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const info = db.prepare('INSERT INTO users (username, email, password) VALUES (?, ?, ?)').run(username, email, hashedPassword);
        res.json({ user: { id: info.lastInsertRowid, username, email } });
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'მომხმარებელი ამ სახელით ან ელ-ფოსტით უკვე არსებობს' });
        }
        res.status(500).json({ error: 'სერვერის შეცდომა' });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'შევსება სავალდებულოა' });
    
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) return res.status(400).json({ error: 'არასწორი მონაცემები' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'არასწორი მონაცემები' });

    res.json({ user: { id: user.id, username: user.username, email: user.email } });
});

// Leaderboard
app.get('/api/leaderboard', (req, res) => {
    const query = `
        SELECT 
            u.id, 
            u.username, 
            u.badges,
            COUNT(p.id) as completed_tasks,
            SUM(p.completed_at - p.started_at) as total_time_ms
        FROM users u
        LEFT JOIN user_progress p ON u.id = p.user_id AND p.status = 'completed'
        GROUP BY u.id
        ORDER BY completed_tasks DESC, total_time_ms ASC
        LIMIT 50
    `;
    const users = db.prepare(query).all();
    res.json(users);
});

// Get user profile (points, badges)
app.get('/api/users/:id', (req, res) => {
    const user = db.prepare('SELECT id, username, points, badges FROM users WHERE id = ?').get(req.params.id);
    if (user) res.json(user);
    else res.status(404).json({ error: 'Not found' });
});

// Scenarios API (For client)
app.get('/api/scenarios', (req, res) => {
    const scenarios = db.prepare('SELECT * FROM scenarios').all();
    res.json(scenarios);
});

// Sync logic per scenario
app.get('/api/sync/:scenarioId/:userId', (req, res) => {
    const { scenarioId, userId } = req.params;
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const scenario = db.prepare('SELECT id FROM scenarios WHERE id = ?').get(scenarioId);
    if (!scenario) return res.status(404).json({ error: 'Scenario not found' });

    let userProgress = db.prepare('SELECT * FROM user_scenario_progress WHERE user_id = ? AND scenario_id = ?').get(userId, scenarioId);
    if (!userProgress) {
        db.prepare('INSERT INTO user_scenario_progress (user_id, scenario_id, current_level) VALUES (?, ?, ?)').run(userId, scenarioId, 1);
        userProgress = db.prepare('SELECT * FROM user_scenario_progress WHERE user_id = ? AND scenario_id = ?').get(userId, scenarioId);
    }

    const task = db.prepare('SELECT * FROM tasks WHERE scenario_id = ? AND level_number = ?').get(scenarioId, userProgress.current_level);
    
    console.log(`[Sync] User ${userId}, Scenario ${scenarioId}, Current Level: ${userProgress.current_level}, Task Found: ${!!task}`);

    if (!task) {
        // If level_number is 1 and no task found, it means the scenario is empty
        if (userProgress.current_level === 1) {
            return res.json({ status: 'empty_scenario' });
        }
        return res.json({ status: 'completed_all' });
    }

    let progress = db.prepare('SELECT * FROM user_progress WHERE user_id = ? AND level_id = ?').get(userId, task.id);
    const now = Date.now();

    if (!progress) {
        db.prepare('INSERT INTO user_progress (user_id, level_id, started_at) VALUES (?, ?, ?)').run(userId, task.id, now);
        progress = db.prepare('SELECT * FROM user_progress WHERE user_id = ? AND level_id = ?').get(userId, task.id);
    } else if (progress.status === 'in_progress') {
        const elapsed = (now - progress.started_at) / 1000 / 60;
        if (elapsed > task.time_limit) {
            db.prepare('UPDATE user_progress SET status = ? WHERE id = ?').run('timeout', progress.id);
            return res.json({ status: 'game_over' });
        }
    } else if (progress.status === 'timeout') {
        return res.json({ status: 'game_over' });
    }

    const allHints = JSON.parse(task.hints || '[]');
    const hintsUsed = progress.hints_used || 0;
    // Only send the hints the user has already unlocked
    const unlockedHints = allHints.slice(0, hintsUsed);
    const totalHintsAvailable = allHints.length;

    const { flag, hints, ...safeTask } = task;
    res.json({
        status: progress.status,
        task: safeTask,
        scenario: {
            title: scenario.title,
            description: scenario.description
        },
        startedAt: progress.started_at,
        hintsUsed,
        totalHintsAvailable,
        unlockedHints
    });
});

// Hint endpoint - unlocks next hint
app.post('/api/hint', (req, res) => {
    const { userId, taskId } = req.body;
    
    const progress = db.prepare('SELECT * FROM user_progress WHERE user_id = ? AND level_id = ? AND status = "in_progress"').get(userId, taskId);
    if (!progress) return res.status(400).json({ error: 'No active progress' });

    const task = db.prepare('SELECT hints FROM tasks WHERE id = ?').get(taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const allHints = JSON.parse(task.hints || '[]');
    const currentUsed = progress.hints_used || 0;

    if (currentUsed >= allHints.length) {
        return res.json({ success: false, error: 'მეტი მინიშნება არ არსებობს' });
    }

    const newCount = currentUsed + 1;
    db.prepare('UPDATE user_progress SET hints_used = ? WHERE id = ?').run(newCount, progress.id);

    // Return full list of unlocked hints
    const unlockedHints = allHints.slice(0, newCount);
    res.json({ success: true, unlockedHints, hintsUsed: newCount, totalHintsAvailable: allHints.length });
});

app.post('/api/restart-level', (req, res) => {
    const { userId, taskId } = req.body;
    db.prepare('DELETE FROM user_progress WHERE user_id = ? AND level_id = ?').run(userId, taskId);
    res.json({ success: true });
});

// Submit Flag + Badges logic + Rating
app.post('/api/submit', submitLimiter, (req, res) => {
    try {
        const { userId: rawUserId, scenarioId: rawScenarioId, flag } = req.body;
        const userId = Number(rawUserId);
        const scenarioId = Number(rawScenarioId);
        const submittedFlag = (flag || '').trim().toLowerCase();
        
        console.log(`[Submit Request] User: ${userId}, Scenario: ${scenarioId}, Flag: ${submittedFlag}`);
        
        if (!userId || !scenarioId) {
            return res.status(400).json({ error: 'Missing User ID or Scenario ID' });
        }

        const userProgress = db.prepare('SELECT * FROM user_scenario_progress WHERE user_id = ? AND scenario_id = ?').get(userId, scenarioId);
        if (!userProgress) {
            console.error(`[Submit] User ${userId} has no progress for scenario ${scenarioId}`);
            return res.status(400).json({ error: 'სცენარის პროგრესი ვერ მოიძებნა' });
        }

        const task = db.prepare('SELECT * FROM tasks WHERE scenario_id = ? AND level_number = ?').get(scenarioId, userProgress.current_level);
        if (!task) {
            console.error(`[Submit] Task not found for scenario ${scenarioId} level ${userProgress.current_level}`);
            return res.status(400).json({ error: 'დავალება ვერ მოიძებნა' });
        }

        const progress = db.prepare('SELECT * FROM user_progress WHERE user_id = ? AND level_id = ?').get(userId, task.id);
        if (!progress || progress.status !== 'in_progress') {
            console.warn(`[Submit] Task status mismatch for user ${userId}: ${progress ? progress.status : 'no progress'}`);
            return res.status(400).json({ error: 'დავალება არ არის გააქტიურებული (სცადეთ გვერდის განახლება)' });
        }

        const now = Date.now();
        const elapsedMinutes = (now - progress.started_at) / 1000 / 60;
        
        if (elapsedMinutes > task.time_limit) {
            db.prepare('UPDATE user_progress SET status = ? WHERE id = ?').run('timeout', progress.id);
            console.log(`[Submit] Time limit exceeded for user ${userId}`);
            return res.json({ correct: false, timeout: true });
        }

        const dbFlag = (task.flag || '').trim().toLowerCase();

        if (dbFlag === submittedFlag) {
            console.log(`[Submit Success] User ${userId} flag correct`);
            
            db.prepare('UPDATE user_progress SET status = ?, completed_at = ? WHERE id = ?').run('completed', now, progress.id);
            db.prepare('UPDATE user_scenario_progress SET current_level = current_level + 1 WHERE id = ?').run(userProgress.id);
            
            // Points calculation
            const hintsUsed = progress.hints_used || 0;
            let earnedPoints = 100 - Math.floor((elapsedMinutes || 0) * 2) - (hintsUsed * 30);
            if (isNaN(earnedPoints) || earnedPoints < 10) earnedPoints = 10; 
            
            const user = db.prepare('SELECT points, badges FROM users WHERE id = ?').get(userId);
            if (!user) {
                return res.status(404).json({ error: 'User not found in DB' });
            }

            let currentBadges = [];
            try { currentBadges = JSON.parse(user.badges || '[]'); } catch (e) { currentBadges = []; }
            let newBadges = [];

            // First Blood
            const prevCompletes = db.prepare("SELECT count(*) as c FROM user_progress WHERE level_id = ? AND status = 'completed' AND id != ?").get(task.id, progress.id).c;
            if (prevCompletes === 0 && !currentBadges.includes('🥇 First Blood')) {
                currentBadges.push('🥇 First Blood');
                newBadges.push('🥇 First Blood');
            }
            // Speedrunner
            if (elapsedMinutes < 2 && !currentBadges.includes('⚡ Speedrunner')) {
                currentBadges.push('⚡ Speedrunner');
                newBadges.push('⚡ Speedrunner');
            }
            // Ghost
            if (hintsUsed === 0 && !currentBadges.includes('🕵️ Ghost')) {
                currentBadges.push('🕵️ Ghost');
                newBadges.push('🕵️ Ghost');
            }

            db.prepare('UPDATE users SET points = points + ?, badges = ? WHERE id = ?').run(earnedPoints, JSON.stringify(currentBadges), userId);
            console.log(`[Submit] User ${userId} earned ${earnedPoints} points`);

            return res.json({ correct: true, points: earnedPoints, newBadges });
        } else {
            console.log(`[Submit] Incorrect flag for user ${userId}. Got: "${submittedFlag}", Want: "${dbFlag}"`);
            return res.json({ correct: false });
        }
    } catch (err) {
        console.error('[Submit System Error]', err);
        res.status(500).json({ error: 'სერვერზე მოხდა შეცდომა პასუხის დამუშავებისას' });
    }
});

// === ADMIN APIs ===

const checkAdmin = (req, res, next) => {
    const auth = req.headers.authorization;
    if (auth === 'Bearer admin123') {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
};

app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === 'admin') {
        res.json({ token: 'admin123' });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// Scenarios CRUD
app.post('/api/admin/scenarios', checkAdmin, (req, res) => {
    const { title, description } = req.body;
    try {
        db.prepare('INSERT INTO scenarios (title, description) VALUES (?, ?)').run(title, description || '');
        res.json({ success: true });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

app.put('/api/admin/scenarios/:id', checkAdmin, (req, res) => {
    const { title, description } = req.body;
    try {
        db.prepare('UPDATE scenarios SET title = ?, description = ? WHERE id = ?').run(title, description || '', req.params.id);
        res.json({ success: true });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

app.delete('/api/admin/scenarios/:id', checkAdmin, (req, res) => {
    try {
        const id = req.params.id;
        // Get all task IDs for this scenario to clean up user_progress
        const taskIds = db.prepare('SELECT id FROM tasks WHERE scenario_id = ?').all(id).map(t => t.id);
        
        // Delete user_progress for these tasks
        if (taskIds.length > 0) {
            const placeholders = taskIds.map(() => '?').join(',');
            db.prepare(`DELETE FROM user_progress WHERE level_id IN (${placeholders})`).run(...taskIds);
        }
        
        // Delete user_scenario_progress for this scenario
        db.prepare('DELETE FROM user_scenario_progress WHERE scenario_id = ?').run(id);
        
        // Delete tasks
        db.prepare('DELETE FROM tasks WHERE scenario_id = ?').run(id);
        
        // Delete scenario
        db.prepare('DELETE FROM scenarios WHERE id = ?').run(id);
        
        res.json({ success: true });
    } catch (e) {
        console.error('Delete scenario error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Tasks CRUD
app.get('/api/admin/tasks', checkAdmin, (req, res) => {
    const tasks = db.prepare('SELECT t.*, s.title as scenario_title FROM tasks t JOIN scenarios s ON s.id = t.scenario_id ORDER BY t.scenario_id ASC, t.level_number ASC').all();
    res.json(tasks);
});

app.post('/api/admin/tasks', checkAdmin, upload.single('image'), (req, res) => {
    const { scenario_id, level_number, flag, time_limit, hints } = req.body;
    let image_path = '';
    if (req.file) {
        image_path = '/uploads/' + req.file.filename;
    }
    
    try {
        db.prepare('INSERT INTO tasks (scenario_id, level_number, image_path, flag, time_limit, hints) VALUES (?, ?, ?, ?, ?, ?)')
          .run(scenario_id, level_number, image_path, flag, time_limit, hints || '[]');
        res.json({ success: true });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

app.put('/api/admin/tasks/:id', checkAdmin, upload.single('image'), (req, res) => {
    const { id } = req.params;
    const { level_number, flag, time_limit, hints } = req.body;
    
    try {
        if (req.file) {
            db.prepare('UPDATE tasks SET level_number = ?, flag = ?, time_limit = ?, hints = ?, image_path = ? WHERE id = ?')
              .run(level_number, flag, time_limit, hints || '[]', '/uploads/' + req.file.filename, id);
        } else {
            db.prepare('UPDATE tasks SET level_number = ?, flag = ?, time_limit = ?, hints = ? WHERE id = ?')
              .run(level_number, flag, time_limit, hints || '[]', id);
        }
        res.json({ success: true });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

app.delete('/api/admin/tasks/:id', checkAdmin, (req, res) => {
    try {
        const id = req.params.id;
        // Delete related user_progress first
        db.prepare('DELETE FROM user_progress WHERE level_id = ?').run(id);
        // Delete the task
        db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
        res.json({ success: true });
    } catch (e) {
        console.error('Delete task error:', e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/admin/stats', checkAdmin, (req, res) => {
    const users = db.prepare('SELECT id, username, email, points, badges FROM users').all();
    const stats = users.map(u => {
        const completedTasks = db.prepare('SELECT COUNT(*) as count FROM user_progress WHERE user_id = ? AND status = ?').get(u.id, 'completed').count;
        const progress = db.prepare('SELECT level_id, started_at, completed_at FROM user_progress WHERE user_id = ? AND status = ?').all(u.id, 'completed');
        
        let totalTimeSpent = 0;
        progress.forEach(p => {
            if (p.started_at && p.completed_at) {
                totalTimeSpent += (p.completed_at - p.started_at) / 1000 / 60;
            }
        });

        const scenariosInfo = db.prepare('SELECT s.title, usp.current_level FROM user_scenario_progress usp JOIN scenarios s ON s.id = usp.scenario_id WHERE usp.user_id = ?').all(u.id);

        return {
            ...u,
            completedTasks,
            totalTimeSpent: totalTimeSpent.toFixed(2),
            scenariosInfo
        };
    });
    res.json(stats);
});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
