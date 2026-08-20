# ReachInbox — Distributed Email Scheduling & SMTP Infrastructure

A production-grade, full-stack email scheduling system built with **Node.js, Express, TypeScript, PostgreSQL (Prisma ORM), Redis, BullMQ, Nodemailer (Ethereal SMTP), and Next.js 15 (Tailwind CSS v4)**.

---

## Architecture

```
┌─────────────────────────────────┐
│     Next.js 15 Frontend         │
│  (Blueprint Editorial UI)       │
└───────────────┬─────────────────┘
                │ HTTP / REST API
                ▼
┌─────────────────────────────────┐
│    Express REST API Server      │
└──────┬──────────────┬───────────┘
       │              │
       ▼              ▼
┌──────────────┐  ┌──────────────────┐
│  PostgreSQL   │  │  BullMQ (Redis)  │
│  (Prisma ORM) │  │  Delayed Jobs    │
└──────────────┘  └───────┬──────────┘
                           │ Fetch due job
                           ▼
               ┌──────────────────┐
               │  BullMQ Worker   │
               └───────┬──────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
   Idempotency    Rate Limiter   Ethereal
   (PostgreSQL)   (Redis INCR)   SMTP
```

---

## Quick Setup

### Prerequisites

- **Node.js** v18+ (tested on v26)
- **PostgreSQL** v14+ (port 5432)
- **Redis** v7+ (port 6379)

### 1. Start Infrastructure

```bash
# If using Docker
docker-compose up -d

# Or ensure PostgreSQL and Redis are running locally
```

### 2. Environment Configuration

```bash
cp .env.example .env
cp .env.example backend/.env
cp .env.example frontend/.env.local
```

Edit `.env` with your database URL, Redis URL, and optionally Google OAuth credentials.

### 3. Backend Setup

```bash
cd backend
npm install
npx prisma db push
```

### 4. Frontend Setup

```bash
cd frontend
npm install --legacy-peer-deps
```

### 5. Google OAuth (Optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create OAuth 2.0 Client ID
3. Add `http://localhost:3000` as authorized origin
4. Add `http://localhost:5001/api/auth/google/callback` as redirect URI
5. Copy Client ID and Secret to `.env`

---

## Running

### Terminal 1: Backend API

```bash
cd backend
npm run dev
# → http://localhost:5001
```

### Terminal 2: BullMQ Worker

```bash
cd backend
npm run worker
# Starts worker with startup recovery reconciliation
```

### Terminal 3: Frontend

```bash
cd frontend
npm run dev
# → http://localhost:3000
```

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/health` | No | System health check |
| `GET` | `/api/auth/google/url` | No | Google OAuth consent URL |
| `POST` | `/api/auth/google/callback` | No | Exchange OAuth code for JWT |
| `POST` | `/api/auth/dev-login` | No | Dev-only quick login (disabled in prod) |
| `GET` | `/api/auth/me` | Yes | Get current authenticated user |
| `POST` | `/api/auth/logout` | Yes | Logout |
| `GET` | `/api/senders` | Yes | List sender profiles |
| `POST` | `/api/senders` | Yes | Create new sender |
| `DELETE` | `/api/senders/:id` | Yes | Delete sender (if no active emails) |
| `POST` | `/api/emails/schedule` | Yes | Schedule email campaign batch |
| `GET` | `/api/emails/scheduled` | Yes | List scheduled/queued emails (user-scoped) |
| `GET` | `/api/emails/sent` | Yes | List sent/failed emails (user-scoped) |
| `GET` | `/api/emails/:id` | Yes | Get single email details (user-scoped) |

---

## Key Technical Features

### Scheduling (No Cron)

All scheduling uses **BullMQ delayed jobs** persisted in Redis. No cron, no polling loops, no `node-cron`.

### Persistence & Restart Recovery

- **PostgreSQL** is the source of truth for email state (`SCHEDULED`, `PROCESSING`, `SENT`, `FAILED`)
- **BullMQ** handles execution scheduling with Redis-persisted delayed jobs
- On worker startup, `RecoveryService` reconciles stuck/missing jobs idempotently
- Scheduled emails survive backend and worker restarts

### Idempotency / Duplicate Prevention

- Workers atomically transition email status `SCHEDULED → PROCESSING` using `updateMany` with status guard
- Only one worker can claim a given email at a time
- Deterministic idempotency keys (SHA-256 of `campaignId:recipient:scheduledAt`)
- BullMQ job IDs match email IDs for uniqueness

### Rate Limiting

- **Atomic Lua script** in Redis checks and increments per-sender hourly counters
- Fixed 1-hour window keys: `email-rate:{senderId}:{year}-{month}-{day}-{hour}`
- When limit is reached, jobs are **rescheduled** to the next window (never dropped)
- Safe across multiple concurrent workers

### Per-Sender Throttling

- Redis `SET key value PX delay NX` lock per sender
- Minimum delay enforced between consecutive sends from the same sender
- Concurrent workers for the same sender are coordinated via this lock

### Multiple Senders

Each sender has independent:
- Email identity and display name
- Hourly rate limit
- Optional SMTP configuration
- Throttle lock

### Ethereal SMTP

- Real email sending via Nodemailer + Ethereal
- Auto-generates test accounts when no SMTP credentials configured
- Captures preview URLs viewable at `ethereal.email`
- SMTP credentials never exposed to frontend

### User Isolation

- All email queries filter by authenticated user's `userId` via campaign relation
- `getEmailById` verifies campaign ownership before returning data

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment mode |
| `PORT` | `5001` | Backend API port |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `GOOGLE_CLIENT_ID` | — | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | — | Google OAuth client secret |
| `JWT_SECRET` | — | JWT signing secret |
| `WORKER_CONCURRENCY` | `5` | Max concurrent worker jobs |
| `MIN_EMAIL_DELAY_MS` | `2000` | Minimum delay between sends per sender |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | `200` | Default hourly rate limit per sender |
| `ETHEREAL_HOST` | `smtp.ethereal.email` | SMTP host |
| `ETHEREAL_PORT` | `587` | SMTP port |
| `FRONTEND_URL` | `http://localhost:3000` | CORS allowed origin |

---

## Testing

### Backend Tests (Jest)

```bash
cd backend
npm test
```

### Rate Limit Test

```bash
node scripts/rate_limit_test.js
```

Configures a sender with limit=3/hr, schedules 7 emails, verifies exactly 3 send immediately while remaining 4 are rescheduled.

### Restart Recovery Test

```bash
node scripts/restart_test.js
```

Schedules a future email, kills and respawns the worker, verifies the email executes after restart.

---

## Design System

The frontend follows a **blueprint/architectural** aesthetic per `DESIGN.md`:

- **Paper canvas** `#F3ECE5` background
- **Ink** `#1F2736` typography and borders
- **Neo-brutalist** 3px solid borders with offset box-shadows
- **Drafting grid** background pattern
- **Libre Bodoni** serif display headings
- **Manrope** monospace body/labels

---

## Trade-offs

1. **SMTP + DB is not a true distributed transaction**: If SMTP succeeds but the process crashes before updating the DB to `SENT`, the email may be retried. The atomic state claim (`SCHEDULED → PROCESSING`) limits this window, and BullMQ retries provide eventual consistency. In production, consider an outbox pattern or transactional email queue.

2. **Dev login in development**: The `/api/auth/dev-login` endpoint is available for quick testing without Google OAuth setup. It is disabled in production mode.

3. **JWT-based sessions**: Stateless JWT tokens with 7-day expiry. No server-side session store. Logout clears the client token.

4. **Recovery is idempotent**: Running recovery multiple times produces the same result. Stuck `PROCESSING` emails are reset to `SCHEDULED` and re-enqueued.

---

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── config/         # Environment configuration
│   │   ├── controllers/    # Route handlers (auth, email, sender)
│   │   ├── db/             # Prisma & Redis clients
│   │   ├── middleware/     # Auth JWT, error handler
│   │   ├── queues/         # BullMQ queue definition
│   │   ├── routes/         # Express router
│   │   ├── services/       # Business logic (scheduling, SMTP, rate limiter, recovery)
│   │   ├── utils/          # CSV parser
│   │   ├── workers/        # BullMQ worker
│   │   ├── __tests__/      # Jest test suites
│   │   ├── server.ts       # Express app entry
│   │   └── worker.ts       # Worker process entry
│   └── prisma/
│       └── schema.prisma   # Database schema
├── frontend/
│   ├── app/                # Next.js pages (layout, page, auth callback)
│   ├── components/         # React components (Header, ComposeModal, SendersModal, tables)
│   ├── services/           # API client layer
│   └── utils/              # Client-side CSV parser
├── scripts/                # Manual test scripts (restart, rate limit)
├── docker-compose.yml      # PostgreSQL + Redis
├── DESIGN.md               # Design system specification
└── README.md               # This file
```
