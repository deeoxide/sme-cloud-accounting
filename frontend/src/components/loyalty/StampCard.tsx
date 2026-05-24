interface Props {
  completedTrips: number;
  totalStamps?: number;
}

export default function StampCard({ completedTrips, totalStamps = 10 }: Props) {
  const stamps = Array.from({ length: totalStamps }, (_, i) => i < completedTrips);
  const isComplete = completedTrips >= totalStamps;

  return (
    <div className={`rounded-xl p-4 border ${
      isComplete ? 'bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200' : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100'
    }`}>
      <div className="grid grid-cols-5 gap-2">
        {stamps.map((filled, i) => (
          <div
            key={i}
            className={`aspect-square rounded-xl flex items-center justify-center text-xl transition-all duration-300 ${
              filled
                ? 'bg-blue-600 shadow-lg shadow-blue-200 scale-105'
                : 'bg-white border-2 border-dashed border-blue-200'
            }`}
          >
            {filled ? (
              <span className="text-white">★</span>
            ) : (
              <span className="text-blue-200">☆</span>
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 text-center">
        {isComplete ? (
          <p className="text-amber-700 font-bold">🎉 Milestone Reached! Claim your 1,000 pts bonus!</p>
        ) : (
          <p className="text-gray-500 text-sm">
            {completedTrips}/{totalStamps} stamps —
            <span className="text-blue-600 font-medium"> {totalStamps - completedTrips} more to bonus!</span>
          </p>
        )}
      </div>
    </div>
  );
}
