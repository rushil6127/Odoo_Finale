# Champions Club — Architecture

## 1. Architecture Style
Use a **modular monolith** for the hackathon.

Do not split the system into microservices. Flask owns the backend API and business logic while the Next.js application owns the user interface.

## 2. High-Level Flow

```text
User
  ↓
Next.js + TypeScript + Tailwind
  ↓ REST / JSON
Flask REST API
  ↓
Business Services
  ├── Auth
  ├── Members
  ├── Memberships
  ├── Courts
  ├── Bookings
  ├── Shop
  ├── Inventory
  ├── POS
  ├── CRM
  ├── Payments
  ├── Employees
  └── Reports
  ↓
SQLAlchemy
  ↓
SQLite (development) → PostgreSQL (deployment)

Flask
  ↓
Redis
  ↓
Celery Workers
  ├── Emails
  ├── Notifications
  ├── Excel/report generation
  └── Background processing
```

## 3. Locked Tech Stack

### Frontend
- Next.js
- TypeScript
- Tailwind CSS
- GSAP and/or Anime.js

### Backend
- Flask
- Python
- SQLAlchemy / Flask-SQLAlchemy
- Flask-Migrate / Alembic
- JWT authentication

### Data & Jobs
- SQLite initially
- PostgreSQL for deployment
- Redis
- Celery

### Communication
- REST API
- JSON

## 4. Backend Structure

```text
backend/
├── app/
│   ├── __init__.py
│   ├── config.py
│   ├── extensions.py
│   │
│   ├── auth/
│   ├── members/
│   ├── memberships/
│   ├── courts/
│   ├── bookings/
│   ├── shop/
│   ├── inventory/
│   ├── pos/
│   ├── crm/
│   ├── payments/
│   ├── employees/
│   ├── reports/
│   │
│   ├── tasks/
│   │   ├── email_tasks.py
│   │   ├── report_tasks.py
│   │   └── notification_tasks.py
│   │
│   └── common/
│       ├── errors.py
│       ├── permissions.py
│       └── utils.py
│
├── migrations/
├── tests/
├── requirements.txt
├── .env.example
└── run.py
```

## 5. Frontend Structure

```text
frontend/
├── app/
├── components/
├── features/
│   ├── auth/
│   ├── members/
│   ├── bookings/
│   ├── shop/
│   ├── pos/
│   └── dashboard/
├── lib/
│   ├── api/
│   └── auth/
├── types/
└── public/
```

## 6. Core Domain Relationships

```text
Member
 ├── Membership
 ├── Bookings
 ├── Shop Orders
 ├── Bar Orders
 └── Payments

Court
 └── Bookings

Product
 ├── Inventory
 └── Orders

Employee
 ├── Shifts
 └── Leave

CRM Lead
 └── Follow-ups
```

## 7. Authentication Flow

```text
Login
 ↓
Flask validates credentials
 ↓
JWT issued
 ↓
Next.js authenticates API requests
 ↓
Flask validates JWT
 ↓
Role/permission check
 ↓
Protected resource
```

## 8. Booking Flow

```text
Request booking
 ↓
Authenticate member/staff
 ↓
Validate membership and plan
 ↓
Validate daily booking limit
 ↓
Check court/time conflict
 ↓
Calculate applicable price
 ↓
Create booking transaction
 ↓
Queue confirmation notification
```

The booking service must guarantee that two users cannot successfully reserve the same court/time slot.

## 9. Background Job Flow

```text
Flask request
 ↓
Save important transaction
 ↓
Queue background task
 ↓
Redis
 ↓
Celery worker
 ↓
Email / notification / report
```
