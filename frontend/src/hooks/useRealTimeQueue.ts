import { useState, useEffect } from 'react';
import { useSocket } from './useSocket';

interface QueueState {
  queueNumber: number;
  estimatedWait: number;
  status: 'WAITING' | 'CALLED' | 'SEATED';
  isCalled: boolean;
}

export const useRealTimeQueue = (
  venueId: string,
  initialState?: Partial<QueueState>,
  eventId?: string
): QueueState | null => {
  const socket = useSocket();
  const [queue, setQueue] = useState<QueueState | null>(
    initialState ? { status: 'WAITING', isCalled: false, queueNumber: 0, estimatedWait: 0, ...initialState } : null
  );

  useEffect(() => {
    if (!socket) return;

    socket.emit('venue:subscribe', venueId);
    if (eventId) socket.emit('event:subscribe', eventId);

    const onQueueUpdated = (data: { venueId: string }) => {
      if (data.venueId === venueId) {
        setQueue((prev) => prev ?? null);
      }
    };

    const onQueueCalled = () => {
      setQueue((prev) => prev ? { ...prev, status: 'CALLED', isCalled: true } : null);
    };

    socket.on('queue:updated', onQueueUpdated);
    socket.on('queue:called', onQueueCalled);

    return () => {
      socket.off('queue:updated', onQueueUpdated);
      socket.off('queue:called', onQueueCalled);
    };
  }, [socket, venueId, eventId]);

  return queue;
};
