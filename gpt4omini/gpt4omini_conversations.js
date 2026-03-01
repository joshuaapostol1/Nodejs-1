
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'gpt4omini_conversations.sqlite');

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
        console.error('Error opening GPT4O Mini conversations database:', err.message);
    } else {
        console.log('Connected to GPT4O Mini conversations database');
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            message TEXT NOT NULL,
            role TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE INDEX IF NOT EXISTS idx_user_conversations ON conversations(user_id, timestamp)`);
    });
}

function saveMessage(userId, message, role) {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare('INSERT INTO conversations (user_id, message, role) VALUES (?, ?, ?)');
        stmt.run([userId, message, role], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.lastID);
            }
        });
        stmt.finalize();
    });
}

function getConversationHistory(userId, limit = 50) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT message, role, timestamp 
            FROM conversations 
            WHERE user_id = ? 
            ORDER BY timestamp ASC 
            LIMIT ?
        `;
        
        db.all(query, [userId, limit], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

function deleteConversationHistory(userId) {
    return new Promise((resolve, reject) => {
        db.run('DELETE FROM conversations WHERE user_id = ?', [userId], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.changes);
            }
        });
    });
}

function getMessageCount(userId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM conversations WHERE user_id = ?', [userId], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row.count);
            }
        });
    });
}

module.exports = {
    saveMessage,
    getConversationHistory,
    deleteConversationHistory,
    getMessageCount
};
