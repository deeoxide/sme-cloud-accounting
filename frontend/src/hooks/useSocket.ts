import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

let sharedSocket: Socket | null = null;

export const useSocket = (): Socket | null => {
  const ref = useRef<Socket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    if (!sharedSocket || !sharedSocket.connected) {
      sharedSocket = io(import.meta.env.VITE_WS_URL || '', {
        auth: { token },
        transports: ['websocket'],
      });
    }

    ref.current = sharedSocket;
  }, []);

  return ref.current;
};
