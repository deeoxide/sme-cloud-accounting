// Placeholder notification service.
// Replace with Firebase FCM / LINE Notify / SMS integrations in production.

export const notificationService = {
  async sendQueueAlert(userId: string, queueNumber: number, venueName: string): Promise<void> {
    console.log(`[Notify] User ${userId}: Queue #${queueNumber} at ${venueName} is almost ready!`);
  },

  async sendEventInvite(
    userId: string,
    eventTitle: string,
    hostName: string,
    inviteLink: string
  ): Promise<void> {
    console.log(`[Notify] User ${userId}: ${hostName} invited you to "${eventTitle}" — ${inviteLink}`);
  },

  async sendMilestoneReached(userId: string, trips: number, pointsEarned: number): Promise<void> {
    console.log(`[Notify] User ${userId}: Milestone! ${trips} trips — earned ${pointsEarned} pts`);
  },

  async sendVoucherExpirySoon(userId: string, code: string, daysLeft: number): Promise<void> {
    console.log(`[Notify] User ${userId}: Voucher ${code} expires in ${daysLeft} days`);
  },
};
