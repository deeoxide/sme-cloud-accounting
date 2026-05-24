import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { eventsApi } from '../../services/api';
import { useSocket } from '../../hooks/useSocket';

export default function EventInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const socket = useSocket();
  const queryClient = useQueryClient();
  const [joinError, setJoinError] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['event', 'invite', token],
    queryFn: () => eventsApi.getByToken(token!),
    enabled: !!token,
  });

  const joinEvent = useMutation({
    mutationFn: () => eventsApi.joinByToken(token!),
    onSuccess: (res) => navigate(`/events/${res.event.id}`),
    onError: (err: any) => setJoinError(err.response?.data?.error ?? 'Failed to join event'),
  });

  useEffect(() => {
    if (!socket || !data?.event?.id) return;
    socket.emit('event:subscribe', data.event.id);

    socket.on('attendee:joined', () => {
      queryClient.invalidateQueries({ queryKey: ['event', 'invite', token] });
    });

    return () => { socket.off('attendee:joined'); };
  }, [socket, data?.event?.id, token, queryClient]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !data?.event) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="text-5xl">🔗</div>
        <h2 className="text-xl font-bold text-gray-800">Event not found</h2>
        <p className="text-gray-500">This invite link may have expired or been cancelled.</p>
      </div>
    );
  }

  const { event } = data;
  const accepted = event.attendees.filter((a: any) => a.status === 'ACCEPTED');
  const isFull = accepted.length >= event.maxAttendees;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-600 to-blue-800 p-4">
      <div className="max-w-lg mx-auto pt-8">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {event.booking.venue.imageUrls?.[0] ? (
            <img
              src={event.booking.venue.imageUrls[0]}
              alt={event.booking.venue.name}
              className="w-full h-44 object-cover"
            />
          ) : (
            <div className="w-full h-44 bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-6xl">
              🍽
            </div>
          )}

          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-700">
                {event.host.name[0].toUpperCase()}
              </div>
              <p className="text-sm text-gray-500">
                <span className="font-semibold text-gray-800">{event.host.name}</span> is inviting you
              </p>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-1">{event.title}</h1>
            {event.description && <p className="text-gray-500 text-sm mb-4">{event.description}</p>}

            <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <span>🏢</span><span className="font-medium">{event.booking.venue.name}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>📍</span><span>{event.booking.venue.address}</span>
              </div>
              {event.booking.queueSlot && (
                <div className="flex items-center gap-2 text-sm text-blue-600 font-medium">
                  <span>🎫</span>
                  <span>Queue #{event.booking.queueSlot.queueNumber} — ~{event.booking.queueSlot.estimatedWait} min wait</span>
                </div>
              )}
            </div>

            <div className="mb-5">
              <p className="text-sm text-gray-500 mb-2">
                <span className="font-semibold text-gray-800">{accepted.length}</span>/{event.maxAttendees} friends joined
              </p>
              <div className="flex -space-x-2">
                {accepted.map((a: any) => (
                  <div
                    key={a.id}
                    className="w-8 h-8 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center text-xs font-bold text-blue-700"
                    title={a.user.name}
                  >
                    {a.user.name[0].toUpperCase()}
                  </div>
                ))}
              </div>
            </div>

            {joinError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-4 text-sm">
                {joinError}
              </div>
            )}

            <button
              onClick={() => joinEvent.mutate()}
              disabled={joinEvent.isPending || isFull}
              className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 disabled:opacity-50 active:scale-[0.98] transition-all"
            >
              {joinEvent.isPending ? 'Joining...' : isFull ? 'Event is Full' : '🎉 Join the Party!'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
