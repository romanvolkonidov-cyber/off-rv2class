'use client';

import { io, Socket } from 'socket.io-client';

const SOCKET_URL = (process.env.NODE_ENV === 'production')
  ? 'https://158.220.94.77.sslip.io'
  : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000');

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('rv2class_token') : null;

    socket = io(SOCKET_URL, {
      auth: { token },
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }
  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) {
    // Update token before connecting
    const token = localStorage.getItem('rv2class_token');
    s.auth = { token };
    s.connect();
  }
  return s;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
