# Background Tasks & Redis / Celery Architecture

This document describes the asynchronous task infrastructure for Champions Club, powered by **Redis** as the message broker / result backend and **Celery** as the task executor.

---

## 1. Architectural Principles

### Core Transactional Safety
Core transactional business operations **must remain synchronous and transaction-safe**:
- Court booking creation and occupancy reservation
- Inventory stock deduction and movement history
- Payment state transitions and invoice settlements
- Membership assignment and plan benefits

A background task failure **never** rolls back or corrupts an already committed database transaction.

### Post-Commit Dispatching (`safe_enqueue_task`)
To prevent "ghost tasks" (tasks dispatched for database operations that subsequently fail or roll back):
- `safe_enqueue_task(task_func, *args, **kwargs)` attaches to SQLAlchemy session transaction events (`after_commit` and `after_rollback`).
- If a database transaction is active, the task is held until `db.session.commit()` completes successfully.
- If `db.session.rollback()` occurs, the task is immediately discarded and never dispatched.
- If outside an active transaction, the task is dispatched immediately.

### Pluggable Notification Sender (No Vendor Lock-In)
- Notifications are recorded in the `notifications` database table.
- Notifications are sent via `BaseNotificationSender`, defaulting to `LoggingNotificationSender`.
- No external third-party email or SMS vendor SDKs are mandated, allowing easy plugging of SMTP/Twilio/AWS SES in production.

### Idempotency
All notifications check `has_notification_been_sent(...)` before recording and dispatching. Re-running periodic or event-driven tasks will not produce duplicate notifications for the same reference ID and timeframe.

---

## 2. Implemented Background Tasks

| Task Name | Type | Description | Idempotency Key |
|---|---|---|---|
| `ping_test` | Diagnostic | Verifies broker, worker, and result backend connectivity | N/A |
| `send_booking_confirmation_task` | Event | Sends confirmation to member/guest post-booking | `BOOKING:{booking_id}` |
| `send_membership_expiry_reminders_task` | Periodic (Beat) | Scans active memberships expiring within 30 and 7 days | `MEMBERSHIP:{id}-{milestone}-{end_date}` |
| `send_order_notification_task` | Event | Dispatches updates for Shop orders & POS tab closures | `SHOP_ORDER:{order_id}-{status}` / `POS_TAB:{tab_id}-{status}` |
| `send_crm_follow_up_reminders_task` | Periodic (Beat) | Scans pending CRM follow-ups scheduled for today | `CRM_FOLLOW_UP:{id}-{date}` |
| `check_and_alert_low_stock_task` | Periodic / Event | Alerts inventory managers ONLY for products at or below threshold | `PRODUCT:{id}-{stock}-{date}` |
| `generate_daily_sales_report_task` | Periodic / On-demand | Aggregates daily revenue from bookings, shop, and POS | `DAILY_REPORT:{date}` |
| `export_data_to_excel_task` | On-demand | Generates `.xlsx` export files using `openpyxl` | N/A |

---

## 3. Dependency Justification: `openpyxl`

The Excel export job uses `openpyxl`.
- **Justification**: `openpyxl` is the industry-standard, pure-Python library for reading and writing Office Open XML (.xlsx) files. It has zero system C library dependencies, ensuring 100% cross-platform compatibility across Windows development machines, Linux servers, and containerized Docker images.

---

## 4. Local Execution Guide

### 1. Running Redis Locally

#### Option A: Built-in Development TCP Redis Server
For Windows environments without Docker:
```powershell
python backend/scripts/dev_redis_server.py 6379
```

#### Option B: Native Redis / Docker
```bash
docker run -d --name champions-redis -p 6379:6379 redis:7-alpine
```

### 2. Running the Celery Worker
On Windows, use `--pool=solo` to ensure single-threaded execution compatible with Windows process management:
```powershell
python -m celery -A backend.app.tasks.celery_app.celery_app worker --loglevel=info --pool=solo
```

### 3. Running Celery Beat (Periodic Scheduler)
```powershell
python -m celery -A backend.app.tasks.celery_app.celery_app beat --loglevel=info
```

### 4. Running Combined Worker + Beat in Development
```powershell
python -m celery -A backend.app.tasks.celery_app.celery_app worker --loglevel=info --pool=solo -B
```

### 5. Running the Diagnostic Ping Task
```powershell
python -c "from backend.app.tasks.jobs import ping_test; res = ping_test.delay('Hello'); print(res.get(timeout=5))"
```

### 6. Running Tests
In testing mode, Celery runs synchronously and in-memory (`CELERY_TASK_ALWAYS_EAGER=True` and `CELERY_TASK_EAGER_PROPAGATES=True`), requiring zero running Redis instance:
```powershell
pytest backend/tests/test_celery_tasks.py -vv
```
