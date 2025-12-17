const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, 'party.db');
const db = new Database(dbPath);

// 初始化数据库表
db.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    code TEXT,
    password TEXT UNIQUE NOT NULL,
    created_at INTEGER NOT NULL,
    created_by TEXT,
    max_players INTEGER DEFAULT 50,
    last_activity INTEGER NOT NULL,
    current_phase TEXT DEFAULT 'waiting',
    round_number INTEGER DEFAULT 0,
    first_clicker_id TEXT,
    start_time INTEGER,
    end_time INTEGER
  );

  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    name TEXT NOT NULL,
    is_host INTEGER DEFAULT 0,
    joined_at INTEGER NOT NULL,
    connection_id TEXT,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS click_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT NOT NULL,
    player_id TEXT NOT NULL,
    player_name TEXT NOT NULL,
    server_timestamp INTEGER NOT NULL,
    client_timestamp INTEGER,
    reaction_time_ms INTEGER,
    click_order INTEGER,
    round_number INTEGER NOT NULL,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_players_room ON players(room_id);
  CREATE INDEX IF NOT EXISTS idx_click_logs_room ON click_logs(room_id);
  CREATE INDEX IF NOT EXISTS idx_click_logs_round ON click_logs(room_id, round_number);
`);

// 生成唯一的房间代码
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  // 检查是否已存在
  const existing = db.prepare('SELECT id FROM rooms WHERE code = ?').get(code);
  if (existing) {
    return generateRoomCode(); // 递归重试
  }
  return code;
}

// 房间操作
const roomQueries = {
  create: db.prepare(`
    INSERT INTO rooms (id, code, password, created_at, created_by, last_activity)
    VALUES (?, ?, ?, ?, ?, ?)
  `),
  
  findByCode: db.prepare('SELECT * FROM rooms WHERE code = ?'),
  
  findByPassword: db.prepare('SELECT * FROM rooms WHERE password = ?'),
  
  findById: db.prepare('SELECT * FROM rooms WHERE id = ?'),
  
  updatePhase: db.prepare('UPDATE rooms SET current_phase = ?, last_activity = ? WHERE id = ?'),
  
  updateGameState: db.prepare(`
    UPDATE rooms 
    SET current_phase = ?, round_number = ?, first_clicker_id = ?, start_time = ?, end_time = ?, last_activity = ?
    WHERE id = ?
  `),
  
  updateActivity: db.prepare('UPDATE rooms SET last_activity = ? WHERE id = ?'),
  
  delete: db.prepare('DELETE FROM rooms WHERE id = ?'),
  
  getPlayerCount: db.prepare('SELECT COUNT(*) as count FROM players WHERE room_id = ?'),
};

// 玩家操作
const playerQueries = {
  create: db.prepare(`
    INSERT INTO players (id, room_id, name, is_host, joined_at, connection_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `),
  
  findByRoom: db.prepare('SELECT * FROM players WHERE room_id = ? ORDER BY joined_at ASC'),
  
  findById: db.prepare('SELECT * FROM players WHERE id = ?'),
  
  findByConnection: db.prepare('SELECT * FROM players WHERE connection_id = ?'),
  
  updateHost: db.prepare('UPDATE players SET is_host = ? WHERE id = ?'),
  
  setHostByRoom: db.prepare(`
    UPDATE players 
    SET is_host = 1 
    WHERE id = (
      SELECT id FROM players 
      WHERE room_id = ? AND is_host = 0 
      ORDER BY joined_at ASC 
      LIMIT 1
    )
  `),
  
  delete: db.prepare('DELETE FROM players WHERE id = ?'),
  
  updateConnection: db.prepare('UPDATE players SET connection_id = ? WHERE id = ?'),
  
  clearConnection: db.prepare('UPDATE players SET connection_id = NULL WHERE connection_id = ?'),
};

// 点击日志操作
const clickLogQueries = {
  create: db.prepare(`
    INSERT INTO click_logs (room_id, player_id, player_name, server_timestamp, client_timestamp, reaction_time_ms, click_order, round_number)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `),
  
  findByRoomAndRound: db.prepare(`
    SELECT * FROM click_logs 
    WHERE room_id = ? AND round_number = ? 
    ORDER BY server_timestamp ASC
  `),
  
  clearRound: db.prepare('DELETE FROM click_logs WHERE room_id = ? AND round_number = ?'),
};

// 清理过期房间（30分钟无活动）
function cleanupInactiveRooms() {
  const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
  const inactiveRooms = db.prepare(`
    SELECT id FROM rooms WHERE last_activity < ?
  `).all(thirtyMinutesAgo);
  
  inactiveRooms.forEach(room => {
    db.prepare('DELETE FROM players WHERE room_id = ?').run(room.id);
    db.prepare('DELETE FROM click_logs WHERE room_id = ?').run(room.id);
    db.prepare('DELETE FROM rooms WHERE id = ?').run(room.id);
  });
  
  return inactiveRooms.length;
}

// 每5分钟清理一次
setInterval(cleanupInactiveRooms, 5 * 60 * 1000);

module.exports = {
  db,
  roomQueries,
  playerQueries,
  clickLogQueries,
  cleanupInactiveRooms,
};


