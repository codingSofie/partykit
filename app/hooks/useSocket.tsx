'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';

export type GamePhase = 'waiting' | 'active' | 'locked' | 'result';
export type RoomState = 'not_entered' | 'entered';

export interface User {
  id: string;
  name: string;
  is_host: boolean;
  joined_at: number;
}

export interface Room {
  id: string;
  password?: string;
  max_players: number;
  current_phase: GamePhase;
  round_number: number;
}

export interface ClickLog {
  player_id: string;
  player_name: string;
  server_timestamp: number;
  reaction_time_ms: number | null;
  order: number;
}

export interface GameState {
  current_phase: GamePhase;
  round_active: boolean;
  round_number: number;
  first_clicker_id: string | null;
  start_time: number | null;
  end_time: number | null;
  winner: {
    player_id: string | null;
    player_name: string | null;
    reaction_time_ms: number | null;
  } | null;
}

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  user: User | null;
  room: Room | null;
  roomState: RoomState;
  gameState: GameState;
  players: User[];
  error: string | null;
  joinRoom: (password: string, playerName: string) => void;
  startRound: () => void;
  clickBuzzer: () => void;
  resetRound: () => void;
  leaveRoom: () => void;
  setError: (error: string | null) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [roomState, setRoomState] = useState<RoomState>('not_entered');
  const [gameState, setGameState] = useState<GameState>({
    current_phase: 'waiting',
    round_active: false,
    round_number: 0,
    first_clicker_id: null,
    start_time: null,
    end_time: null,
    winner: null,
  });
  const [players, setPlayers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3009';
    console.log('正在连接到WebSocket服务器:', serverUrl);
    
    const newSocket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
    });

    newSocket.on('connect', () => {
      console.log('已连接到服务器');
      setConnected(true);
      setError(null);
    });

    newSocket.on('disconnect', () => {
      console.log('与服务器断开连接');
      setConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      console.error('WebSocket连接错误:', err);
      console.error('错误详情:', err.message);
      setError(`无法连接到服务器: ${err.message || '请检查服务器是否运行'}`);
    });

    // 加入房间响应
    newSocket.on('join_room_response', (data: {
      success: boolean;
      room_data?: Room;
      user_data?: User;
      error?: string;
    }) => {
      console.log('收到加入房间响应:', data);
      if (data.success && data.room_data && data.user_data) {
        setRoom(data.room_data);
        setUser(data.user_data);
        setRoomState('entered');
        setGameState({
          current_phase: data.room_data.current_phase as GamePhase,
          round_active: data.room_data.current_phase === 'active',
          round_number: data.room_data.round_number,
          first_clicker_id: null,
          start_time: null,
          end_time: null,
          winner: null,
        });
        setError(null);
      } else {
        console.error('加入房间失败:', data.error);
        setError(data.error || '加入房间失败');
      }
    });

    // 玩家加入
    newSocket.on('player_joined', (data: {
      player_id: string;
      player_name: string;
      is_host: boolean;
      total_players: number;
    }) => {
      console.log('玩家加入:', data);
    });

    // 玩家离开
    newSocket.on('player_left', (data: {
      player_id: string;
      player_name: string;
      total_players: number;
      new_host_id: string | null;
      room_closed: boolean;
    }) => {
      console.log('玩家离开:', data);
      if (data.room_closed) {
        setRoomState('not_entered');
        setRoom(null);
        setUser(null);
      }
    });

    // 回合开始
    newSocket.on('round_started', (data: {
      room_id: string;
      start_time: number;
      round_number: number;
    }) => {
      setGameState(prev => ({
        ...prev,
        current_phase: 'active',
        round_active: true,
        round_number: data.round_number,
        start_time: data.start_time,
        first_clicker_id: null,
        winner: null,
      }));
    });

    // 点击响应
    newSocket.on('click_response', (data: {
      success: boolean;
      is_first_click: boolean;
      server_timestamp: number;
      reaction_time_ms: number | null;
      error?: string;
    }) => {
      if (!data.success) {
        setError(data.error || '点击失败');
      }
    });

    // 回合锁定
    newSocket.on('round_locked', (data: {
      first_clicker_id: string;
      first_clicker_name: string;
      server_timestamp: number;
    }) => {
      setGameState(prev => ({
        ...prev,
        current_phase: 'locked',
        first_clicker_id: data.first_clicker_id,
      }));
    });

    // 回合结果
    newSocket.on('round_result', (data: {
      winner_id: string;
      winner_name: string;
      reaction_time_ms: number;
      click_logs: ClickLog[];
    }) => {
      setGameState(prev => ({
        ...prev,
        current_phase: 'result',
        round_active: false,
        end_time: Date.now(),
        winner: {
          player_id: data.winner_id,
          player_name: data.winner_name,
          reaction_time_ms: data.reaction_time_ms,
        },
      }));
    });

    // 回合重置
    newSocket.on('round_reset', (data: { room_id: string }) => {
      setGameState(prev => ({
        ...prev,
        current_phase: 'waiting',
        round_active: false,
        first_clicker_id: null,
        start_time: null,
        end_time: null,
        winner: null,
      }));
    });

    // 主持人转移
    newSocket.on('host_transferred', (data: {
      new_host_id: string;
      new_host_name: string;
    }) => {
      setUser(prev => {
        if (prev && prev.id === data.new_host_id) {
          return { ...prev, is_host: true };
        }
        return prev;
      });
    });

    // 离开房间响应
    newSocket.on('leave_room_response', (data: {
      success: boolean;
      message: string;
      redirect_to: string;
      error?: string;
    }) => {
      if (data.success) {
        setRoomState('not_entered');
        setRoom(null);
        setUser(null);
        setGameState({
          current_phase: 'waiting',
          round_active: false,
          round_number: 0,
          first_clicker_id: null,
          start_time: null,
          end_time: null,
          winner: null,
        });
        setPlayers([]);
      } else {
        setError(data.error || '离开房间失败');
      }
    });

    setSocket(newSocket);

    return () => {
      console.log('清理WebSocket连接');
      newSocket.close();
    };
  }, []);

  const joinRoom = useCallback((password: string, playerName: string) => {
    if (!socket || !connected) {
      setError('未连接到服务器');
      return;
    }
    socket.emit('join_room', { password: password, player_name: playerName });
  }, [socket, connected]);

  const startRound = useCallback(() => {
    if (!socket || !room || !user) return;
    socket.emit('start_round', { room_id: room.id, player_id: user.id });
  }, [socket, room, user]);

  const clickBuzzer = useCallback(() => {
    if (!socket || !room || !user) return;
    socket.emit('player_click', {
      player_id: user.id,
      room_id: room.id,
      client_timestamp: Date.now(),
    });
  }, [socket, room, user]);

  const resetRound = useCallback(() => {
    if (!socket || !room || !user) return;
    socket.emit('reset_round', { room_id: room.id, player_id: user.id });
  }, [socket, room, user]);

  const leaveRoom = useCallback(() => {
    if (!socket || !room || !user) return;
    socket.emit('leave_room', { player_id: user.id, room_id: room.id });
  }, [socket, room, user]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        connected,
        user,
        room,
        roomState,
        gameState,
        players,
        error,
        joinRoom,
        startRound,
        clickBuzzer,
        resetRound,
        leaveRoom,
        setError,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
