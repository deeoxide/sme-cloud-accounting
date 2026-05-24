import { useNavigate } from 'react-router-dom';
import { useLoyaltyAccount, useRewards, useRedeemPoints } from '../../hooks/useLoyalty';
import LoyaltyProgress from '../../components/loyalty/LoyaltyProgress';
import StampCard from '../../components/loyalty/StampCard';

const TIER_GRADIENT: Record<string, string> = {
  BRONZE:   'from-amber-600 to-amber-800',
  SILVER:   'from-gray-400 to-gray-600',
  GOLD:     'from-yellow-400 to-yellow-600',
  PLATINUM: 'from-purple-500 to-purple-800',
};

const TIER_EMOJI: Record<string, string> = {
  BRONZE: '🥉', SILVER: '🥈', GOLD: '🥇', PLATINUM: '💎',
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: loyaltyData, isLoading } = useLoyaltyAccount();
  const { data: rewardData } = useRewards();
  const redeemMutation = useRedeemPoints();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const { account, nextMilestone } = loyaltyData ?? {};
  const tier = account?.tier ?? 'BRONZE';

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Header */}
      <div className={`bg-gradient-to-br ${TIER_GRADIENT[tier]} p-6 pb-14`}>
        <div className="flex items-center gap-2 mb-1">
          <button onClick={() => navigate(-1)} className="text-white/70 font-medium text-sm">←</button>
          <h1 className="text-white text-xl font-bold ml-1">My Rewards</h1>
        </div>
        <div className="mt-4 bg-white/20 backdrop-blur rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/70 text-sm">Available Points</p>
              <p className="text-white text-4xl font-bold">
                {account?.availablePoints?.toLocaleString() ?? 0}
              </p>
            </div>
            <div className="text-right">
              <span className="text-4xl">{TIER_EMOJI[tier]}</span>
              <p className="text-white/80 text-sm font-medium mt-1">{tier} Member</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-white/20 flex gap-6 text-sm">
            <div>
              <p className="text-white/60">Successful Trips</p>
              <p className="text-white font-bold">{account?.successfulTrips ?? 0}</p>
            </div>
            <div>
              <p className="text-white/60">Lifetime Points</p>
              <p className="text-white font-bold">{account?.lifetimePoints?.toLocaleString() ?? 0}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="-mt-8 px-4 space-y-4">
        {/* Milestone Progress */}
        {nextMilestone && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-bold text-gray-900">Next Milestone</h2>
              <span className="text-blue-600 font-semibold text-sm">+{nextMilestone.points.toLocaleString()} pts</span>
            </div>
            <LoyaltyProgress
              current={account?.successfulTrips ?? 0}
              target={nextMilestone.trips}
              label={`${nextMilestone.tripsRemaining} more trip${nextMilestone.tripsRemaining !== 1 ? 's' : ''} to go!`}
            />
            <p className="text-center text-xs text-gray-400 mt-2">{nextMilestone.description}</p>
          </div>
        )}

        {/* Stamp Card */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-bold text-gray-900 mb-4">Trip Stamps</h2>
          <StampCard completedTrips={account?.successfulTrips ?? 0} />
        </div>

        {/* Rewards Catalog */}
        {rewardData?.rewards?.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h2 className="font-bold text-gray-900 mb-4">Redeem Rewards</h2>
            <div className="space-y-3">
              {rewardData.rewards.map((reward: any) => {
                const canAfford = (account?.availablePoints ?? 0) >= reward.pointsCost;
                return (
                  <div key={reward.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl">
                    <div>
                      <p className="font-medium text-gray-900">{reward.title}</p>
                      <p className="text-xs text-gray-500">{reward.description}</p>
                      <p className="text-sm text-blue-600 font-semibold mt-1">{reward.pointsCost.toLocaleString()} pts</p>
                    </div>
                    <button
                      onClick={() => redeemMutation.mutate({ rewardId: reward.id })}
                      disabled={!canAfford || redeemMutation.isPending}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                        canAfford
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      Redeem
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent Transactions */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-bold text-gray-900 mb-4">Point History</h2>
          {account?.transactions?.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">No transactions yet. Start by booking a table!</p>
          ) : (
            <div className="space-y-3">
              {account?.transactions?.map((tx: any) => (
                <div key={tx.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{tx.description}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(tx.createdAt).toLocaleDateString('th-TH')}
                    </p>
                  </div>
                  <span className={`font-bold text-sm ${
                    tx.points > 0 ? 'text-green-600' : 'text-red-500'
                  }`}>
                    {tx.points > 0 ? '+' : ''}{tx.points.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
