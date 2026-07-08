// ============================================================================
// Socket.io Client for Realtime Updates
// ============================================================================

import { io, Socket } from 'socket.io-client';
import { getAuthToken } from './api';

const SOCKET_URL = (import.meta as any).env?.VITE_SOCKET_URL || 'http://localhost:3000';

let socket: Socket | null = null;

// ============================================================================
// Connect to Socket.io Server
// ============================================================================

export function connectSocket(): Socket {
  if (socket?.connected) {
    return socket;
  }

  const token = getAuthToken();
  if (!token) {
    throw new Error('No authentication token found');
  }

  socket = io(SOCKET_URL, {
    auth: { token },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
  });

  // Connection events
  socket.on('connect', () => {
    console.log('✅ [Socket.io] Connected to server');
  });

  socket.on('disconnect', (reason) => {
    console.log('❌ [Socket.io] Disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('❌ [Socket.io] Connection error:', error.message);
  });

  socket.on('error', (error) => {
    console.error('❌ [Socket.io] Error:', error);
  });

  return socket;
}

// ============================================================================
// Disconnect from Server
// ============================================================================

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
    console.log('🔌 [Socket.io] Disconnected from server');
  }
}

// ============================================================================
// Subscribe to Events
// ============================================================================

export function subscribeToProducts(callback: (data: any) => void): () => void {
  if (!socket) connectSocket();

  socket!.emit('subscribe', 'products');
  
  socket!.on('product:created', callback);
  socket!.on('product:updated', callback);
  socket!.on('product:deleted', (id: string) => callback({ type: 'deleted', id }));

  // Cleanup function
  return () => {
    socket!.off('product:created', callback);
    socket!.off('product:updated', callback);
    socket!.off('product:deleted', callback);
    socket!.emit('unsubscribe', 'products');
  };
}

export function subscribeToOrders(callback: (data: any) => void): () => void {
  if (!socket) connectSocket();

  socket!.emit('subscribe', 'orders');
  
  socket!.on('order:created', callback);
  socket!.on('order:updated', callback);

  return () => {
    socket!.off('order:created', callback);
    socket!.off('order:updated', callback);
    socket!.emit('unsubscribe', 'orders');
  };
}

export function subscribeToSales(callback: (data: any) => void): () => void {
  if (!socket) connectSocket();

  socket!.emit('subscribe', 'sales');
  
  socket!.on('sale:created', callback);

  return () => {
    socket!.off('sale:created', callback);
    socket!.emit('unsubscribe', 'sales');
  };
}

export function subscribeToBroadcast(callback: (data: any) => void): () => void {
  if (!socket) connectSocket();

  socket!.emit('subscribe', 'broadcast');
  
  socket!.on('reload:triggered', callback);

  return () => {
    socket!.off('reload:triggered', callback);
    socket!.emit('unsubscribe', 'broadcast');
  };
}

export function subscribeToChat(callback: (data: any) => void): () => void {
  if (!socket) connectSocket();

  socket!.emit('subscribe', 'chat');
  
  socket!.on('message:new', callback);
  socket!.on('typing:start', callback);
  socket!.on('typing:stop', callback);

  return () => {
    socket!.off('message:new', callback);
    socket!.off('typing:start', callback);
    socket!.off('typing:stop', callback);
    socket!.emit('unsubscribe', 'chat');
  };
}

// ============================================================================
// Emit Events
// ============================================================================

export function emitTyping(isTyping: boolean): void {
  if (socket?.connected) {
    socket.emit('typing', { isTyping });
  }
}

// ============================================================================
// Get Socket Instance
// ============================================================================

export function getSocket(): Socket | null {
  return socket;
}

// ============================================================================
// React Hook for Socket.io
// ============================================================================

import { useEffect, useRef } from 'react';
import type { Socket as SocketType } from 'socket.io-client';

export function useSocket() {
  const socketRef = useRef(null as SocketType | null);

  useEffect(() => {
    socketRef.current = connectSocket();

    return () => {
      disconnectSocket();
    };
  }, []);

  return socketRef.current;
}

// ============================================================================
// React Hook for Product Updates
// ============================================================================

export function useProductUpdates(callback: (data: any) => void) {
  useEffect(() => {
    const unsubscribe = subscribeToProducts(callback);
    return unsubscribe;
  }, [callback]);
}

// ============================================================================
// React Hook for Order Updates
// ============================================================================

export function useOrderUpdates(callback: (data: any) => void) {
  useEffect(() => {
    const unsubscribe = subscribeToOrders(callback);
    return unsubscribe;
  }, [callback]);
}

// ============================================================================
// React Hook for Sales Updates
// ============================================================================

export function useSalesUpdates(callback: (data: any) => void) {
  useEffect(() => {
    const unsubscribe = subscribeToSales(callback);
    return unsubscribe;
  }, [callback]);
}

// ============================================================================
// React Hook for Broadcast Updates
// ============================================================================

export function useBroadcastUpdates(callback: (data: any) => void) {
  useEffect(() => {
    const unsubscribe = subscribeToBroadcast(callback);
    return unsubscribe;
  }, [callback]);
}

// ============================================================================
// React Hook for Chat Updates
// ============================================================================

export function useChatUpdates(callback: (data: any) => void) {
  useEffect(() => {
    const unsubscribe = subscribeToChat(callback);
    return unsubscribe;
  }, [callback]);
}

// ============================================================================
// Export all functions
// ============================================================================

export default {
  connectSocket,
  disconnectSocket,
  subscribeToProducts,
  subscribeToOrders,
  subscribeToSales,
  subscribeToBroadcast,
  subscribeToChat,
  emitTyping,
  getSocket,
  useSocket,
  useProductUpdates,
  useOrderUpdates,
  useSalesUpdates,
  useBroadcastUpdates,
  useChatUpdates,
};
