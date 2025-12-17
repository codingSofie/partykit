'use client';

import { SocketProvider } from './hooks/useSocket';

export default function Providers({ children }: { children: React.ReactNode }) {
  return <SocketProvider>{children}</SocketProvider>;
}



