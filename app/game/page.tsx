'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useSocket } from '../hooks/useSocket';
import { useRouter } from 'next/navigation';

export default function GameRoom() {
  const router = useRouter();
  const {
    user,
    room,
    gameState,
    connected,
    error,
    startRound,
    clickBuzzer,
    resetRound,
    leaveRoom,
    setError,
  } = useSocket();

  const [buttonState, setButtonState] = useState<'default' | 'first_clicker' | 'others_after_first' | 'disabled'>('disabled');
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  useEffect(() => {
    if (!user || !room) {
      router.push('/login');
      return;
    }
  }, [user, room, router]);

  useEffect(() => {
    if (!gameState) return;

    // 根据游戏状态和用户状态更新按钮状态
    if (gameState.current_phase === 'waiting') {
      setButtonState('disabled');
    } else if (gameState.current_phase === 'active') {
      setButtonState('default');
    } else if (gameState.current_phase === 'locked' || gameState.current_phase === 'result') {
      if (user && gameState.first_clicker_id === user.id) {
        setButtonState('first_clicker');
      } else {
        setButtonState('others_after_first');
      }
    }
  }, [gameState, user]);

  const handleLeaveRoom = () => {
    if (showLeaveConfirm) {
      leaveRoom();
      router.push('/login');
    } else {
      setShowLeaveConfirm(true);
    }
  };

  const getButtonImage = () => {
    switch (buttonState) {
      case 'default':
        return '/asset/buttons/button_white.png';
      case 'first_clicker':
        return '/asset/buttons/button_green.png';
      case 'others_after_first':
        return '/asset/buttons/button_red.png';
      case 'disabled':
        return '/asset/buttons/button_white.png';
      default:
        return '/asset/buttons/button_white.png';
    }
  };

  const getButtonText = () => {
    switch (buttonState) {
      case 'default':
        return '按我搶答!';
      case 'first_clicker':
        return '你最快!';
      case 'others_after_first':
        return '太慢了!';
      case 'disabled':
        return '';
      default:
        return '';
    }
  };

  const getStatusMessage = () => {
    if (!gameState) return '';
    
    switch (gameState.current_phase) {
      case 'waiting':
        return '請等待主持人開始...';
      case 'active':
        return '開始搶答!';
      case 'locked':
        return '搶答結束!';
      case 'result':
        if (gameState.winner) {
          if (user && gameState.winner.player_id === user.id) {
            return `恭喜你最快！反應時間: ${gameState.winner.reaction_time_ms}ms`;
          } else {
            return `${gameState.winner.player_name} 最快！反應時間: ${gameState.winner.reaction_time_ms}ms`;
          }
        }
        return '搶答結束!';
      default:
        return '';
    }
  };

  if (!user || !room) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-blue-50 to-purple-50">
      {/* Header */}
      <header className="flex items-center justify-between bg-white px-6 py-4 shadow-md">
        <div className="flex items-center gap-4">
          <div>
            <div className="text-sm text-gray-600">房間名稱</div>
            <div className="text-2xl font-bold text-gray-800 tracking-wider">
              {room.password || '----'}
            </div>
          </div>
          {user.is_host && (
            <div className="flex items-center gap-2 rounded-full bg-yellow-100 px-3 py-1">
              <Image
                src="/asset/icons/host.png"
                alt="主持人"
                width={20}
                height={20}
              />
              <span className="text-sm font-medium text-yellow-800">主持人</span>
            </div>
          )}
        </div>
        
        <button
          onClick={handleLeaveRoom}
          className="rounded-lg bg-red-500 px-4 py-2 text-white transition-colors hover:bg-red-600"
        >
          {showLeaveConfirm ? '確認退出？' : '退出房間'}
        </button>
      </header>

      {/* Error Display */}
      {error && (
        <div className="mx-4 mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Connection Status */}
      {!connected && (
        <div className="mx-4 mt-4 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800">
          連接中斷，正在重新連接...
        </div>
      )}

      {/* Host Controls */}
      {user.is_host && (
        <div className="mx-4 mt-4 flex gap-3">
          {gameState.current_phase === 'waiting' && (
            <button
              onClick={startRound}
              disabled={!connected || gameState.current_phase !== 'waiting'}
              className="flex-1 rounded-lg bg-green-600 px-6 py-3 font-medium text-white transition-colors hover:bg-green-700 disabled:bg-gray-400"
            >
              開始
            </button>
          )}
          {(gameState.current_phase === 'result' || gameState.current_phase === 'waiting') && (
            <button
              onClick={resetRound}
              disabled={!connected || (gameState.current_phase !== 'result' && gameState.current_phase !== 'waiting')}
              className="flex-1 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-gray-400"
            >
              重新開始
            </button>
          )}
        </div>
      )}

      {/* Main Game Area */}
      <main className="flex flex-1 flex-col items-center justify-center p-8">
        {/* Status Message */}
        <div className="mb-8 text-center">
          <div className="text-2xl font-bold text-gray-800">
            {getStatusMessage()}
          </div>
          {gameState.round_number > 0 && (
            <div className="mt-2 text-sm text-gray-600">
              第 {gameState.round_number} 輪
            </div>
          )}
        </div>

        {/* Buzzer Button */}
        <div className="relative">
          <button
            onClick={clickBuzzer}
            disabled={
              buttonState === 'disabled' ||
              buttonState === 'first_clicker' ||
              buttonState === 'others_after_first' ||
              !connected ||
              gameState.current_phase !== 'active'
            }
            className={`relative transition-transform active:scale-95 ${
              buttonState === 'disabled' ||
              buttonState === 'first_clicker' ||
              buttonState === 'others_after_first'
                ? 'cursor-not-allowed opacity-70'
                : 'cursor-pointer hover:scale-105'
            }`}
          >
            <Image
              src={getButtonImage()}
              alt="搶答按鈕"
              width={300}
              height={300}
              className="rounded-full"
              priority
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span 
                className="text-2xl font-bold text-gray-800"
                style={buttonState === 'default' ? { fontSize: '0.7em' } : {}}
              >
                {getButtonText()}
              </span>
            </div>
          </button>
        </div>

        {/* Winner Display */}
        {gameState.current_phase === 'result' && gameState.winner && (
          <div className="mt-8 rounded-lg bg-white p-6 shadow-lg">
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-800">獲勝者</div>
              <div className="mt-2 text-3xl font-bold text-green-600">
                {gameState.winner.player_name}
              </div>
              {gameState.winner.reaction_time_ms !== null && (
                <div className="mt-2 text-sm text-gray-600">
                  反應時間: {gameState.winner.reaction_time_ms}ms
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}


