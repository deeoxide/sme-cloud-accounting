import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { eventsApi } from '../../services/api';

export default function EventCreate() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [maxAttendees, setMaxAttendees] = useState(4);
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [createdEventId, setCreatedEventId] = useState('');

  const createEvent = useMutation({
    mutationFn: () => eventsApi.create({ bookingId: bookingId!, title, description, maxAttendees }),
    onSuccess: (data) => {
      setInviteLink(data.inviteLink);
      setCreatedEventId(data.event.id);
    },
  });

  const copyLink = async () => {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareViaLine = () => {
    const text = `🎉 ${title}\nJoin me! ${inviteLink}`;
    window.open(`https://line.me/R/msg/text/?${encodeURIComponent(text)}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-lg mx-auto">
        <button onClick={() => navigate(-1)} className="mb-4 text-gray-600 flex items-center gap-2 font-medium">
          ← Back
        </button>

        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Create Party Event</h1>
          <p className="text-gray-500 mb-6">Invite friends to join your booking</p>

          {!inviteLink ? (
            <form
              onSubmit={(e) => { e.preventDefault(); createEvent.mutate(); }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Event Name</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Friday Night Dinner 🍽"
                  required
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Come join us for an awesome night!"
                  rows={3}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Attendees: <span className="text-blue-600 font-bold">{maxAttendees}</span>
                </label>
                <div className="flex items-center gap-4">
                  <button type="button" onClick={() => setMaxAttendees(Math.max(2, maxAttendees - 1))}
                    className="w-10 h-10 rounded-full bg-gray-100 font-bold text-lg hover:bg-gray-200">
                    -
                  </button>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full">
                    <div
                      className="h-2 bg-blue-500 rounded-full transition-all"
                      style={{ width: `${(maxAttendees / 20) * 100}%` }}
                    />
                  </div>
                  <button type="button" onClick={() => setMaxAttendees(Math.min(20, maxAttendees + 1))}
                    className="w-10 h-10 rounded-full bg-gray-100 font-bold text-lg hover:bg-gray-200">
                    +
                  </button>
                </div>
              </div>

              {createEvent.isError && (
                <p className="text-red-500 text-sm">(createEvent.error as any)?.response?.data?.error ?? 'Failed to create event'</p>
              )}

              <button
                type="submit"
                disabled={createEvent.isPending || !title.trim()}
                className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {createEvent.isPending ? 'Creating...' : 'Create Event & Get Invite Link'}
              </button>
            </form>
          ) : (
            <div className="space-y-5">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <div className="text-4xl mb-2">🎉</div>
                <p className="text-green-800 font-semibold text-lg">Event Created!</p>
                <p className="text-green-600 text-sm mt-1">Share the link below to invite your friends</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Invite Link</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inviteLink}
                    readOnly
                    className="flex-1 border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 text-sm text-gray-600"
                  />
                  <button
                    onClick={copyLink}
                    className={`px-4 py-3 rounded-xl font-medium whitespace-nowrap transition-colors ${
                      copied ? 'bg-green-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {copied ? '✓ Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={shareViaLine}
                  className="bg-green-500 text-white py-3 rounded-xl font-medium hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                >
                  <span>💬</span> Share via LINE
                </button>
                <button
                  onClick={() => navigate(`/events/${createdEventId}`)}
                  className="bg-gray-100 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                >
                  View Event
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
