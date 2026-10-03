# Champions Club — Project Memory

## Project
Hackathon project: **Sports Club Management System — Champions Club**

## Problem
The club has outgrown WhatsApp, Excel, paper receipts, phone calls, and disconnected operations.

## Core Objective
Build one unified digital backbone for:
- Memberships
- Court bookings
- Shop
- Inventory
- Bar/cafeteria
- CRM
- Payments
- Employees
- Finance
- Owner reporting

## Locked Tech Stack

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
- JWT

### Database
- SQLite during initial development
- PostgreSQL for deployment

### Infrastructure
- Redis
- Celery

### API
- REST
- JSON

## Architecture Decision
Use a modular monolith, not microservices.

Flask owns:
- Business logic
- Validation
- Authentication
- Authorization
- Database operations
- Background-job dispatch

Next.js owns:
- UI
- Client interactions
- Forms
- Dashboards
- Member-facing workflows

## Backend Team Focus
Backend implementation should proceed in this order:
1. Project setup
2. Auth and roles
3. Members
4. Memberships
5. Courts
6. Bookings
7. Payments
8. Shop/inventory
9. POS
10. CRM
11. Reports
12. Celery/Redis integration
13. Testing and integration

## Critical Business Rules
- Gold, Silver, Junior membership tiers
- One-hour court sessions
- New slot every 30 minutes
- Maximum two bookings per member per day
- Prevent two bookings on the same court at the same time
- Member/walk-in pricing can differ
- Friday social play must be supported
- Shop and online orders share inventory
- Member discounts should apply automatically
- Bar supports tabs
- Payment methods include cash, card, and UPI
- Owner needs today/week/month visibility

## Demo Story
The primary end-to-end demo should be:

**New member → Membership → Court booking → Shop purchase → Bar order → Payment → Owner dashboard**

## Development Principle
Build the smallest reliable version first. Avoid unnecessary libraries and complexity. Business rules belong in the backend and must not depend on frontend enforcement.

## AI Usage
AI is an implementation assistant, not the source of product requirements. AI-generated code must be reviewed. It must not invent requirements, remove security checks, or silently alter business rules.
