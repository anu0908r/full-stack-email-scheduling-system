# ReachInbox // Distributed Email Scheduling & SMTP Infrastructure

A production-grade, reliable, full-stack email scheduling system built with **Node.js, Express, TypeScript, PostgreSQL (Prisma), Redis, BullMQ, Nodemailer (Ethereal SMTP), and Next.js (Tailwind CSS v4)**.

---

## 🏛️ System Architecture

```
                                  ┌────────────────────────┐
                                  │   Next.js 15 Frontend  │
                                  │ (Blueprint Editorial UI)│
                                  └───────────┬────────────┘
                                              │ HTTP / REST API
                                              ▼
                                  ┌────────────────────────┐
                                  │ Express REST API Server│
                                  └─────┬────────────┬─────┘
                                        │            │
                           Persist DB   │            │ Queue Delayed Job
                           State & Logs │            │ ({ delay, emailId })
                                        ▼            ▼
                   ┌────────────────────────┐    ┌────────────────────────┐
                   │ PostgreSQL (Prisma ORM)│    │   BullMQ (Redis Queue) │
                   └────────────────────────┘    └───────────┬────────────┘
                                                             │
                                                             │ Fetch Due Job
                                                             ▼
                                                 ┌────────────────────────┐
                                                 │ BullMQ Worker Service  │
                                                 └───────────┬────────────┘
                                                             │
                                             ┌───────────────┼───────────────┐
                                             │               │               │
                                             ▼               ▼               ▼
                                     Idempotency Lock   Rate Limiter   Ethereal SMTP
                                     (PostgreSQL State) (Redis INCR)  (Nodemailer Mail)
```

---

## ✨ Key Technical Features & Guarantees

1. **Strictly NO CRON**: Scheduling is handled entirely via **BullMQ delayed jobs** persisted in Redis.
2. **Persistent Relational State**: PostgreSQL serves as the source of truth for email status (`SCHEDULED`, `PROCESSING`, `SENT`, `FAILED`), attempts, idempotency keys, and Ethereal preview links.
3. **Restart & Crash Recovery**: If server or worker processes restart, BullMQ delayed jobs persist in Redis. A startup `RecoveryService` checks DB state, resets any interrupted `PROCESSING` jobs to `SCHEDULED`, and re-queues any missing jobs idempotently.
4. **Idempotency & Duplicate Prevention**: Before sending, workers atomically transition job state in DB (`status: SCHEDULED -> PROCESSING`). Deterministic idempotency keys prevent duplicate logical sends even under concurrent retries or duplicate API requests.
5. **Atomic Hourly Rate Limiting**: Per-sender hourly rate limits are managed in Redis via atomic `INCR` commands with 1-hour sliding/fixed window TTLs. When a limit is reached, jobs are **rescheduled to the next window** rather than dropped or failed.
6. **Per-Sender Throttling Delay**: Minimum delay between consecutive email sends (`MIN_EMAIL_DELAY_MS`) is strictly enforced per sender across concurrent worker instances using Redis TTL locks.
7. **Real Nodemailer Ethereal SMTP Integration**: Sends emails through Ethereal SMTP and captures live, viewable test inbox preview URLs (`etherealPreviewUrl`) rendered in the dashboard.
8. **Real Google OAuth 2.0 & Dev Mode Auth**: Full Google OAuth authorization flow with JWT session management and user avatar header rendering, plus a quick dev login fallback for local evaluation.
9. **Architectural Blueprint UI**: Styled according to `DESIGN.md` guidelines using Tailwind CSS v4, featuring a paper canvas `#F3ECE5`, ink typography `#1F2736`, drafting grid patterns, 4px structural neo-brutalist borders, and CSV lead list drag-and-drop parser.

---

## 🚀 Quick Setup & Installation

### Prerequisites

- **Node.js**: v18+ (Tested on Node.js v26)
- **PostgreSQL**: v14+ (Local port 5432)
- **Redis**: v7+ (Local port 6379)

### 1. Environment Configuration

Copy `.env.example` to root `.env` and `backend/.env`:

```bash
cp .env.example .env
cp .env.example backend/.env
```

Database & Redis connection strings in `.env`:

```env
DATABASE_URL="postgresql://vishwaksen@localhost:5432/email_scheduler?schema=public"
REDIS_URL="redis://localhost:6379"
WORKER_CONCURRENCY=5
MIN_EMAIL_DELAY_MS=2000
MAX_EMAILS_PER_HOUR_PER_SENDER=200
```

### 2. Backend Setup & Database Migration

```bash
cd backend
npm install
npx prisma db push
```

### 3. Frontend Setup

```bash
cd ../frontend
npm install --legacy-peer-deps
```

---

## 🏃 Running the Application

You can start the backend API server, BullMQ worker, and Next.js frontend concurrently.

### Terminal 1: Backend Express API

```bash
cd backend
npm run dev
# Starts on http://localhost:5001
```

### Terminal 2: BullMQ Worker Process

```bash
cd backend
npm run worker
# Starts worker process with startup recovery reconciliation
```

### Terminal 3: Next.js Frontend Dashboard

```bash
cd frontend
npm run dev
# Starts on http://localhost:3000
```

---

## 🧪 Running Automated & Verification Test Suites

### Backend Unit & Integration Tests (Jest)

```bash
cd backend
npm test
```

### Critical Restart Test

Tests scheduling a future email, stopping/restarting worker process, and verifying execution at the intended time:

```bash
node scripts/restart_test.js
```

### Low Hourly Rate Limit Rescheduling Test

Configures a sender with a limit of 3 emails/hour, schedules 7 emails, and verifies that exactly 3 send immediately while the remaining 4 are delayed into the next window:

```bash
node scripts/rate_limit_test.js
```

---

## 📑 API Endpoint Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | System health check |
| `GET` | `/api/auth/google/url` | Get Google OAuth consent URL |
| `POST` | `/api/auth/google/callback` | Exchange OAuth code / ID Token for JWT |
| `POST` | `/api/auth/dev-login` | Instant dev mode user login |
| `GET` | `/api/senders` | List active sender profiles |
| `POST` | `/api/senders` | Register new sender identity with hourly limit |
| `POST` | `/api/emails/schedule` | Schedule email campaign batch |
| `GET` | `/api/emails/scheduled` | List scheduled & queued emails |
| `GET` | `/api/emails/sent` | List delivered & failed emails with Ethereal links |
| `GET` | `/api/emails/:id` | Get single email status details |

---

## ⚖️ Architectural Trade-Offs & Decisions

1. **Relational Database as Source of Truth**: BullMQ job payloads contain only `{ emailId }` rather than full email state. The worker loads fresh state from PostgreSQL prior to execution, avoiding stale payload data.
2. **State Transition Before SMTP Dispatch**: Transitioning status `SCHEDULED -> PROCESSING` in DB before sending prevents concurrent workers from picking up the same email twice. If Nodemailer fails, the status moves to `FAILED` or `SCHEDULED` for retry.
3. **Rescheduling Over Dropping**: Reaching rate limits triggers automatic calculation of the top of the next hour window (`nextWindowStart`). The worker updates `scheduledAt` in DB and re-enqueues a delayed job in BullMQ rather than permanently failing the job.
