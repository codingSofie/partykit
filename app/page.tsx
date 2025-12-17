'use client';

import { useSocket } from './hooks/useSocket';
import LoginPage from './login/page';
import GameRoom from './game/page';

export default function Home() {
  const { roomState } = useSocket();

  if (roomState === 'entered') {
    return <GameRoom />;
  }

  return <LoginPage />;
}
