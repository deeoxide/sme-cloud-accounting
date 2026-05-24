# Anti-Fraud Mechanisms

## Threat Model

| Threat | Description |
|---|---|
| Ghost accounts | Creating fake accounts to spam queue / farm points |
| Self-invite abuse | Host creates multiple accounts, invites themselves to boost trip count |
| Venue collusion | Partner venue staff marks fake check-ins to let friends earn points |
| Voucher sharing | One user redeems, shares voucher code with multiple people |
| IP farming | Single IP creates many accounts for bulk point farming |

---

## Layer 1: Account Creation Hardening

```
Phone OTP verification (mandatory before first booking)
└─ Prevents bulk account creation with disposable emails
└─ 1 phone = 1 account enforced at DB level (unique constraint)

Device fingerprinting (stored in User.deviceFingerprint)
└─ If 1 device registers >3 accounts → fraud score +40, manual review
└─ Stored in Redis: fraud:device:users:{deviceId} (SET)

Account age gate
└─ Accounts < 7 days old cannot earn loyalty points
└─ Accounts < 24h old get +15 fraud score on each booking
```

---

## Layer 2: Booking-Time Checks (`antifraudService.assessRisk`)

### Risk Score Calculation

| Signal | Points Added |
|---|---|
| IP sent >20 requests/action/hour | +40 |
| IP sent >10 requests/action/hour | +20 |
| IP in flagged list | +50 |
| Device used by >3 accounts (24h) | +40 |
| Device made >10 requests (24h) | +30 |
| Account age < 1 hour | +30 |
| Account age < 24 hours | +15 |
| Phone not verified | +10 |
| Existing fraud score | +user.fraudScore |

**Score ≥ 80 → request blocked (403)**  
**Score 40–79 → logged to FraudLog, human review queue**

### Self-Invite Detection

```typescript
// On every join, check if host and friend share a device
const hostDevices  = await redis.smembers(`fraud:user:devices:${hostId}`);
const guestDevices = await redis.smembers(`fraud:user:devices:${attendeeId}`);
if (intersection) return 403;
```

---

## Layer 3: Event Completion Validation

Before awarding loyalty points, the system checks:

1. **Check-in ratio**: ≥ 80% of `ACCEPTED` attendees must have status `CHECKED_IN`
2. **Host account age**: Must be ≥ 7 days old
3. **Host fraud score**: Must be < 60
4. **Venue confirmation**: Booking status must be set to `CHECKED_IN` by venue staff, not self-reported alone

### Venue Staff Role
- Staff use a separate Dashboard to mark customers as **Seated**
- This triggers the queue to advance and optionally flags attendees as checked in
- Self-check-in alone is NOT sufficient for loyalty award

---

## Layer 4: Voucher Redemption Security

```
Voucher Code: UUID (single-use, non-guessable)
  └─ Status machine: ISSUED → USED (irreversible)
  └─ Expiry date enforced server-side
  └─ Staff must scan/enter code at POS; audit log records staff ID + timestamp
  └─ High-value redemptions (>500 pts) queued for manual review
```

---

## Layer 5: Monitoring & Response

```
FraudLog table → alerts admin when:
  - Same IP hits 3+ different users in 1 hour
  - Device used by >3 accounts in 24h
  - User earns >500 pts in 7 days

Admin actions:
  antifraudService.flagIP(ip, reason)    → flag for 7 days
  antifraudService.banUser(userId)        → permanent ban + invalidate tokens
```
