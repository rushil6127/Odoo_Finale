# Champions Club — Product Requirements Document

## 1. Product
**Champions Club Management System** is a unified digital platform for managing a growing sports club's members, court bookings, shop, bar/cafeteria, enquiries, staff operations, payments, and owner reporting.

The system replaces fragmented WhatsApp, Excel, paper receipts, phone calls, and manual reporting with connected workflows.

## 2. Source Problem
The Champions Club currently manages:
- Court bookings through WhatsApp
- Member lists in Excel
- Bar receipts on paper
- Court availability through phone calls
- Revenue and operations without consolidated visibility

The product should provide one operational backbone.

## 3. Target Users
### Club Owner / Admin
Needs consolidated revenue, operational KPIs, invoices, employee information, leave, taxes, and reports.

### Front Desk Staff
Needs fast member lookup, registration, membership information, court availability, bookings, cancellations, and payments.

### Members
Need to view membership information, book courts, buy products, place orders, and receive confirmations.

### Shop Staff
Need products, inventory, orders, stock levels, and low-stock visibility.

### Bar / Cafeteria Staff
Need tables, orders, tabs, member discounts, payments, and shift information.

### Employees / Coaches
Need role-specific access and relevant schedule/leave information.

### Prospective Members
Need public club information, plans/prices, availability, trial sessions, and a way to submit enquiries.

## 4. Core Features

### Membership
- Register members
- Gold, Silver, and Junior plans
- Plan benefits and pricing
- Membership start/end dates
- Expiry visibility
- Member history
- Membership status

### Court Booking
- Court management
- Availability calendar
- One-hour sessions
- New slot every 30 minutes
- Maximum two bookings per member per day
- Member/walk-in pricing
- Cancellation
- Plan-based pricing
- Friday social-play support
- Prevent overlapping bookings on the same court

### Shop & Inventory
- Products: rackets, balls, shoes, accessories, apparel
- Stock tracking
- Low-stock visibility
- Counter sales and online orders using the same inventory
- Pickup and delivery orders

### Bar / Cafeteria
- Tables
- Orders
- Tabs
- Kitchen order visibility
- Member discounts
- Cash, card, and UPI payments
- Staff shifts
- Daily revenue

### Website & CRM
- Club information
- Plans and prices
- Court availability
- Shop catalogue
- Trial-session booking
- Lead/enquiry capture
- Follow-up
- Quotes

### Finance & HR
- Revenue from courts, shop, and bar
- Payments by method
- Membership/business invoices
- Employee records
- Leave
- Payroll-related records
- Tax/reporting support
- Owner reporting

### Notifications & Background Jobs
- Booking confirmations
- Membership expiry reminders
- Order notifications
- Enquiry follow-ups
- Low-stock notifications
- Report generation
- Excel exports

## 5. Success Criteria
A judge should be able to see a complete connected workflow:
**member registration → membership → court booking → shop order → bar order → payment → owner dashboard**.

The system should demonstrate that the same operational data flows across modules instead of being stored separately.

## 6. MVP Boundary
### P0
Authentication, roles, members, memberships, courts, booking conflict prevention, payments, and owner dashboard.

### P1
Shop, inventory, bar/POS, discounts, CRM, email notifications, Redis, and Celery.

### P2
Online ordering, delivery, advanced reports, employee workflows, and visual polish.
