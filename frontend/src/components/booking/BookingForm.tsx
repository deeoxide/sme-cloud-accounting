import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { bookingsApi } from '../../services/api';

interface Props {
  venueId: string;
  venueName: string;
  onClose: () => void;
  onBooked: (bookingId: string) => void;
}

export default function BookingForm({ venueId, venueName, onClose, onBooked }: Props) {
  const [partySize, setPartySize] = useState(2);
  const [bookingType, setBookingType] = useState<'WALK_IN_QUEUE' | 'ADVANCE_RESERVATION'>('WALK_IN_QUEUE');

  const createBooking = useMutation({
    mutationFn: () => bookingsApi.create({ venueId, partySize, bookingType }),
    onSuccess: (data) => onBooked(data.booking.id),
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50" onClick={onClose}>
      <div
        className="bg-white rounded-t-3xl w-full p-6 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-5" />
        <h2 className="text-xl font-bold text-gray-900 mb-1">Book at {venueName}</h2>
        <p className="text-gray-500 text-sm mb-5">Select booking type and party size</p>

        <div className="grid grid-cols-2 gap-3 mb-5">
          {(['WALK_IN_QUEUE', 'ADVANCE_RESERVATION'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setBookingType(type)}
              className={`p-4 rounded-xl border-2 text-left transition-colors ${
                bookingType === type
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-2xl mb-2">{type === 'WALK_IN_QUEUE' ? '🎫' : '📅'}</div>
              <p className="font-semibold text-sm text-gray-900">
                {type === 'WALK_IN_QUEUE' ? 'Walk-in Queue' : 'Reserve Ahead'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {type === 'WALK_IN_QUEUE' ? 'Join the live queue now' : 'Schedule for later'}
              </p>
            </button>
          ))}
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Party Size
          </label>
          <div className="flex items-center justify-center gap-6">
            <button
              onClick={() => setPartySize(Math.max(1, partySize - 1))}
              className="w-12 h-12 rounded-full bg-gray-100 font-bold text-xl hover:bg-gray-200 active:scale-95 transition-all"
            >
              −
            </button>
            <div className="text-center">
              <span className="text-4xl font-bold text-blue-600">{partySize}</span>
              <p className="text-xs text-gray-400 mt-1">people</p>
            </div>
            <button
              onClick={() => setPartySize(Math.min(20, partySize + 1))}
              className="w-12 h-12 rounded-full bg-gray-100 font-bold text-xl hover:bg-gray-200 active:scale-95 transition-all"
            >
              +
            </button>
          </div>
        </div>

        {createBooking.isError && (
          <p className="text-red-500 text-sm mb-4 text-center">
            {(createBooking.error as any)?.response?.data?.error ?? 'Booking failed. Please try again.'}
          </p>
        )}

        <button
          onClick={() => createBooking.mutate()}
          disabled={createBooking.isPending}
          className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-blue-700 disabled:opacity-50 active:scale-[0.98] transition-all"
        >
          {createBooking.isPending ? 'Processing...' : 'Confirm Booking'}
        </button>
      </div>
    </div>
  );
}
