# Champions Club — Implementation Phases

## Phase 0 — Project Setup
**Goal:** Everyone can run the project.

Backend:
- Create Flask application
- Configure environment variables
- Configure SQLAlchemy
- Configure migrations
- Configure SQLite
- Add basic health endpoint

Frontend:
- Create Next.js + TypeScript application
- Configure Tailwind
- Establish API client structure

Infrastructure:
- Add Redis
- Add Celery skeleton

## Phase 1 — Authentication & Users
**Goal:** Secure access.

- User model
- Password hashing
- JWT login
- Role-based authorization
- Protected routes
- Frontend login

## Phase 2 — Members & Memberships
**Goal:** Replace the club's member Excel workflow.

- Member CRUD
- Membership plans
- Membership activation/expiry
- Benefits
- Member history
- Member search

## Phase 3 — Courts & Booking
**Goal:** Solve the core operational problem.

- Court CRUD
- Availability
- Booking creation
- Booking cancellation
- Daily booking limit
- Pricing rules
- Conflict prevention
- Social-play support
- Booking confirmation

## Phase 4 — Shop & Inventory
**Goal:** Connect counter and online sales.

- Product CRUD
- Inventory
- Stock movements
- Low-stock alerts
- Shop orders
- Pickup/delivery states
- Member pricing/discounts

## Phase 5 — Bar / POS
**Goal:** Replace paper receipts.

- Tables
- Orders
- Order items
- Tabs
- Kitchen visibility
- Member discounts
- Payment methods
- Staff shifts
- Daily sales

## Phase 6 — CRM & Public Experience
**Goal:** Turn website visitors into tracked leads.

- Public club information
- Plans/prices
- Trial enquiry
- CRM lead creation
- Follow-up states
- Quotes
- Notifications

## Phase 7 — Finance, Reports & Owner Dashboard
**Goal:** Give the owner operational visibility.

- Revenue aggregation
- Payments
- Invoices
- Daily/weekly/monthly reports
- Excel export
- Dashboard KPIs
- Employee/leave records

## Phase 8 — Background Jobs
- Celery workers
- Redis queues
- Email notifications
- Membership reminders
- Low-stock notifications
- Report generation

## Phase 9 — Integration & Demo Hardening
- End-to-end testing
- Seed/demo data
- Permission testing
- Booking conflict testing
- Error handling
- Loading states
- Responsive UI
- Performance checks

## Phase 10 — Hackathon Demo
Demo the complete journey:

**New member → Gold membership → Court booking → Shop purchase → Bar order → Payment → Owner dashboard**

The demo should emphasize connected data and operational automation.
