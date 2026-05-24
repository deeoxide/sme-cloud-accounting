# Social Booking & Loyalty System

Platform สำหรับจองคิว/โต๊ะร้านอาหารและสถานบันเทิง พร้อมฟีเจอร์ Social Booking และระบบสะสมแต้ม Loyalty

---

## 1. User Journey / Flow Chart

### Host Flow
```
[User opens app]
    → Search / Browse Venues
    → Select Venue → View real-time queue count
    → Tap "Join Queue" or "Reserve Table"
        → Enter party size → Confirm Booking
        → Receive Queue Number (e.g. #23, ~30 min wait)
    → Tap "Create Party Event"
        → Enter event title + max attendees
        → System generates Invite Link (UUID token)
    → Share link via LINE / WhatsApp / copy
    → Monitor event page: see who accepted
    → Arrive at venue → Check In
        → System marks event COMPLETED
        → Loyalty points awarded to Host
```

### Friend (Attendee) Flow
```
[Friend receives invite link]
    → Opens link → Landing page shows:
        • Venue name + photo
        • Host name
        • Queue position + estimated wait
        • How many friends already joined
    → Tap "Join the Party!"
        → If not logged in → Quick register/login
        → Status changes to ACCEPTED
    → Real-time push to Host's screen: "[Name] joined!"
    → Both see live queue countdown
    → Arrive at venue → Check In
```

### Venue (Staff) Flow
```
[Venue opens Dashboard]
    → See queue list with party sizes
    → Tap "Call Next" → System notifies customer via push
    → Mark as Seated → Queue advances
    → View daily stats: avg wait time, no-shows
```

---

## 2. Database Schema

### Core Tables
| Table | Purpose |
|---|---|
| `User` | ผู้ใช้งาน พร้อม fraud score และ device fingerprint |
| `Venue` | ร้านค้า/สถานที่ พร้อม partner flag |
| `Table` | โต๊ะในร้าน และสถานะ |
| `QueueSlot` | คิวแบบ real-time |
| `Booking` | การจอง (walk-in หรือ advance) |
| `Event` | Party event ที่สร้างจาก booking |
| `EventAttendee` | เพื่อนที่รับคำเชิญ |

### Loyalty Tables
| Table | Purpose |
|---|---|
| `LoyaltyAccount` | บัญชีแต้ม + tier + จำนวนทริปสำเร็จ |
| `LoyaltyTransaction` | Point Ledger — บันทึกทุก earn/redeem |
| `RewardCatalog` | รายการรางวัลที่แลกได้ |
| `VoucherRedemption` | E-Voucher ที่ออกให้ผู้ใช้ |
| `PartnerCampaign` | แคมเปญของร้านค้า partner |
| `SettlementBatch` | รอบ settlement ระหว่างแพลตฟอร์มกับร้าน |

### Anti-Fraud Tables
| Table | Purpose |
|---|---|
| `FraudLog` | บันทึก risk events |

ดู Prisma schema ฉบับเต็มที่ `backend/prisma/schema.prisma`

---

## 3. Tech Stack Recommendation

| Layer | Technology | เหตุผล |
|---|---|---|
| **Frontend** | React 18 + TypeScript | Component-based, ง่ายต่อการทำ PWA |
| **Mobile/LINE** | React → LINE LIFF | ฝังใน LINE OA ได้ทันที via LIFF SDK |
| **Backend** | Node.js + Express + TypeScript | Ecosystem ใหญ่, async I/O ดีสำหรับ queue |
| **Database** | PostgreSQL + Prisma ORM | ACID transactions สำหรับ point ledger |
| **Real-time** | Socket.io | Queue updates, attendee joined events |
| **Cache/Queue** | Redis | Rate limiting, fraud detection, session |
| **Auth** | JWT + bcrypt | Stateless, scale ง่าย |
| **File Storage** | AWS S3 / Cloudflare R2 | รูปภาพร้าน, QR codes |
| **Push Notify** | Firebase FCM + LINE Notify | แจ้งเตือนถึงคิว |

### ทำไมต้อง Redis?
- Queue state ต้องเร็วมาก (< 10ms)
- Rate limiting anti-fraud แบบ real-time
- Session blacklisting เมื่อ ban user
- Pub/Sub สำหรับ horizontal scaling ของ Socket.io

---

## 4. Potential Challenges & Solutions

| ปัญหา | วิธีแก้ |
|---|---|
| **คิวหลุด** (ไม่มาตามเวลา) | Timeout 15 นาทีหลัง CALLED → auto-expire + advance queue |
| **เพื่อนเท** (accepted แต่ไม่มา) | นับ check-in ratio ≥ 80% จึงถือว่าสำเร็จ; no-show ลด reputation score |
| **Ghost bookings** | ต้องยืนยัน OTP/phone; limit 1 active booking ต่อ venue |
| **Race condition ในคิว** | ใช้ PostgreSQL advisory lock หรือ Redis INCR ซึ่ง atomic |
| **Deposit หาย** | Stripe Payment Intent + webhook; refund policy ชัดเจน |
| **Scale spike** | Redis queue + horizontal Node.js pods + Socket.io Redis adapter |

---

## 5. Anti-Fraud Mechanism

ดู `docs/anti-fraud.md` สำหรับรายละเอียด ต่อไปนี้คือ layers หลัก:

### Layer 1 — Account Creation
- บังคับ phone OTP verification
- Device fingerprint ต่อ account (1 device ≈ max 3 accounts → flag)
- Account age < 7 วัน → ไม่ได้รับ loyalty points

### Layer 2 — Booking-Time
- IP rate limiting: max 5 bookings/hour ต่อ IP
- ตรวจ device sharing: ถ้า host กับ attendee ใช้ device เดียวกัน → reject
- Fraud score สะสม: ถ้า ≥ 80 → auto-block

### Layer 3 — Event Completion
- ตรวจ check-in ratio (≥ 80% ของ accepted attendees)
- ตรวจ attendee accounts ว่าไม่ใช่บัญชีใหม่ทั้งหมด
- Venue staff ต้อง confirm การ seated (ไม่ใช่ self-checkin อย่างเดียว)
- Manual review queue สำหรับ high-value redemptions

### Layer 4 — Redemption
- Voucher ใช้ได้ครั้งเดียว (unique code)
- Venue staff scan/validate ก่อน apply discount
- Audit log ทุก redemption พร้อม timestamp + staff ID

---

## 6. Loyalty System Design

### Earning Rules
| เหตุการณ์ | แต้มที่ได้ |
|---|---|
| ทริปสำเร็จ (check-in ≥ 80%) | 100 pts |
| ทริปที่ 5 | +250 pts bonus |
| ทริปที่ 10 | +1,000 pts bonus + GOLD tier |
| ทริปที่ 25 | +3,000 pts bonus + PLATINUM tier |

### Tier Benefits
| Tier | เงื่อนไข | สิทธิพิเศษ |
|---|---|---|
| BRONZE | 0-4 ทริป | สะสมแต้มพื้นฐาน |
| SILVER | 5-9 ทริป | แลกรางวัลพิเศษ |
| GOLD | 10-24 ทริป | Priority queue, exclusive rewards |
| PLATINUM | 25+ ทริป | VIP access, dedicated support |

### Point Expiry
- แต้มหมดอายุใน 1 ปีนับจากวันที่ได้
- แจ้งเตือน 30 วันก่อนหมดอายุ

---

## 7. Partner Settlement Flow

```
ลูกค้าแลกแต้ม → Voucher ออก (status: ISSUED)
    ↓
ลูกค้าไปร้าน A → Staff scan voucher
    ↓
System marks voucher USED + บันทึก discount ที่ลดให้
    ↓
[ทุกสิ้นเดือน — Settlement Batch]
    ↓
แพลตฟอร์มรวม vouchers ทั้งหมดของร้าน A
    ↓
คำนวณ:
  Total Discount = Σ discountValue
  Platform Fee   = Total × 15%  (ตาม PartnerCampaign.platformFeeRate)
  Venue Payable  = Total - Platform Fee
    ↓
สร้าง SettlementBatch → ส่ง invoice ให้ร้าน A
    ↓
ร้าน A โอนเงิน VenuePayable มาให้แพลตฟอร์ม
(แพลตฟอร์มออกส่วนลดไปก่อน แล้วเรียกเก็บทีหลัง)
    หรือ:
ร้าน A วาง budget escrow ล่วงหน้าตาม PartnerCampaign.budgetAmount
(ระบบตัด budget อัตโนมัติทุกครั้งที่มีการ redeem)
```

ดู `docs/partner-settlement.md` สำหรับ flow diagram เต็ม

---

## 8. User Engagement UI/UX

### Progress Bar
```
[████████░░] 8/10 trips — 2 more to go!
+1,000 pts bonus waiting for you 🏆
```
- แสดงบน Dashboard และ post-booking screen
- Animate progress เมื่อได้ทริปใหม่

### Stamp Card (10-stamp card)
- ★ ★ ★ ★ ★  ← แถวที่ 1
- ★ ★ ★ ☆ ☆  ← แถวที่ 2 (ยังขาดอีก 2)
- ดีไซน์ให้ดู physical loyalty card
- เมื่อครบ 10 — stamp สุดท้าย animate แบบ confetti

### Milestone Notification
- In-app banner: "คุณอยู่ห่างจาก GOLD tier แค่ 2 ทริปเท่านั้น!"
- Push notification เมื่อใกล้ถึง milestone (เหลือ 1 ทริป)

### Social Proof
- แสดงใน invite card: "[Host] ชวนแล้ว 8 ครั้ง 🔥"
- Badge แสดงบน profile: GOLD HOST

---

## Folder Structure

```
├── backend/
│   ├── prisma/schema.prisma        # Database schema
│   ├── src/
│   │   ├── app.ts                  # Express + Socket.io entry
│   │   ├── config/                 # DB + Redis connections
│   │   ├── middleware/             # Auth + Anti-fraud + Rate limit
│   │   ├── routes/                 # REST API endpoints
│   │   │   ├── auth.ts
│   │   │   ├── venues.ts
│   │   │   ├── bookings.ts
│   │   │   ├── events.ts           # Core: create event + join invite
│   │   │   ├── loyalty.ts          # Points + rewards + redeem
│   │   │   └── settlement.ts       # Partner settlement batches
│   │   ├── services/
│   │   │   ├── queueService.ts     # Real-time queue management
│   │   │   ├── loyaltyService.ts   # Point ledger + milestones
│   │   │   ├── antifraudService.ts # Risk scoring
│   │   │   └── notificationService.ts
│   │   └── socket/handlers.ts      # Socket.io real-time events
│   └── package.json
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Home/               # Venue discovery
│       │   ├── VenueDetail/        # Queue info + booking
│       │   ├── EventCreate/        # Create party + invite link
│       │   ├── EventInvite/        # Friend accepts invitation
│       │   └── Dashboard/          # Loyalty progress + stamps
│       ├── components/
│       │   ├── booking/BookingForm.tsx
│       │   ├── event/InviteModal.tsx
│       │   └── loyalty/            # LoyaltyProgress + StampCard
│       ├── hooks/
│       │   ├── useSocket.ts
│       │   ├── useRealTimeQueue.ts
│       │   └── useLoyalty.ts
│       └── services/api.ts         # Axios API client
└── docs/
    ├── user-journey.md
    ├── anti-fraud.md
    └── partner-settlement.md
```

## Quick Start

```bash
# 1. Start infrastructure
docker-compose up -d

# 2. Backend
cd backend
npm install
npx prisma migrate dev
npm run dev

# 3. Frontend
cd frontend
npm install
npm run dev
```

See `.env.example` files in each directory for required environment variables.
