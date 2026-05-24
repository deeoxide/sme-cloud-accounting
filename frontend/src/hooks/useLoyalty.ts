import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { loyaltyApi } from '../services/api';

export const useLoyaltyAccount = () =>
  useQuery({ queryKey: ['loyalty', 'account'], queryFn: loyaltyApi.getAccount });

export const useRewards = () =>
  useQuery({ queryKey: ['loyalty', 'rewards'], queryFn: loyaltyApi.getRewards });

export const useRedeemPoints = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ rewardId, venueId }: { rewardId: string; venueId?: string }) =>
      loyaltyApi.redeem(rewardId, venueId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loyalty'] }),
  });
};
