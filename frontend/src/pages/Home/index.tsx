import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { venuesApi } from '../../services/api';

const CATEGORIES = ['ALL', 'RESTAURANT', 'BAR', 'CAFE', 'CLUB', 'KARAOKE'];

const CATEGORY_EMOJI: Record<string, string> = {
  RESTAURANT: '🍽', BAR: '🍺', CAFE: '☕', CLUB: '🅸', KARAOKE: '🎤', OTHER: '🏢',
};

export default function Home() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');

  const { data, isLoading } = useQuery({
    queryKey: ['venues', category, search],
    queryFn: () => venuesApi.list({ category: category === 'ALL' ? undefined : category, search: search || undefined }),
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white sticky top-0 z-10 shadow-sm px-4 py-4">
        <div className="flex justify-between items-center mb-3">
          <h1 className="text-xl font-bold text-gray-900">Discover</h1>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-xl text-sm font-medium"
          >
            ⭐ Rewards
          </button>
        </div>
        <input
          type="text"
          placeholder="Search restaurants, bars, clubs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        />
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                category === cat ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl h-28 animate-pulse" />
            ))
          : data?.venues.map((venue: any) => (
              <div
                key={venue.id}
                onClick={() => navigate(`/venue/${venue.id}`)}
                className="bg-white rounded-2xl shadow-sm overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
              >
                <div className="flex">
                  <div className="w-28 h-28 bg-gray-200 flex-shrink-0 flex items-center justify-center text-4xl">
                    {venue.imageUrls?.[0] ? (
                      <img src={venue.imageUrls[0]} alt={venue.name} className="w-full h-full object-cover" />
                    ) : (
                      CATEGORY_EMOJI[venue.category] ?? '🏢'
                    )}
                  </div>
                  <div className="p-3 flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <h3 className="font-semibold text-gray-900 truncate">{venue.name}</h3>
                      {venue.isPartner && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                          Partner
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{venue.address}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs bg-orange-50 text-orange-600 px-2 py-1 rounded-lg font-medium">
                        ~{venue.avgWaitTime} min
                      </span>
                      <span className="text-xs text-gray-400">
                        {venue._count?.queueSlots ?? 0} in queue
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
      </div>
    </div>
  );
}
