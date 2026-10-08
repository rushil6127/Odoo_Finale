# Champions Club — Run Guide & Launch Protocol (`run.md`)

This file contains the complete, authoritative instructions for running the **Champions Club** application.
Whenever instructed to **"run the project"**, execute the steps defined in this document without inspecting other project files.

---

## ⚡ Quick Start (Standard Local Run)

To run the full stack locally (Windows / PowerShell):

### Terminal 1: Backend Server (Flask REST API)
From the project root:
```powershell
# Using the project's virtual environment:
.venv\Scripts\python.exe backend\run.py
```
* **Runs on:** `http://localhost:5000`
* **API base path:** `http://localhost:5000/api/v1`
* **Health endpoint:** `http://localhost:5000/health`
* **Database:** Default SQLite file at `backend/instance/champions_club_dev.db` (auto-configured)

---

### Terminal 2: Frontend App (Next.js 16 + React 19)
From the project root:
```powershell
cd frontend
npm run dev
```
* **Runs on:** `http://localhost:3000`
* **Connected API:** `http://localhost:5000/api/v1` (configured in `frontend/.env.local`)

---

## 🤖 AI Assistant Automated Execution Instructions

When the user says **"run the project"**, execute the following steps in background tasks without re-scanning the workspace:

1. **Start Backend (Daemon / Background):**
   * Working Directory: `<workspace_root>`
   * Command: `.venv\Scripts\python.exe backend\run.py`
   * Wait 3 seconds, then verify via `curl http://localhost:5000/health` or `Invoke-RestMethod http://localhost:5000/health`.

2. **Start Frontend (Daemon / Background):**
   * Working Directory: `<workspace_root>\frontend`
   * Command: `npm run dev`
   * Verify port 3000 is listening or query `http://localhost:3000`.

3. **Report back to the user:**
   * Backend URL: `http://localhost:5000`
   * Frontend URL: `http://localhost:3000`
   * Key test login credentials from the table below.

---

## 🔐 Demo User Credentials

The database is already seeded with full operational test data.

### 👤 Primary Personal Accounts
| Role | Email | Password |
|---|---|---|
| **Owner** | `pushplamba104@gmail.com` | `Owner@12345` |
| **Admin** | `admin@championsclub.in` | `Admin@12345` |
| **Coach** | `coach@championsclub.in` | `Coach@12345` |

### 🏢 Staff Demo Accounts
| Role | Email | Password |
|---|---|---|
| **Owner** | `owner@championsclub.example.com` | `ChampionsDemo2026!` |
| **Admin** | `admin@championsclub.example.com` | `ChampionsDemo2026!` |
| **Front Desk** | `frontdesk@championsclub.example.com` | `ChampionsDemo2026!` |
| **Pro Shop Staff** | `shop@championsclub.example.com` | `ChampionsDemo2026!` |
| **Lounge / Bar Staff** | `bar@championsclub.example.com` | `ChampionsDemo2026!` |
| **Tennis Coach** | `coach.tennis@championsclub.example.com` | `ChampionsDemo2026!` |
| **Badminton Coach** | `coach.badminton@championsclub.example.com` | `ChampionsDemo2026!` |

### 🏅 Member Demo Accounts
| Plan / Tier | Email | Password |
|---|---|---|
| **Gold Member** | `gold.member@championsclub.example.com` | `ChampionsDemo2026!` |
| **Silver Member** | `silver.member@championsclub.example.com` | `ChampionsDemo2026!` |
| **Junior Member** | `junior.member@championsclub.example.com` | `ChampionsDemo2026!` |
| **Expiring Member** | `expiring.member@championsclub.example.com` | `ChampionsDemo2026!` |

---

## 🔄 Database Re-seeding & Reset (Optional)

If you ever need to reset or re-seed test data:

### Quick Batch Script (Windows):
```powershell
.\scripts\run_seed.bat
```

### Manual CLI Commands:
From the project root:
```powershell
$env:PYTHONPATH="."

# To reset database and reseed all demo data:
.venv\Scripts\flask --app backend.app seed reset --force
.venv\Scripts\flask --app backend.app seed demo
```

---

## 🐳 Optional Services (Docker / Redis / Celery)

The app runs completely in lightweight SQLite mode without external services. For testing Celery background jobs or PostgreSQL:

### Option A: Docker Compose (PostgreSQL + Redis)
```powershell
docker compose up -d
```
* **PostgreSQL:** `localhost:5432` (`champions_user` / `champions_password`)
* **Redis:** `localhost:6379`

### Option B: Built-in Development FakeRedis (No Docker required)
```powershell
.venv\Scripts\python.exe backend\scripts\dev_redis_server.py 6379
```

### Celery Background Worker (Windows):
```powershell
.venv\Scripts\python.exe -m celery -A backend.app.tasks.celery_app.celery_app worker --loglevel=info --pool=solo
```

---

## 🧪 Automated Testing & Payments Verification

To run tests after pulling new changes:

### Run Backend Unit & Integration Tests (including Razorpay & Shop Checkout):
```powershell
.venv\Scripts\pytest backend\tests -v
```

### Validate Production Frontend Build:
```powershell
cd frontend
npm run build
```

---

## 💳 Payments & Razorpay Integration

The application features full end-to-end Razorpay integration across **Membership Subscriptions**, **Court Bookings**, and **Pro-Shop Orders**.

### 1. Integration Highlights
* **Shared Frontend SDK:** Centralized in [`frontend/lib/razorpay.ts`](file:///frontend/lib/razorpay.ts) — handles SDK script injection, modal trigger, and response handoff.
* **Backend Signature Verification:** All online transactions enforce server-side **HMAC-SHA256 signature verification** (`order_id|payment_id` against `RAZORPAY_KEY_SECRET`). The client success callback is never blindly trusted.
* **Webhooks & Idempotency:** Webhook listener at `/api/v1/payments/webhook` safely handles `payment.captured`, `payment.failed`, and `refund.processed` events with duplicate detection.

### 2. Environment Configuration
To use live Razorpay test credentials, configure:

**Backend (`backend/.env`):**
```env
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```

**Frontend (`frontend/.env.local` - Optional):**
```env
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_your_key_id
```

### 3. Dual-Mode Operation
* **Dev / Offline Mode (Default):** If real keys are omitted or placeholders are used, the system automatically uses mock and offline payment rails (`CASH`, `UPI`, `CARD`) with pre-configured demo verification. You can test complete checkouts without an active Razorpay merchant account.
* **Test Mode:** With valid `rzp_test_...` credentials, the official Razorpay modal opens with support for test Cards, UPI IDs, and Net Banking.

### 4. Running Payment Tests:
```powershell
.venv\Scripts\pytest backend/tests/test_payments.py backend/tests/test_shop_payment_options.py -v
```

---

## 🛠️ Verification Checklist

* [ ] Backend Health: `GET http://localhost:5000/health` returns `{"status":"ok"}`
* [ ] Frontend Access: `http://localhost:3000` loads the Champions Club web interface
* [ ] Login Test: Log in using any credential listed above
* [ ] Test Suite: `.venv\Scripts\pytest backend\tests -v` passes completely
