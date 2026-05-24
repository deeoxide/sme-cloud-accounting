interface Props {
  current: number;
  target: number;
  label: string;
}

export default function LoyaltyProgress({ current, target, label }: Props) {
  const pct = Math.min(Math.round((current / target) * 100), 100);

  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 mb-1.5">
        <span>{current} trips</span>
        <span>{target} trips</span>
      </div>
      <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-white drop-shadow">{pct}%</span>
        </div>
      </div>
      <p className="text-center text-sm text-gray-600 mt-2 font-medium">{label}</p>
    </div>
  );
}
