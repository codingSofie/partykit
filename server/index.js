const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { 
  db, 
  roomQueries, 
  playerQueries, 
  clickLogQueries 
} = require('./db');

const PORT = Number(process.env.PORT) || 3009;
const HOST = process.env.HOST || '0.0.0.0';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3008';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : Array.from(new Set([
      FRONTEND_URL,
      'http://localhost:3008',
      'http://127.0.0.1:3008',
    ]));

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// 存储连接映射
const connectionMap = new Map(); // connection_id -> { socketId, playerId, roomId }

// 根路径 - API 信息
app.get('/', (req, res) => {
  const protocol = req.protocol || 'http';
  const host = req.get('host') || `${HOST}:${PORT}`;
  const wsProtocol = protocol === 'https' ? 'wss' : 'ws';
  
  res.json({
    name: 'Party Buzzer API',
    version: '1.0.0',
    endpoints: {
      'POST /api/create-room': '创建房间',
    },
    websocket: `${wsProtocol}://${host}`,
    frontend: FRONTEND_URL,
    allowed_origins: ALLOWED_ORIGINS
  });
});

// 生成房间代码
app.post('/api/create-room', (req, res) => {
  const { player_name, password } = req.body;
  
  if (!player_name || player_name.length < 1 || player_name.length > 20) {
    return res.status(400).json({ error: '玩家名稱必須在1-20字符之間' });
  }
  
  // 验证密码格式：必须是4个字符，只包含数字和大写字母
  if (!password || password.length !== 4 || !/^[0-9A-Z]{4}$/.test(password)) {
    return res.status(400).json({ error: '房間密碼必須是4位數字或大寫字母' });
  }
  
  const roomId = require('uuid').v4();
  const now = Date.now();
  
  try {
    // 检查密码是否已存在
    const existingRoom = roomQueries.findByPassword.get(password);
    if (existingRoom) {
      return res.status(400).json({ error: '該密碼已被使用，請選擇其他密碼' });
    }
    
    roomQueries.create.run(roomId, null, password, now, null, now);
    
    res.json({ 
      success: true, 
      room_id: roomId
    });
  } catch (error) {
    console.error('创建房间错误:', error);
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: '該密碼已被使用，請選擇其他密碼' });
    }
    res.status(500).json({ error: '創建房間失敗' });
  }
});

// Socket.IO 连接处理
io.on('connection', (socket) => {
  console.log('客户端连接:', socket.id);
  
  socket.on('join_room', async (data) => {
    console.log('收到加入房间请求:', data);
    const { player_name, password } = data;
    
    if (!player_name || player_name.length < 1 || player_name.length > 20) {
      socket.emit('join_room_response', {
        success: false,
        error: '玩家名稱必須在1-20字符之間'
      });
      return;
    }
    
    // 验证密码：必须是4个字符，只包含数字和大写字母
    if (!password || typeof password !== 'string') {
      socket.emit('join_room_response', {
        success: false,
        error: '房間密碼不能為空'
      });
      return;
    }
    
    const passwordUpper = password.toUpperCase().trim();
    
    // 检查长度
    if (passwordUpper.length !== 4) {
      socket.emit('join_room_response', {
        success: false,
        error: '房間密碼必須是4位字符'
      });
      return;
    }
    
    // 验证只包含数字和大写字母
    if (!/^[0-9A-Z]{4}$/.test(passwordUpper)) {
      socket.emit('join_room_response', {
        success: false,
        error: '房間密碼只能包含數字和大寫字母'
      });
      return;
    }
    
    try {
      let room = roomQueries.findByPassword.get(passwordUpper);
      
      // 如果房间不存在，创建新房间
      if (!room) {
        const roomId = require('uuid').v4();
        const now = Date.now();
        roomQueries.create.run(roomId, null, passwordUpper, now, null, now);
        room = roomQueries.findByPassword.get(passwordUpper);
      }
      
      // 检查房间是否已满
      const playerCount = roomQueries.getPlayerCount.get(room.id);
      if (playerCount.count >= room.max_players) {
        socket.emit('join_room_response', {
          success: false,
          error: '房間已滿'
        });
        return;
      }
      
      // 检查房间内是否有玩家
      const existingPlayers = playerQueries.findByRoom.all(room.id);
      const isFirstPlayer = existingPlayers.length === 0;
      
      // 创建玩家
      const playerId = require('uuid').v4();
      const now = Date.now();
      
      // 如果房间有玩家但没有主持人，新玩家成为主持人
      const hasHost = existingPlayers.some(p => p.is_host === 1);
      const shouldBeHost = isFirstPlayer || !hasHost;
      
      playerQueries.create.run(
        playerId, 
        room.id, 
        player_name, 
        shouldBeHost ? 1 : 0, 
        now, 
        socket.id
      );
      
      // 如果新玩家是主持人，确保其他玩家不是主持人
      if (shouldBeHost) {
        db.prepare('UPDATE players SET is_host = 0 WHERE room_id = ? AND id != ?').run(room.id, playerId);
        playerQueries.updateHost.run(1, playerId);
      }
      
      // 加入 Socket.IO 房间
      socket.join(room.id);
      connectionMap.set(socket.id, { playerId, roomId: room.id });
      
      // 更新房间活动时间
      roomQueries.updateActivity.run(Date.now(), room.id);
      
      // 获取更新后的玩家列表
      const players = playerQueries.findByRoom.all(room.id);
      
      // 发送加入成功响应
      socket.emit('join_room_response', {
        success: true,
        room_data: {
          id: room.id,
          password: passwordUpper,
          max_players: room.max_players,
          current_phase: room.current_phase,
          round_number: room.round_number
        },
        user_data: {
          id: playerId,
          name: player_name,
          is_host: shouldBeHost,
          joined_at: now
        }
      });
      
      console.log('成功加入房间:', { roomId: room.id, password: passwordUpper, playerId, isHost: shouldBeHost });
      
      // 广播玩家加入事件
      socket.to(room.id).emit('player_joined', {
        player_id: playerId,
        player_name: player_name,
        is_host: shouldBeHost,
        total_players: players.length
      });
      
    } catch (error) {
      console.error('加入房间错误:', error);
      console.error('错误详情:', error.message, error.stack);
      socket.emit('join_room_response', {
        success: false,
        error: error.message || '加入房間失敗'
      });
    }
  });
  
  // 开始回合
  socket.on('start_round', (data) => {
    const { room_id, player_id } = data;
    const conn = connectionMap.get(socket.id);
    
    if (!conn || conn.playerId !== player_id || conn.roomId !== room_id) {
      socket.emit('start_round_response', {
        success: false,
        error: '無效的請求'
      });
      return;
    }
    
    const player = playerQueries.findById.get(player_id);
    if (!player || player.is_host !== 1) {
      socket.emit('start_round_response', {
        success: false,
        error: '只有主持人可以開始回合'
      });
      return;
    }
    
    const room = roomQueries.findById.get(room_id);
    if (!room) {
      socket.emit('start_round_response', {
        success: false,
        error: '房間不存在'
      });
      return;
    }
    
    if (room.current_phase !== 'waiting') {
      socket.emit('start_round_response', {
        success: false,
        error: '當前狀態不允許開始'
      });
      return;
    }
    
    const now = Date.now();
    const roundNumber = room.round_number + 1;
    
    roomQueries.updateGameState.run(
      'active',
      roundNumber,
      null,
      now,
      null,
      now,
      room_id
    );
    
    // 广播开始事件
    io.to(room_id).emit('round_started', {
      room_id: room_id,
      start_time: now,
      round_number: roundNumber
    });
    
    socket.emit('start_round_response', {
      success: true
    });
  });
  
  // 玩家点击
  socket.on('player_click', (data) => {
    const { player_id, room_id, client_timestamp } = data;
    const conn = connectionMap.get(socket.id);
    
    if (!conn || conn.playerId !== player_id || conn.roomId !== room_id) {
      socket.emit('click_response', {
        success: false,
        error: '無效的請求'
      });
      return;
    }
    
    const room = roomQueries.findById.get(room_id);
    if (!room) {
      socket.emit('click_response', {
        success: false,
        error: '房間不存在'
      });
      return;
    }
    
    if (room.current_phase !== 'active') {
      socket.emit('click_response', {
        success: false,
        error: '當前不在搶答狀態'
      });
      return;
    }
    
    // 检查是否已经点击过
    const existingClicks = clickLogQueries.findByRoomAndRound.all(room_id, room.round_number);
    const alreadyClicked = existingClicks.some(log => log.player_id === player_id);
    
    if (alreadyClicked) {
      socket.emit('click_response', {
        success: false,
        error: '本輪已點擊過'
      });
      return;
    }
    
    const serverTimestamp = Date.now();
    const reactionTime = room.start_time ? serverTimestamp - room.start_time : null;
    const clickOrder = existingClicks.length + 1;
    const player = playerQueries.findById.get(player_id);
    
    // 记录点击
    clickLogQueries.create.run(
      room_id,
      player_id,
      player.name,
      serverTimestamp,
      client_timestamp || null,
      reactionTime,
      clickOrder,
      room.round_number
    );
    
    const isFirstClick = clickOrder === 1;
    
    // 如果是第一个点击，立即锁定
    if (isFirstClick) {
      roomQueries.updateGameState.run(
        'locked',
        room.round_number,
        player_id,
        room.start_time,
        serverTimestamp,
        serverTimestamp,
        room_id
      );
      
      // 广播锁定事件
      io.to(room_id).emit('round_locked', {
        first_clicker_id: player_id,
        first_clicker_name: player.name,
        server_timestamp: serverTimestamp
      });
      
      // 延迟发送结果（给所有玩家时间看到按钮颜色变化）
      setTimeout(() => {
        const allClicks = clickLogQueries.findByRoomAndRound.all(room_id, room.round_number);
        const winner = allClicks[0];
        
        roomQueries.updateGameState.run(
          'result',
          room.round_number,
          player_id,
          room.start_time,
          serverTimestamp,
          serverTimestamp,
          room_id
        );
        
        io.to(room_id).emit('round_result', {
          winner_id: winner.player_id,
          winner_name: winner.player_name,
          reaction_time_ms: winner.reaction_time_ms,
          click_logs: allClicks.map(log => ({
            player_id: log.player_id,
            player_name: log.player_name,
            server_timestamp: log.server_timestamp,
            reaction_time_ms: log.reaction_time_ms,
            order: log.click_order
          }))
        });
      }, 500);
    }
    
    socket.emit('click_response', {
      success: true,
      is_first_click: isFirstClick,
      server_timestamp: serverTimestamp,
      reaction_time_ms: reactionTime
    });
  });
  
  // 重置回合
  socket.on('reset_round', (data) => {
    const { room_id, player_id } = data;
    const conn = connectionMap.get(socket.id);
    
    if (!conn || conn.playerId !== player_id || conn.roomId !== room_id) {
      socket.emit('reset_round_response', {
        success: false,
        error: '無效的請求'
      });
      return;
    }
    
    const player = playerQueries.findById.get(player_id);
    if (!player || player.is_host !== 1) {
      socket.emit('reset_round_response', {
        success: false,
        error: '只有主持人可以重置'
      });
      return;
    }
    
    const room = roomQueries.findById.get(room_id);
    if (!room) {
      socket.emit('reset_round_response', {
        success: false,
        error: '房間不存在'
      });
      return;
    }
    
    if (room.current_phase !== 'waiting' && room.current_phase !== 'result') {
      socket.emit('reset_round_response', {
        success: false,
        error: '當前狀態不允許重置'
      });
      return;
    }
    
    const now = Date.now();
    roomQueries.updateGameState.run(
      'waiting',
      room.round_number,
      null,
      null,
      null,
      now,
      room_id
    );
    
    // 广播重置事件
    io.to(room_id).emit('round_reset', {
      room_id: room_id
    });
    
    socket.emit('reset_round_response', {
      success: true
    });
  });
  
  // 离开房间
  socket.on('leave_room', (data) => {
    const { player_id, room_id } = data;
    const conn = connectionMap.get(socket.id);
    
    if (!conn || conn.playerId !== player_id || conn.roomId !== room_id) {
      socket.emit('leave_room_response', {
        success: false,
        error: '無效的請求'
      });
      return;
    }
    
    const player = playerQueries.findById.get(player_id);
    if (!player) {
      socket.emit('leave_room_response', {
        success: false,
        error: '玩家不存在'
      });
      return;
    }
    
    const room = roomQueries.findById.get(room_id);
    if (!room) {
      socket.emit('leave_room_response', {
        success: false,
        error: '房間不存在'
      });
      return;
    }
    
    const wasHost = player.is_host === 1;
    
    // 删除玩家
    playerQueries.delete.run(player_id);
    connectionMap.delete(socket.id);
    socket.leave(room_id);
    
    // 检查房间是否还有玩家
    const remainingPlayers = playerQueries.findByRoom.all(room_id);
    
    if (remainingPlayers.length === 0) {
      // 房间无人，删除房间
      db.prepare('DELETE FROM click_logs WHERE room_id = ?').run(room_id);
      roomQueries.delete.run(room_id);
      
      socket.emit('leave_room_response', {
        success: true,
        message: '已離開房間',
        redirect_to: 'home'
      });
      return;
    }
    
    // 如果离开的是主持人，转移给最老的玩家
    if (wasHost) {
      const newHost = remainingPlayers[0];
      playerQueries.updateHost.run(1, newHost.id);
      
      // 广播主持人变更
      io.to(room_id).emit('host_transferred', {
        new_host_id: newHost.id,
        new_host_name: newHost.name
      });
    }
    
    // 广播玩家离开
    io.to(room_id).emit('player_left', {
      player_id: player_id,
      player_name: player.name,
      total_players: remainingPlayers.length,
      new_host_id: wasHost ? remainingPlayers[0].id : null,
      room_closed: false
    });
    
    socket.emit('leave_room_response', {
      success: true,
      message: '已離開房間',
      redirect_to: 'home'
    });
  });
  
  // 断开连接处理
  socket.on('disconnect', () => {
    const conn = connectionMap.get(socket.id);
    if (conn) {
      const player = playerQueries.findById.get(conn.playerId);
      if (player) {
        playerQueries.clearConnection.run(socket.id);
        // 可以在这里实现断线重连逻辑
      }
      connectionMap.delete(socket.id);
    }
    console.log('客户端断开:', socket.id);
  });
  
  // Ping/Pong
  socket.on('ping', () => {
    socket.emit('pong', {
      server_time: Date.now()
    });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`服务器运行在 http://${HOST}:${PORT}`);
  console.log(`本地访问: http://localhost:${PORT}`);
  console.log(`WebSocket 连接: ws://localhost:${PORT}`);
  console.log(`允许的前端域名: ${ALLOWED_ORIGINS.join(', ')}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ 错误: 端口 ${PORT} 已被占用！`);
    console.error(`\n解决方案:`);
    console.error(`1. 使用其他端口: PORT=3010 node server/index.js`);
    console.error(`2. 或者禁用 macOS AirPlay 接收器:`);
    console.error(`   - 系统设置 > 通用 > AirPlay 接收器 > 关闭`);
    console.error(`\n当前占用端口的进程:`);
    const { execSync } = require('child_process');
    try {
      const result = execSync(`lsof -i :${PORT}`, { encoding: 'utf8' });
      console.error(result);
    } catch (e) {
      // ignore
    }
    process.exit(1);
  } else {
    throw err;
  }
});
