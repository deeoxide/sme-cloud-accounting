import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { venuesApi } from '../../services/api';
import BookingForm from '../../components/booking/BookingForm';

export default function VenueDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showBooking, setShowBooking] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['venue', id],
    queryFn: () => venuesApi.getById(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!data?.venue) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Venue not found</div>;
  }

  const { venue } = data;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="relative">
        <div className="h-56 bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-7xl">
          {venue.imageUrls?.[0] ? (
            <img src={venue.imageUrls[0]} alt={venue.name} className="w-full h-full object-cover" />
          ) : (
            '🍽'
          )}
        </div>
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 bg-white/90 backdrop-blur rounded-full w-10 h-10 flex items-center justify-center shadow font-bold"
        >
          ←
        </button>
      </div>

      <div className="bg-white -mt-4 rounded-t-3xl p-5 pb-32">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{venue.name}</h1>
            <p className="text-gray-500 text-sm">{venue.category} · {venue.address}</p>
          </div>
          {venue.isPartner && (
            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap">
              Partner
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-orange-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-orange-600">{venue._count?.queueSlots ?? 0}</p>
            <p className="text-xs text-gray-500">In Queue</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-blue-600">~{venue.avgWaitTime}</p>
            <p className="text-xs text-gray-500">Min Wait</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-green-600">{venue.totalTables}</p>
            <p className="text-xs text-gray-500">Tables</p>
          </div>
        </div>

        {venue.description && (
          <p className="text-gray-600 text-sm mb-4 leading-relaxed">{venue.description}</p>
        )}

        <div className="space-y-2 mb-5 text-sm text-gray-600">
          <div className="flex items-center gap-3">
            <span>🕐</span>
            <span>{venue.openTime} – {venue.closeTime}</span>
          </div>
          <div className="flex items-center gap-3">
            <span>📞</span>
            <span>{venue.phone}</span>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">
        <button
          onClick={() => setShowBooking(true)}
          className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-blue-700 active:scale-[0.98] transition-all"
        >
          Join Queue / Reserve Table
        </button>
      </div>

      {showBooking && (
        <BookingForm
          venueId={id!}
          venueName={venue.name}
          onClose={() => setShowBooking(false)}
          onBooked={(bookingId) => navigate(`/events/create/${bookingId}`)}
        />
      )}
    </div>
  );
}
