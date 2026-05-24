# Partner Settlement Flow

## Overview

When a user redeems points for a voucher and uses it at a Partner venue, the platform needs to:
1. Track the discount given to the customer
2. Collect reimbursement from the venue
3. Deduct platform commission

---

## Flow Diagram

```
┌────────────┐  redeem 500pts   ┌─────────────────┐
│   USER     │ ───────────────→ │   PLATFORM     │
└────────────┘                └─────────────────┘
       │                               │
       │ present voucher code          │ Voucher: ISSUED
       │                               │
       ▼                               ▼
┌────────────┐  scan & confirm   ┌─────────────────┐
│  VENUE A   │ ───────────────→ │   PLATFORM     │
└────────────┘                └─────────────────┘
                               Voucher: USED
                               discountValue = 100 THB

──────────── END OF MONTH: SETTLEMENT BATCH ────────────

Platform runs POST /settlement/batch:
  venueId     = venue_A
  periodStart = 2026-05-01
  periodEnd   = 2026-05-31

Collect all USED vouchers for Venue A in period:
  10 redemptions x 100 THB = 1,000 THB total discount

Apply PartnerCampaign.platformFeeRate = 15%:
  Platform Fee  = 1,000 x 0.15 = 150 THB
  Venue Payable = 1,000 - 150  = 850 THB

Create SettlementBatch (status: PENDING)
  → Send PDF invoice to Venue A
  → Venue A transfers 850 THB to Platform
  → Platform updates batch status: COMPLETED
```

---

## Alternative: Escrow Model

For higher-trust partners:

```
1. Venue A deposits budget escrow (e.g., 5,000 THB) when joining campaign
2. Each redemption deducts from escrow automatically:
   Platform updates PartnerCampaign.spentAmount += discountValue
3. When spentAmount >= budgetAmount:
   Campaign auto-paused, vouchers for this venue stop being issued
4. Settlement = reconcile actual discounts vs. escrow balance
   Platform keeps 15%, returns remainder or invoices difference
```

---

## Financial Data Model

```
PartnerCampaign
  budgetAmount    = 10,000.00 THB  (venue's max exposure)
  spentAmount     = 850.00 THB     (running total)
  platformFeeRate = 0.1500         (15%)

SettlementBatch
  totalRedemptions = 10
  totalDiscount    = 1,000.00 THB
  platformFee      =   150.00 THB  (platform keeps this)
  venuePayable     =   850.00 THB  (venue owes this)
  status           = PENDING | COMPLETED
```

---

## Dispute Resolution

- Venue can flag a batch as `DISPUTED` within 7 days
- Platform reviews FraudLog + VoucherRedemption audit trail
- If fraud found: reverse charge, ban user, adjust batch
- If platform error: reissue corrected batch
