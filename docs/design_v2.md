# Champions Club --- Frontend Design System

## 1. Purpose

This document is the frontend visual and interaction source of truth for
the **Champions Club Management System**.

The product should feel like:

> **A premium sports club operating system --- energetic enough to feel
> like sport, clean enough for fast daily operations, and polished
> enough for a public-facing brand.**

The design must support three major experiences:

1.  **Staff / Admin application** --- fast operational workflows
2.  **Member application** --- bookings, membership, shop and orders
3.  **Public club website** --- discovery, plans, trial sessions and
    enquiries

The design direction is inspired by the supplied sports-brand references
and the existing visual reference, but must be an original Champions
Club interface rather than a direct copy.

------------------------------------------------------------------------

# 2. Core Visual Concept

The visual identity is based on three primary color families:

### Green --- Ground Sports

Green represents:

-   Grass
-   Tennis courts
-   Outdoor/ground sports
-   Tennis balls
-   Energy and movement
-   Natural sports environments

Green should be the primary identity color for **ground-sport-related
content and actions**.

### Blue --- Water / Cool Sports Energy

Blue represents:

-   Water
-   Coolness
-   Speed
-   Outdoor sports atmosphere
-   Technology and trust

Multiple shades of blue may be used. Blue can also be used as a major UI
accent when the screen is not associated with a specific sport.

### White --- Universal / Neutral

White represents:

-   Cleanliness
-   Space
-   Simplicity
-   Neutrality
-   Readability

White and off-white should be used heavily for surfaces, backgrounds,
cards and content areas.

The three palettes should work together rather than being treated as
isolated themes.

------------------------------------------------------------------------

# 3. Color System

## 3.1 Primary Reference Colors

The supplied visual references provide the following useful starting
colors:

### Green

-   Bright Sport Green: `#CEF852`
-   Deep Club Green: `#1E4B33`
-   Olive Sport Green: `#6F7A4B`

### Blue

-   Deep Sports Blue: `#133C73`
-   Additional blue shades may be introduced for hierarchy, states and
    sport-specific sections.

### Neutral

-   Warm White: `#F3EEE0`
-   Soft White: `#FFFBF8`

### Yellow-Green Accent

-   Sport Lime: `#F6ED5B`

These values are a starting palette, not a restriction. The frontend
team may create lighter/darker shades while preserving the same visual
language.

------------------------------------------------------------------------

# 4. Color Usage Rules

Color must communicate meaning rather than simply decorate the
interface.

## Green

Use green for:

-   Primary sport identity
-   Tennis / ground-sport sections
-   Primary positive actions
-   Active booking states
-   Membership highlights
-   Important CTAs
-   Selected states when appropriate

Do not make every button green. Green should retain visual importance.

## Blue

Use blue for:

-   Water/cool-sport themes
-   Technology-oriented sections
-   Secondary primary actions
-   Information states
-   Navigation accents
-   Charts and data visualizations where appropriate
-   Member-facing sections when a calmer visual tone is useful

Use multiple blue shades to create depth without introducing unrelated
colors.

## White / Off-white

Use white for:

-   Main application backgrounds
-   Cards
-   Forms
-   Tables
-   Content surfaces
-   Public website sections
-   Negative space

Warm white can be used to soften large areas of the interface.

## Dark / Deep Colors

Deep green, navy and near-black should be used for:

-   Primary text
-   Navigation
-   High-contrast sections
-   Hero backgrounds
-   Footer
-   Strong visual anchors

Avoid making the entire interface dark.

------------------------------------------------------------------------

# 5. Semantic Colors

Semantic colors are separate from the brand palette.

Use them only when communicating system state.

  State     Purpose
  --------- --------------------------------------------------------
  Success   Completed booking, successful payment, available stock
  Warning   Low stock, expiring membership, pending action
  Error     Failed payment, invalid form, booking conflict
  Info      Informational messages and system guidance

Semantic colors should remain visually compatible with the
green/blue/white brand system.

------------------------------------------------------------------------

# 6. Design Philosophy

The interface should combine:

-   Premium sports branding
-   Editorial layouts
-   Large imagery
-   Strong typography
-   Clean dashboards
-   Clear data hierarchy
-   Spacious layouts
-   Subtle motion
-   Fast operational interactions

The design should feel **sport-first**, not like a generic ERP
dashboard.

At the same time, operational screens such as POS and court booking must
prioritize speed over visual decoration.

------------------------------------------------------------------------

# 7. Typography

Use a modern sans-serif typeface.

Typography hierarchy:

### Display

Used for:

-   Public website hero
-   Major section headings
-   Marketing statements

Characteristics:

-   Large
-   Bold
-   High contrast
-   Short statements

### Heading

Used for:

-   Dashboard sections
-   Page titles
-   Card titles

### Body

Used for:

-   Descriptions
-   Forms
-   Tables
-   Help text

### Label

Used for:

-   Status
-   Metadata
-   Filters
-   Form labels

### Numeric / KPI

Large numbers should have strong visual hierarchy.

Examples:

``` text
₹1,24,500
Monthly Revenue
```

``` text
18
Active Courts
```

Typography must remain readable before it becomes decorative.

------------------------------------------------------------------------

# 8. Layout Principles

## Spacing

Prefer generous spacing for:

-   Dashboard sections
-   Public website sections
-   Cards
-   Hero areas

Use tighter spacing for:

-   POS
-   Tables
-   Booking grids
-   Dense operational workflows

## Border Radius

Use moderate rounded corners.

Avoid excessive pill-shaped UI unless the component represents:

-   Status
-   Category
-   Filter
-   Membership tier
-   Small action

## Shadows

Use subtle shadows.

Cards should generally rely on:

-   spacing
-   borders
-   contrast
-   background changes

rather than heavy shadows.

------------------------------------------------------------------------

# 9. Application Layout

## Staff / Admin Application

Desktop-first structure:

``` text
┌──────────────────────────────────────────────────┐
│ Top Bar                           Profile / Bell │
├──────────────┬───────────────────────────────────┤
│              │                                   │
│ Sidebar      │          Main Content             │
│              │                                   │
│ Dashboard    │                                   │
│ Members      │                                   │
│ Bookings     │                                   │
│ Shop         │                                   │
│ POS          │                                   │
│ CRM          │                                   │
│ Reports      │                                   │
│ Employees    │                                   │
│              │                                   │
└──────────────┴───────────────────────────────────┘
```

The sidebar should make the system feel like one connected application.

## Member Application

The member experience should be simpler:

``` text
Home
Bookings
Membership
Shop
Orders
Profile
```

## Public Website

The public website should use:

``` text
Logo
About
Sports
Memberships
Courts
Shop
Trial
Contact
```

with a strong primary CTA.

------------------------------------------------------------------------

# 10. Navigation

## Staff Navigation

Suggested sections:

``` text
Dashboard

Club
├── Members
├── Memberships
└── Courts

Operations
├── Bookings
├── Shop
├── Inventory
└── Bar / POS

Growth
├── CRM
└── Enquiries

Management
├── Finance
├── Employees
└── Reports
```

Navigation should be role-aware.

A staff member should not see management features that they cannot use.

The backend remains the source of truth for authorization.

------------------------------------------------------------------------

# 11. Owner Dashboard

The owner dashboard is one of the most important screens.

It should answer:

> **How is the club performing right now?**

Priority information:

``` text
Revenue
Active Members
Today's Bookings
Court Utilization
Shop Sales
Bar Sales
Outstanding Payments
Low Stock
Recent Activity
```

Example:

``` text
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Revenue     │ │ Members     │ │ Bookings    │
│ ₹1.24L      │ │ 482         │ │ 36          │
└─────────────┘ └─────────────┘ └─────────────┘

┌──────────────────────────────┐
│ Revenue Overview             │
│                              │
│             ╱╲               │
│       ╱╲   ╱  ╲              │
│  ╱╲  ╱  ╲_╱    ╲             │
└──────────────────────────────┘

┌──────────────────┐ ┌──────────────────┐
│ Court Utilization│ │ Low Stock        │
└──────────────────┘ └──────────────────┘
```

Charts should be easy to scan and should not overwhelm the user.

------------------------------------------------------------------------

# 12. Member Management

Member list:

``` text
Search members...

┌──────┬────────────┬────────┬──────────┬──────────┐
│ ID   │ Name       │ Plan   │ Status   │ Expiry   │
├──────┼────────────┼────────┼──────────┼──────────┤
│ 1024 │ Member     │ Gold   │ Active   │ 12 Jan   │
│ 1025 │ Member     │ Silver │ Active   │ 03 Feb   │
└──────┴────────────┴────────┴──────────┴──────────┘
```

Member profile should expose:

-   Personal information
-   Membership
-   Benefits
-   Booking history
-   Orders
-   Payments
-   Membership expiry
-   Relevant activity

The goal is fast recognition at the front desk.

------------------------------------------------------------------------

# 13. Membership UI

Membership cards should visually distinguish:

### Gold

Premium visual treatment using the green/lime palette.

### Silver

Neutral treatment with white, gray and blue accents.

### Junior

Energetic but clean treatment using brighter accent colors.

Membership colors should not override accessibility or readability.

------------------------------------------------------------------------

# 14. Court Booking UI

Court booking is a core operational workflow.

The primary screen should be a scheduling grid.

``` text
Date:  Friday, 18 Oct

          6:00   6:30   7:00   7:30   8:00

Court 1  █████  █████
Court 2         █████  █████
Court 3  ─────  ─────  █████
Court 4  █████
```

States:

-   Available
-   Selected
-   Booked
-   Temporarily unavailable
-   Social play
-   Past time

The UI must make conflicts visually obvious.

Important booking information should never be hidden behind animation.

Booking flow:

``` text
Select date
    ↓
Select court
    ↓
Select time
    ↓
Select member
    ↓
Review price
    ↓
Confirm
    ↓
Success
```

The backend remains responsible for:

-   Booking limits
-   Pricing
-   Membership rules
-   Conflict prevention

------------------------------------------------------------------------

# 15. Social Play

Friday social play should have a recognizable visual treatment.

Example:

``` text
SOCIAL PLAY
Court 2
7:00 PM
Multiple players
```

Use a subtle green/blue accent rather than creating a completely
different visual theme.

------------------------------------------------------------------------

# 16. Shop UI

The shop should feel closer to a premium sports store than a generic
inventory table.

Product cards:

``` text
┌─────────────────────┐
│                     │
│    Product Image    │
│                     │
├─────────────────────┤
│ Tennis Racket       │
│ ₹8,500              │
│                     │
│ ● In Stock          │
│                     │
│      Add to Cart    │
└─────────────────────┘
```

Show:

-   Image
-   Product name
-   Price
-   Stock state
-   Member discount where applicable
-   Add/order action

------------------------------------------------------------------------

# 17. Inventory UI

Inventory is more operational and should therefore be denser.

Display:

-   Product
-   Current stock
-   Threshold
-   Status
-   Recent stock movement

Example statuses:

``` text
IN STOCK
LOW STOCK
OUT OF STOCK
```

Low-stock information should be immediately visible without opening
another screen.

------------------------------------------------------------------------

# 18. POS / Bar UI

The POS interface must prioritize **speed**.

Recommended layout:

``` text
┌──────────────────────────┬─────────────────────┐
│ Categories               │ Current Order       │
│                          │                     │
│ Food   Drinks   Snacks   │ Burger      ₹250    │
│                          │ Coke        ₹80     │
│ [Burger] [Pizza]         │ Coffee      ₹120    │
│ [Coffee] [Coke]          │                     │
│ [Fries]  [Water]         │ ----------------    │
│                          │ Total       ₹450    │
│                          │                     │
│                          │ [PAY]               │
└──────────────────────────┴─────────────────────┘
```

Support:

-   Tables
-   Tabs
-   Order items
-   Member discount
-   Cash
-   Card
-   UPI
-   Kitchen status

The POS should use large touch-friendly controls.

------------------------------------------------------------------------

# 19. CRM UI

CRM should visually communicate pipeline progression.

``` text
NEW
 ↓
CONTACTED
 ↓
TRIAL BOOKED
 ↓
QUOTE SENT
 ↓
CONVERTED
```

A Kanban-style interface can be used.

Each lead should show:

-   Name
-   Contact
-   Source
-   Interested plan
-   Trial date
-   Follow-up status

------------------------------------------------------------------------

# 20. Public Website

The public website should introduce the club as a premium sports
destination.

Hero section:

``` text
PLAY.
COMPETE.
BELONG.

Your sports club,
all in one place.

[Book a Trial]
[Explore Membership]
```

Use large sports imagery and strong whitespace.

Sports can be represented using the color system:

-   Ground sports → green
-   Water/cool sports → blue
-   Neutral/general club content → white

The public website should not look like the internal admin dashboard.

------------------------------------------------------------------------

# 21. Imagery

Sports imagery should feel:

-   Energetic
-   Authentic
-   High contrast
-   Dynamic
-   Premium

Preferred subjects:

-   Athletes in action
-   Courts
-   Sports equipment
-   Balls
-   Rackets
-   Club spaces
-   Food/bar experience
-   Community/social play

Images can be cropped boldly.

Use image cards, editorial grids and large hero imagery where
appropriate.

Avoid filling every section with photographs.

------------------------------------------------------------------------

# 22. Component System

All major UI elements should be reusable.

``` text
components/
│
├── ui/
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── Select.tsx
│   ├── Modal.tsx
│   ├── Card.tsx
│   ├── Badge.tsx
│   ├── Table.tsx
│   ├── Tabs.tsx
│   └── Dropdown.tsx
│
├── layout/
│   ├── Sidebar.tsx
│   ├── Topbar.tsx
│   └── DashboardLayout.tsx
│
├── booking/
│   ├── CourtGrid.tsx
│   ├── CourtCard.tsx
│   ├── TimeSlot.tsx
│   └── BookingModal.tsx
│
├── members/
│   ├── MemberCard.tsx
│   └── MembershipBadge.tsx
│
├── shop/
│   ├── ProductCard.tsx
│   └── StockBadge.tsx
│
└── pos/
    ├── ProductButton.tsx
    ├── OrderPanel.tsx
    └── PaymentPanel.tsx
```

Avoid giant components.

------------------------------------------------------------------------

# 23. TypeScript Design Rules

The frontend uses **Next.js + TypeScript**.

Important domain types should be defined centrally.

Example:

``` typescript
interface Member {
  id: number;
  name: string;
  email: string;
  phone: string;
  membershipPlan: MembershipPlan;
  membershipExpiry: string;
}
```

``` typescript
type MembershipPlan = "GOLD" | "SILVER" | "JUNIOR";
```

API response types should be defined rather than using `any` everywhere.

Avoid:

``` typescript
const data: any = ...
```

Prefer explicit types.

The frontend should mirror the backend API contract.

------------------------------------------------------------------------

# 24. Frontend State Rules

Do not introduce a large state-management library unless the application
actually requires one.

Prefer:

-   React state for local UI state
-   Server/API data handling for backend state
-   Small shared state only where necessary

The frontend must not duplicate backend business rules.

For example, the frontend may display:

``` text
2 bookings remaining
```

but Flask must enforce the actual booking limit.

------------------------------------------------------------------------

# 25. Loading States

Every API-driven screen should have a deliberate loading state.

Examples:

``` text
Skeleton cards
Skeleton table rows
Loading button
Booking confirmation loader
```

Avoid blank screens while data loads.

------------------------------------------------------------------------

# 26. Error States

Errors should be understandable.

Example:

``` text
Unable to book this court.

This court was just booked by another user.

[Choose another slot]
```

Do not expose raw backend errors or stack traces.

------------------------------------------------------------------------

# 27. Empty States

Every list should have an intentional empty state.

Example:

``` text
No bookings yet.

Your upcoming court bookings will appear here.

[Book a Court]
```

------------------------------------------------------------------------

# 28. Responsive Design

## Desktop

Primary target for:

-   Owner dashboard
-   Staff dashboard
-   POS
-   Inventory
-   CRM
-   Reports

## Tablet

Support:

-   Front desk
-   Court booking
-   Shop
-   POS

## Mobile

Prioritize:

-   Member profile
-   Court booking
-   Membership
-   Shop
-   Orders
-   Trial booking
-   Public website

Operational screens should not be unnecessarily compressed on mobile.

------------------------------------------------------------------------

# 29. Accessibility

The interface should include:

-   Keyboard-accessible controls
-   Visible focus states
-   Sufficient text contrast
-   Semantic HTML
-   Labels for forms
-   Accessible modal behavior
-   Non-color indicators for important statuses

Never communicate an important state using color alone.

For example:

``` text
🟢 Available
🔴 Booked
```

should also include text or another visual distinction.

------------------------------------------------------------------------

# 30. Motion & Animation

Use GSAP and/or Anime.js selectively.

Good uses:

-   Page transitions
-   Hero animations
-   KPI number reveals
-   Booking confirmation
-   Modal transitions
-   Product hover effects
-   Subtle navigation transitions

Avoid animation in:

-   Dense booking grids
-   POS buttons
-   Repetitive tables
-   Critical confirmation actions

Animation must never slow down staff workflows.

------------------------------------------------------------------------

# 31. Interaction Principles

The user should generally understand:

1.  Where they are
2.  What they can do
3.  What happened
4.  What they should do next

Every important action should provide feedback.

Examples:

``` text
Booking → Confirmation
Payment → Receipt / Success
Order → Order status
Membership → Active state
Stock → Updated quantity
```

------------------------------------------------------------------------

# 32. Brand Consistency

Every screen should feel like part of Champions Club.

Maintain consistency in:

-   Color
-   Typography
-   Spacing
-   Buttons
-   Cards
-   Icons
-   Status indicators
-   Navigation
-   Motion

Do not create separate visual systems for individual modules.

Sport-specific colors can add personality without breaking the global
system.

------------------------------------------------------------------------

# 33. Frontend Performance

Prioritize:

-   Optimized images
-   Lazy loading where appropriate
-   Minimal unnecessary client-side JavaScript
-   Reusable components
-   Efficient API requests
-   Avoiding unnecessary re-renders
-   Clear loading states

The application should remain fast during operational workflows.

------------------------------------------------------------------------

# 34. What to Avoid

Do not use:

-   Excessive gradients
-   Excessive glassmorphism
-   Excessive animations
-   Huge decorative elements inside operational screens
-   Inconsistent button styles
-   Random colors outside the design system
-   Giant components
-   Hard-coded repeated UI
-   Duplicate API logic
-   Frontend-only business rules
-   Generic-looking admin templates without Champions Club identity

The goal is not to make every screen visually spectacular.

The goal is to make the **whole system feel intentional, premium and
extremely usable**.

------------------------------------------------------------------------

# 35. Frontend Team Ownership

The frontend team consists of:

**Pushp + Pearl**

The team should work together on the shared design system and divide
feature implementation without creating separate visual conventions.

Before feature development:

1.  Establish color tokens
2.  Establish typography
3.  Establish spacing
4.  Build base UI components
5.  Build application layout
6.  Build navigation
7.  Establish API client conventions
8.  Establish TypeScript domain types

Then move into feature screens.

------------------------------------------------------------------------

# 36. Final Design Principle

The Champions Club frontend should communicate:

> **Sport + Community + Premium Experience + Operational Efficiency**

Green brings the energy of ground sports.

Blue brings the cool, active and technological side of sport.

White provides clarity and space.

Together they should create a visual system that feels energetic enough
for athletes, professional enough for staff, and polished enough for the
club's public brand.
