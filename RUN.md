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

The app supports both online Razorpay payment processing and dev/offline fallbacks:
* **Online Mode:** Provide `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in `backend/.env`.
* **Dev/Demo Mode:** When Razorpay credentials are unset or in test mode, the platform safely exercises mock payment flows without breaking offline operations (`CASH`, `UPI`, `CARD`).

---

## 🛠️ Verification Checklist

* [ ] Backend Health: `GET http://localhost:5000/health` returns `{"status":"ok"}`
* [ ] Frontend Access: `http://localhost:3000` loads the Champions Club web interface
* [ ] Login Test: Log in using any credential listed above
* [ ] Test Suite: `.venv\Scripts\pytest backend\tests -v` passes completely
