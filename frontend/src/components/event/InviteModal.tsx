import { useState } from 'react';

interface Props {
  inviteLink: string;
  eventTitle: string;
  venueName: string;
  onClose: () => void;
}

export default function InviteModal({ inviteLink, eventTitle, venueName, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareViaLine = () => {
    const text = `🎉 ${eventTitle}\n📍 ${venueName}\nJoin me: ${inviteLink}`;
    window.open(`https://line.me/R/msg/text/?${encodeURIComponent(text)}`);
  };

  const shareNative = () => {
    if (navigator.share) {
      navigator.share({ title: eventTitle, text: `Join me at ${venueName}!`, url: inviteLink });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-t-3xl w-full max-w-lg p-6 animate-in slide-in-from-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-5" />

        <h2 className="text-xl font-bold text-gray-900 mb-1">Invite Friends</h2>
        <p className="text-gray-500 text-sm mb-5">
          Share to invite friends to <span className="font-medium text-gray-700">{eventTitle}</span>
        </p>

        <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-2 mb-4">
          <span className="flex-1 text-sm text-gray-600 truncate font-mono">{inviteLink}</span>
          <button
            onClick={copyLink}
            className={`text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
              copied ? 'bg-green-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            onClick={shareViaLine}
            className="bg-green-500 text-white py-3 rounded-xl font-medium hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
          >
            <span>💬</span> LINE
          </button>
          <button
            onClick={shareNative}
            className="bg-blue-100 text-blue-700 py-3 rounded-xl font-medium hover:bg-blue-200 transition-colors flex items-center justify-center gap-2"
          >
            <span>⇗</span> Share
          </button>
        </div>

        <button onClick={onClose} className="w-full py-3 text-gray-400 font-medium text-sm">
          Close
        </button>
      </div>
    </div>
  );
}
