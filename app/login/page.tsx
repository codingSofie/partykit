'use client';

import { useState, useRef } from 'react';
import { useSocket } from '../hooks/useSocket';

export default function LoginPage() {
  const { joinRoom, error, setError, connected } = useSocket();
  const [playerName, setPlayerName] = useState('');
  const [password, setPassword] = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const passwordInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const handlePasswordChange = (index: number, value: string) => {
    // 只允许数字和大写字母
    const sanitized = value.toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (sanitized.length > 1) {
      return; // 只允许单个字符
    }
    
    const newPassword = [...password];
    newPassword[index] = sanitized;
    setPassword(newPassword);
    setError(null);
    
    // 自动聚焦到下一个输入框
    if (sanitized && index < 3) {
      passwordInputRefs[index + 1].current?.focus();
    }
  };

  const handlePasswordKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // 处理退格键
    if (e.key === 'Backspace' && !password[index] && index > 0) {
      passwordInputRefs[index - 1].current?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text').toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 4);
    const newPassword = ['', '', '', ''];
    for (let i = 0; i < pastedText.length && i < 4; i++) {
      newPassword[i] = pastedText[i];
    }
    setPassword(newPassword);
    // 聚焦到最后一个有值的输入框或第一个空输入框
    const focusIndex = Math.min(pastedText.length, 3);
    passwordInputRefs[focusIndex].current?.focus();
  };

  const getPasswordString = () => {
    return password.join('').toUpperCase();
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!playerName.trim()) {
      setError('請輸入玩家名稱');
      return;
    }
    
    if (playerName.length > 20) {
      setError('玩家名稱不能超過20個字符');
      return;
    }
    
    const passwordStr = getPasswordString();
    
    // 只检查长度是否为4
    if (passwordStr.length !== 4) {
      setError('請輸入4位房間密碼');
      return;
    }
    
    if (!connected) {
      setError('未連接到服務器，請稍後再試');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    // 发送加入房间请求（如果房间不存在会自动创建）
    joinRoom(passwordStr, playerName.trim());
    
    setTimeout(() => setLoading(false), 2000);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="mb-8 text-center text-3xl font-bold text-gray-800">
          搶答派對
        </h1>
        
        {!connected && (
          <div className="mb-4 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800">
            正在連接到服務器...
          </div>
        )}
        
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}
        
        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label htmlFor="playerName" className="mb-2 block text-sm font-medium text-gray-700">
              玩家名稱
            </label>
            <input
              id="playerName"
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength={20}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="輸入您的名稱"
              required
            />
          </div>
          
          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-medium text-gray-700">
              房間密碼（4位數字或大寫字母）
            </label>
            <div className="flex gap-2" onPaste={handlePaste}>
              {[0, 1, 2, 3].map((index) => (
                <input
                  key={index}
                  ref={passwordInputRefs[index]}
                  type="text"
                  inputMode="text"
                  maxLength={1}
                  value={password[index]}
                  onChange={(e) => handlePasswordChange(index, e.target.value)}
                  onKeyDown={(e) => handlePasswordKeyDown(index, e)}
                  className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 text-center text-2xl font-bold text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder=""
                  required
                  autoComplete="off"
                />
              ))}
            </div>
          </div>
          
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading || !connected || getPasswordString().length !== 4}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? '處理中...' : '進入房間'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
