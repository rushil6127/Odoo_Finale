# Champions Club E2E Demo Script

This script walks through the end-to-end operational journey of Champions Club, utilizing both the core platform and the commerce/CRM extensions.

## Prerequisites
Ensure the database has been freshly seeded:
```bash
set PYTHONPATH=.
flask seed demo
```

## Stage 1: Public Discovery & CRM (Walk-in)
**Actor:** Front Desk (`frontdesk@championsclub.example.com` / `demo123`)

1. A walk-in visitor ("New Member") comes to the club and asks about plans.
2. Front Desk logs in, views the active plans.
3. Front Desk submits an enquiry via `/api/v1/crm/public/enquiry` or creates a lead directly.
4. Front Desk clicks "Convert to Member" (`POST /api/v1/crm/leads/{id}/convert`), selecting the `SILVER` plan.
5. The system generates a user account, member profile, and a `PENDING` membership.

## Stage 2: Member Self-Service
**Actor:** The New Member (using their generated credentials, e.g., `gold.member@championsclub.example.com` / `demo123` for the pre-seeded Gold Member)

1. Gold Member logs into the platform.
2. They view their dashboard to see membership status.
3. **Court Booking:** They browse courts (`GET /api/v1/courts`), see real-time availability, and book a Lawn Tennis court for tomorrow.
4. The system automatically applies the 100% Gold discount on the court fee.

## Stage 3: Pro Shop Commerce
**Actor:** Shop Staff (`shop@championsclub.example.com` / `demo123`) and Gold Member

1. **In-Store Purchase:** Gold Member buys a can of Tennis Balls.
2. Shop Staff processes a `COUNTER` order at the POS (`POST /api/v1/shop/orders`).
3. Payment is logged via `CASH` or `UPI`. 
4. The inventory stock for "Tennis Balls (Can)" automatically deducts by 1.
5. **Online Purchase:** Gold Member logs in and orders a "Club Polo Shirt" online for `DELIVERY`.
6. Shop Staff sees the `PENDING` order, confirms it, packs it, and marks it as `SHIPPED` then `COMPLETED`.

## Stage 4: Bar & POS
**Actor:** Bar Staff (`bar@championsclub.example.com` / `demo123`)

1. Gold Member visits the lounge and sits at Table T1.
2. Bar Staff opens a POS Tab for Table T1 (`POST /api/v1/pos/tabs`).
3. Bar Staff adds 2x Espresso to the tab (`POST /api/v1/pos/tabs/{id}/items`).
4. The order is sent to the Kitchen queue.
5. Once consumed, the Gold Member pays the tab via `CARD`.
6. Bar Staff processes the payment (`POST /api/v1/pos/tabs/{id}/pay`) and closes the tab.

## Stage 5: Owner Dashboard
**Actor:** Owner (`owner@championsclub.example.com` / `demo123`)

1. The Owner logs in at the end of the day to view performance.
2. They hit `GET /api/v1/reports/dashboard`.
3. The dashboard accurately aggregates revenue across:
   - Memberships
   - Courts
   - Pro Shop
   - Bar & Cafe
4. The totals correctly map `PAID` statuses and reconcile against `CASH`, `CARD`, `UPI`, and `ONLINE` payment methods.
