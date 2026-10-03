# Champions Club — Backend API Contract (Core Operations & Platform)

**Version:** 1.0.0  
**Target Consumer:** Frontend Next.js / TypeScript Web Application  
**Owner:** Developer A (Platform, Auth, Members, Memberships, Courts, Bookings, Payments)

---

## 1. Global Conventions & Standards

### 1.1 Base URL & Routing
- Base API prefix: `/api/v1`
- Health check endpoints: `/health` and `/api/v1/health`
- All responses are encoded as `application/json` with UTF-8 character encoding.

### 1.2 Authentication Header
All protected endpoints require a valid JWT Access Token passed in the HTTP `Authorization` request header:
```http
Authorization: Bearer <jwt_access_token>
```
- Tokens expire in 24 hours (86,400 seconds) by default.
- Payload claims contain: `sub` (User ID), `email`, `role`, and standard JWT timestamps (`iat`, `exp`).

### 1.3 Standard Response Envelope
All successful API responses return a structured JSON envelope:
```json
{
  "success": true,
  "data": {},
  "message": "Operation completed successfully.",
  "meta": {
    "total": 100,
    "page": 1,
    "per_page": 20
  }
}
```
- `data`: Contains the primary object, array, or dictionary requested.
- `message`: Optional human-readable notification text.
- `meta`: Optional pagination or aggregation metadata (`total`, `page`, `per_page`).

### 1.4 Standard Error Response Envelope
All client and server errors return a standard JSON error envelope:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request payload contains invalid fields.",
    "details": {
      "email": ["Must be a valid email address."]
    }
  }
}
```

### 1.5 Standard Error Codes & HTTP Status Codes
| HTTP Status | Error Code | Description |
| :--- | :--- | :--- |
| **400 Bad Request** | `BAD_REQUEST` / `INVALID_INPUT` | Malformed JSON or missing required parameters. |
| **401 Unauthorized** | `UNAUTHORIZED` / `INVALID_CREDENTIALS` | Missing or expired JWT token, or incorrect credentials. |
| **403 Forbidden** | `FORBIDDEN` / `PERMISSION_DENIED` | Authenticated user lacks the necessary role or ownership. |
| **404 Not Found** | `NOT_FOUND` | The requested database resource does not exist. |
| **409 Conflict** | `CONFLICT` / `BOOKING_CONFLICT` | Resource collision (e.g., overlapping court booking, email taken). |
| **422 Unprocessable**| `VALIDATION_ERROR` | Schema validation error with field-level details. |
| **429 Too Many Req** | `RATE_LIMIT_EXCEEDED` | Request throttled (e.g., >5 failed login attempts in 15 mins). |
| **500 Internal Error**| `INTERNAL_SERVER_ERROR` | Unhandled server error (tracebacks sanitized in production). |

### 1.6 Data Types, Dates & Currency
- **Dates:** Stored and formatted as ISO-8601 calendar strings: `YYYY-MM-DD` (e.g., `2026-10-10`).
- **Timestamps:** Localized ISO-8601 datetime strings: `YYYY-MM-DDTHH:MM:SS` (Club Timezone: `Asia/Kolkata` / UTC+05:30).
- **Currency & Money:** All financial prices and amounts are represented in **INR (₹)** as floating-point numbers rounded to 2 decimal places in JSON (e.g., `800.00`). In online Razorpay gateway integrations, amounts are converted to integer paise (`₹1.00 = 100 paise`).

### 1.7 Role-Based Access Control (RBAC) Matrix
The system enforces 7 distinct hierarchical roles:
1. `OWNER`: Full administrative, financial, configuration, and security control.
2. `ADMIN`: Operational management, staff roles, court overrides, membership approvals.
3. `FRONT_DESK`: Reception, member check-ins, court bookings, walk-in guest reservations.
4. `SHOP_STAFF`: Pro shop point-of-sale, retail discounts, racket inventory management.
5. `BAR_STAFF`: Lounge and café point-of-sale, table management, member tabs.
6. `COACH`: Training schedule visibility, clinics, student attendance, court condition notes.
7. `MEMBER`: Self-service court bookings, profile management, subscription receipts.

---

## 2. Health & Common Endpoints

### 2.1 API Health Check
- **Endpoint:** `GET /health` or `GET /api/v1/health`
- **Authentication:** None (Public)
- **Role Requirement:** None
- **Query Parameters:** None
- **Success Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "service": "champions-club-api",
    "environment": "production",
    "database": "healthy"
  },
  "message": "Champions Club API is operational"
}
```
- **Error Response (`503 Service Unavailable`):**
```json
{
  "success": false,
  "error": {
    "code": "SERVICE_UNHEALTHY",
    "message": "Database connectivity check failed",
    "details": {
      "database": "unhealthy: connection refused"
    }
  }
}
```

---

## 3. Authentication & User Access Endpoints (`/api/v1/auth`)

### 3.1 Member Self-Registration
- **Endpoint:** `POST /api/v1/auth/register`
- **Authentication:** None (Public)
- **Role Requirement:** None (Public)
- **Request Body:**
```json
{
  "email": "alex.morgan@example.com",
  "password": "SecurePassword123!",
  "first_name": "Alex",
  "last_name": "Morgan"
}
```
- **Validation Rules:**
  - `email`: Valid email format, maximum 120 characters, case-insensitive uniqueness.
  - `password`: Minimum 8 characters, at least 1 uppercase letter, 1 lowercase letter, 1 digit.
  - `first_name`, `last_name`: Required, 1–50 characters.
- **Success Response (`201 Created`):**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "Bearer",
    "user": {
      "id": 12,
      "email": "alex.morgan@example.com",
      "first_name": "Alex",
      "last_name": "Morgan",
      "role": "MEMBER",
      "department": null,
      "is_active": true,
      "created_at": "2026-10-03T18:00:00"
    }
  },
  "message": "Account created successfully"
}
```
- **Business Rules:**
  - Automatically provisions an underlying `Member` profile record linked to the user account.
  - Returns an active access token immediately to log the user in.

### 3.2 User Login
- **Endpoint:** `POST /api/v1/auth/login`
- **Authentication:** None (Public)
- **Request Body:**
```json
{
  "email": "alex.morgan@example.com",
  "password": "SecurePassword123!"
}
```
- **Success Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "Bearer",
    "user": {
      "id": 12,
      "email": "alex.morgan@example.com",
      "first_name": "Alex",
      "last_name": "Morgan",
      "role": "MEMBER",
      "is_active": true
    }
  },
  "message": "Login successful"
}
```
- **Error Responses:**
  - `401 Unauthorized`: Invalid email or password (`INVALID_CREDENTIALS`).
  - `401 Unauthorized`: Account disabled by administrator (`ACCOUNT_DISABLED`).
  - `429 Too Many Requests`: 5 consecutive failed login attempts locks out IP/email for 15 minutes (`RATE_LIMIT_EXCEEDED`).

### 3.3 Google OAuth Sign-In / Sign-Up
- **Endpoint:** `POST /api/v1/auth/google`
- **Authentication:** None (Public)
- **Request Body:**
```json
{
  "credential": "<google_id_token_or_jwt_string>"
}
```
- **Success Response (`200 OK`):** Returns standard user object and JWT access token.
- **Business Rules:**
  - If user exists by email, authenticates existing account.
  - If user does not exist, registers new user with `RoleEnum.MEMBER` and provisions member profile.

### 3.4 Get Current User Profile
- **Endpoint:** `GET /api/v1/auth/me`
- **Authentication:** Required (`jwt_required`)
- **Success Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 12,
      "email": "alex.morgan@example.com",
      "first_name": "Alex",
      "last_name": "Morgan",
      "role": "MEMBER",
      "department": null,
      "is_active": true
    }
  }
}
```

### 3.5 List System Roles & Capabilities
- **Endpoint:** `GET /api/v1/auth/roles`
- **Authentication:** None (Public / UI helper)
- **Success Response (`200 OK`):** Returns array of all 7 roles with titles, descriptions, and permission bullet points.

### 3.6 Admin: List Users
- **Endpoint:** `GET /api/v1/auth/users`
- **Authentication:** Required
- **Role Requirement:** `OWNER`, `ADMIN`
- **Query Parameters:**
  - `role` (string, optional): Filter by role (`MEMBER`, `COACH`, `FRONT_DESK`, etc.)
  - `q` (string, optional): Search by name or email.
  - `is_active` (boolean, optional): `true` or `false`.
  - `page` (int, default: 1), `per_page` (int, default: 50).
- **Success Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": 1,
        "email": "owner@championsclub.in",
        "first_name": "Club",
        "last_name": "Owner",
        "role": "OWNER",
        "department": "Executive",
        "is_active": true
      }
    ]
  },
  "meta": { "total": 1, "page": 1, "per_page": 50 }
}
```

### 3.7 Admin: Create Staff / User Account
- **Endpoint:** `POST /api/v1/auth/users`
- **Authentication:** Required
- **Role Requirement:** `OWNER`, `ADMIN`
- **Request Body:**
```json
{
  "email": "coach.sam@championsclub.in",
  "password": "TemporaryPassword123!",
  "first_name": "Sam",
  "last_name": "Wilson",
  "role": "COACH",
  "department": "LAWN_TENNIS"
}
```
- **Success Response (`201 Created`):** Returns created user payload.

### 3.8 Admin: Update User Role
- **Endpoint:** `PATCH /api/v1/auth/users/<int:user_id>/role`
- **Authentication:** Required
- **Role Requirement:** `OWNER`, `ADMIN`
- **Request Body:**
```json
{
  "role": "ADMIN"
}
```
- **Business Rules:**
  - Only `OWNER` can assign or revoke the `OWNER` role.
  - `ADMIN` cannot modify an `OWNER`'s role.

### 3.9 Admin: Update User Status (Enable / Disable)
- **Endpoint:** `PATCH /api/v1/auth/users/<int:user_id>/status`
- **Authentication:** Required
- **Role Requirement:** `OWNER`, `ADMIN`
- **Request Body:**
```json
{
  "is_active": false
}
```
- **Business Rules:** A user cannot deactivate their own active account.

### 3.10 Admin: Update Employee Department
- **Endpoint:** `PATCH /api/v1/auth/users/<int:user_id>/department`
- **Authentication:** Required
- **Role Requirement:** `OWNER`, `ADMIN`
- **Request Body:** `{"department": "SWIMMING_POOL"}`

### 3.11 Admin: Assign Custom Access via Email
- **Endpoint:** `POST /api/v1/auth/assign-access`
- **Authentication:** Required
- **Role Requirement:** `OWNER`, `ADMIN`
- **Request Body:**
```json
{
  "email": "instructor@gmail.com",
  "role": "COACH",
  "department": "BADMINTON",
  "first_name": "Rohan",
  "last_name": "Bopanna"
}
```

---

## 4. Members Endpoints (`/api/v1/members`)

### 4.1 Search & List Member Directory
- **Endpoint:** `GET /api/v1/members`
- **Authentication:** Required
- **Role Requirement:** `OWNER`, `ADMIN`, `FRONT_DESK`, `SHOP_STAFF`, `BAR_STAFF`, `COACH`
- **Query Parameters:**
  - `q` (string): Keyword matching member name, email, or phone.
  - `plan` (string): Filter by active plan code (`GOLD`, `SILVER`, `JUNIOR`).
  - `is_active` (bool): Filter by active membership status.
  - `page` (int, default: 1), `per_page` (int, default: 20).
- **Success Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "members": [
      {
        "id": 1,
        "user_id": 5,
        "membership_number": "CC-M-000001",
        "phone": "+91 98765 43210",
        "date_of_birth": "1992-05-14",
        "gender": "FEMALE",
        "address": "42 Championship Ave, Bengaluru",
        "emergency_contact_name": "John Doe",
        "emergency_contact_phone": "+91 98765 00000",
        "user": {
          "id": 5,
          "email": "alice@club.com",
          "first_name": "Alice",
          "last_name": "Walker"
        },
        "active_membership": {
          "id": 1,
          "plan_code": "GOLD",
          "plan_name": "Gold Champion",
          "start_date": "2026-01-01",
          "end_date": "2026-12-31",
          "is_active": true
        }
      }
    ]
  },
  "meta": { "total": 1, "page": 1, "per_page": 20 }
}
```

### 4.2 Get My Member Profile
- **Endpoint:** `GET /api/v1/members/me`
- **Authentication:** Required (`jwt_required`)
- **Success Response (`200 OK`):** Returns profile of logged-in user with active membership subscription.

### 4.3 Create Member Profile
- **Endpoint:** `POST /api/v1/members`
- **Authentication:** Required
- **Role Requirement:** Any authenticated user (Regular members can only supply their own `user_id`).
- **Request Body:**
```json
{
  "user_id": 12,
  "phone": "+91 98765 43210",
  "date_of_birth": "1995-08-20",
  "gender": "MALE",
  "address": "100 Indiranagar, Bengaluru",
  "emergency_contact_name": "Sarah Morgan",
  "emergency_contact_phone": "+91 98765 11111"
}
```

### 4.4 Get Member By ID
- **Endpoint:** `GET /api/v1/members/<int:member_id>`
- **Authentication:** Required
- **Role Requirement:** Staff roles or Member viewing own profile. `403 Forbidden` if a member attempts to read another member's profile.

### 4.5 Update Member Profile
- **Endpoint:** `PUT /api/v1/members/<int:member_id>` or `PATCH /api/v1/members/<int:member_id>`
- **Authentication:** Required
- **Role Requirement:** Staff roles or Member updating own profile.
- **Request Body:** Accepts partial or full fields: `phone`, `date_of_birth`, `gender`, `address`, `emergency_contact_name`, `emergency_contact_phone`.

---

## 5. Memberships & Plans Endpoints (`/api/v1/membership-plans`, `/api/v1/members`)

### 5.1 List Membership Plans
- **Endpoint:** `GET /api/v1/membership-plans`
- **Authentication:** None (Public)
- **Success Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "plans": [
      {
        "id": 1,
        "name": "Gold Champion",
        "code": "GOLD",
        "displayed_monthly_price": 5000.00,
        "duration_months": 12,
        "benefits": {
          "court_discount_percent": 100.0,
          "shop_discount_percent": 20.0,
          "priority_booking_days": 7,
          "free_guest_passes": 4
        },
        "is_active": true
      },
      {
        "id": 2,
        "name": "Silver Tier",
        "code": "SILVER",
        "displayed_monthly_price": 2500.00,
        "duration_months": 12,
        "benefits": {
          "court_discount_percent": 50.0,
          "shop_discount_percent": 10.0,
          "priority_booking_days": 3
        },
        "is_active": true
      },
      {
        "id": 3,
        "name": "Junior Academy",
        "code": "JUNIOR",
        "displayed_monthly_price": 1500.00,
        "duration_months": 12,
        "benefits": {
          "court_discount_percent": 50.0,
          "coaching_discount_percent": 25.0
        },
        "is_active": true
      }
    ]
  }
}
```

### 5.2 Get Plan Details
- **Endpoint:** `GET /api/v1/membership-plans/<int:plan_id>`
- **Authentication:** None (Public)

### 5.3 Member Active Membership
- **Endpoint:** `GET /api/v1/members/<int:member_id>/memberships/active`
- **Authentication:** Required
- **Role Requirement:** Staff or Member self-access.
- **Success Response (`200 OK`):** Returns active membership object, or `{"active_membership": null}` if unassigned or expired.

### 5.4 List Member Membership History
- **Endpoint:** `GET /api/v1/members/<int:member_id>/memberships`
- **Authentication:** Required
- **Role Requirement:** Staff or Member self-access.
- **Success Response (`200 OK`):** Returns array of historical and active membership periods.

### 5.5 Assign Initial Membership Plan (Admin/Staff)
- **Endpoint:** `POST /api/v1/members/<int:member_id>/memberships`
- **Authentication:** Required
- **Role Requirement:** `OWNER`, `ADMIN`, `FRONT_DESK`
- **Request Body:**
```json
{
  "plan_id": 1,
  "start_date": "2026-10-10",
  "duration_months": 12,
  "price_paid": 50000.00,
  "notes": "Annual upfront bank payment"
}
```
- **Business Rules:**
  - `JUNIOR` plan strictly rejects members who are 18 years or older on `start_date` (`422 Validation Error`).
  - Active/expired state is dynamically computed from `start_date <= today <= end_date`.

### 5.6 Change / Upgrade / Downgrade Membership Plan
- **Endpoint:** `POST /api/v1/members/<int:member_id>/memberships/change-plan`
- **Authentication:** Required
- **Role Requirement:** `OWNER`, `ADMIN`, `FRONT_DESK`
- **Request Body:**
```json
{
  "new_plan_id": 1,
  "effective_date": "2026-11-01",
  "price_paid": 25000.00,
  "notes": "Upgraded from Silver to Gold"
}
```
- **Business Rules:**
  - Preserves previous membership history by terminating the old membership period on `effective_date - 1 day` without corrupting historic court bookings.

### 5.7 Submit Membership Payment Request (Member Self-Service)
- **Endpoint:** `POST /api/v1/members/requests`
- **Authentication:** Required (`jwt_required`)
- **Request Body:**
```json
{
  "plan_id": 1,
  "transaction_reference": "UPI-UTR-987654321012",
  "amount_paid": 5000.00,
  "screenshot_url": "/api/v1/memberships/proofs/payment_proof_abc123.jpg",
  "payment_method": "UPI_QR",
  "requester_notes": "Paid via Google Pay"
}
```
- **Business Rules:** Always starts in `PENDING` state awaiting staff review.

### 5.8 Get My Submitted Membership Requests
- **Endpoint:** `GET /api/v1/members/requests/my`
- **Authentication:** Required (`jwt_required`)
- **Query Parameters:** `status` (`PENDING`, `APPROVED`, `REJECTED`), `page`, `per_page`.

### 5.9 Admin: List All Membership Requests
- **Endpoint:** `GET /api/v1/members/requests`
- **Authentication:** Required
- **Role Requirement:** `OWNER`, `ADMIN`
- **Query Parameters:** `status`, `q`, `page`, `per_page`.

### 5.10 Admin: Approve Membership Request
- **Endpoint:** `POST /api/v1/members/requests/<int:request_id>/approve`
- **Authentication:** Required
- **Role Requirement:** `OWNER`, `ADMIN`
- **Request Body:** `{"review_notes": "UTR verified against bank statement"}`
- **Business Rules:** Changes request status to `APPROVED`, automatically activates the member's subscription plan, and records the reviewer user.

### 5.11 Admin: Reject Membership Request
- **Endpoint:** `POST /api/v1/members/requests/<int:request_id>/reject`
- **Authentication:** Required
- **Role Requirement:** `OWNER`, `ADMIN`
- **Request Body:** `{"review_notes": "Invalid UTR reference"}`

### 5.12 Upload Payment Screenshot Proof
- **Endpoint:** `POST /api/v1/members/upload-proof`
- **Authentication:** Required (`jwt_required`)
- **Payload:** Accepts `multipart/form-data` with `file` (PNG, JPG, JPEG, WEBP, PDF) OR JSON `{"image_data": "data:image/png;base64,..."}`.
- **Success Response (`201 Created`):** `{"url": "/api/v1/memberships/proofs/filename.jpg"}`

---

## 6. Courts & Availability Endpoints (`/api/v1/courts`)

### 6.1 List & Filter Courts
- **Endpoint:** `GET /api/v1/courts`
- **Authentication:** None (Public)
- **Query Parameters:**
  - `sport_type` or `sport` (string): `LAWN_TENNIS`, `SWIMMING_POOL`, `BADMINTON`, `BOX_CRICKET`, `TABLE_TENNIS`, `VOLLEYBALL`.
  - `status` (string): `ACTIVE`, `MAINTENANCE`, `INACTIVE`.
  - `is_indoor` (bool): `true` or `false`.
  - `q` (string): Search query by court name.
- **Success Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "courts": [
      {
        "id": 1,
        "name": "Centre Court (Grass)",
        "sport_type": "LAWN_TENNIS",
        "surface_type": "Grass",
        "is_indoor": false,
        "status": "ACTIVE",
        "custom_open_time": null,
        "custom_close_time": null,
        "features": { "floodlights": true, "scoreboard": true },
        "description": "Championship grass tennis court",
        "hourly_rate": 800.00
      }
    ]
  },
  "meta": { "total": 1 }
}
```

### 6.2 Court Availability Foundation
- **Endpoint:** `GET /api/v1/courts/availability`
- **Authentication:** None (Public)
- **Query Parameters:**
  - `date` (string, **Required**): Target date in `YYYY-MM-DD` format.
  - `sport_type` (string, optional): Filter by sport.
  - `court_id` (int, optional): Filter by specific court.
- **Success Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "date": "2026-10-10",
    "club_operating_hours": {
      "open_time": "06:00",
      "close_time": "22:00",
      "slot_duration_minutes": 60,
      "slot_interval_minutes": 30
    },
    "courts": [
      {
        "court_id": 1,
        "court_name": "Centre Court (Grass)",
        "sport_type": "LAWN_TENNIS",
        "hourly_rate": 800.00,
        "slots": [
          {
            "start_time": "06:00",
            "end_time": "07:00",
            "is_available": true
          },
          {
            "start_time": "06:30",
            "end_time": "07:30",
            "is_available": true
          }
        ]
      }
    ]
  }
}
```
- **Business Rules:**
  - New 60-minute booking slots open every 30 minutes from 06:00 to 22:00 (last slot starts at 21:00).
  - Maintenance and inactive courts are automatically excluded.

### 6.3 Get Single Court Detail
- **Endpoint:** `GET /api/v1/courts/<int:court_id>`
- **Authentication:** None (Public)

### 6.4 Admin: Create Court
- **Endpoint:** `POST /api/v1/courts`
- **Authentication:** Required
- **Role Requirement:** `OWNER`, `ADMIN`
- **Request Body:**
```json
{
  "name": "Olympic Swimming Pool",
  "sport_type": "SWIMMING_POOL",
  "surface_type": "Tile",
  "is_indoor": true,
  "status": "ACTIVE",
  "features": { "lane_count": 8, "heated": true }
}
```

### 6.5 Admin: Update Court
- **Endpoint:** `PUT /api/v1/courts/<int:court_id>` or `PATCH /api/v1/courts/<int:court_id>`
- **Authentication:** Required
- **Role Requirement:** `OWNER`, `ADMIN`

---

## 7. Booking Engine Endpoints (`/api/v1/bookings`)

### 7.1 Create Court Booking
- **Endpoint:** `POST /api/v1/bookings`
- **Authentication:** Required
- **Role Requirement:** `OWNER`, `ADMIN`, `FRONT_DESK`, `MEMBER`
- **Request Body (Member Booking):**
```json
{
  "court_id": 1,
  "start_time": "2026-10-10T10:00:00",
  "is_social_play": false,
  "notes": "Singles practice session"
}
```
- **Request Body (Staff Walk-in Booking):**
```json
{
  "court_id": 1,
  "start_time": "2026-10-10T10:00:00",
  "is_walk_in": true,
  "guest_name": "Roger Federer",
  "guest_phone": "+91 98765 00000",
  "guest_email": "roger@example.com"
}
```
- **Success Response (`201 Created`):**
```json
{
  "success": true,
  "data": {
    "id": 15,
    "booking_reference": "BK-41B1FB60",
    "court_id": 1,
    "member_id": 1,
    "user_id": 5,
    "booking_date": "2026-10-10",
    "start_time": "2026-10-10T10:00:00+05:30",
    "end_time": "2026-10-10T11:00:00+05:30",
    "duration_minutes": 60,
    "status": "CONFIRMED",
    "base_price": 800.00,
    "discount_amount": 800.00,
    "final_price": 0.00,
    "is_walk_in": false,
    "is_social_play": false,
    "cancellation_reason": null,
    "cancelled_at": null,
    "court": {
      "id": 1,
      "name": "Centre Court (Grass)",
      "sport_type": "LAWN_TENNIS"
    }
  },
  "message": "Booking confirmed successfully."
}
```
- **Critical Booking Engine Rules:**
  - **Slot Alignment:** Bookings must align to exactly 30-minute boundary increments (e.g., `:00` or `:30`).
  - **Operating Hours:** Sessions must fall entirely within court operating hours (06:00 to 22:00).
  - **Daily Booking Limits:** A member can hold at most **2 confirmed bookings per day** (`409 Conflict: DAILY_LIMIT_EXCEEDED`).
  - **Conflict Prevention:** Concurrent bookings for the same court slot are atomically rejected using database occupancy locks (`409 Conflict: BOOKING_CONFLICT`).
  - **Member Pricing:**
    - `GOLD`: 100% discount (₹0.00).
    - `SILVER` / `JUNIOR`: 50% discount.
    - Walk-in / Expired: Full base hourly rate.
  - **Friday Social Play:** Available on Friday evenings (18:00–21:00) at flat ₹200/hour social rate.

### 7.2 List & Filter Bookings
- **Endpoint:** `GET /api/v1/bookings`
- **Authentication:** Required
- **Role Requirement:** `OWNER`, `ADMIN`, `FRONT_DESK`, `COACH`, `MEMBER`
- **Query Parameters:**
  - `court_id` (int), `sport_type` (string), `date` (YYYY-MM-DD), `start_date` (YYYY-MM-DD), `end_date` (YYYY-MM-DD), `status` (`CONFIRMED`, `CANCELLED`, `COMPLETED`), `is_walk_in` (bool), `is_social_play` (bool).
- **Business Rules:** Members only receive their own bookings; Staff roles receive cross-club bookings.

### 7.3 Get Single Booking Detail
- **Endpoint:** `GET /api/v1/bookings/<int:booking_id>`
- **Authentication:** Required
- **Role Requirement:** Staff or booking owner.

### 7.4 Cancel Court Booking
- **Endpoint:** `POST /api/v1/bookings/<int:booking_id>/cancel`
- **Authentication:** Required
- **Role Requirement:** `OWNER`, `ADMIN`, `FRONT_DESK`, or Member owner.
- **Request Body:**
```json
{
  "reason": "Sudden travel schedule change"
}
```
- **Business Rules:** Releases the court occupancy slots for other players and retains audit history with timestamp and reason.

### 7.5 Get Member Booking History
- **Endpoint:** `GET /api/v1/bookings/members/<int:member_id>/history` (Staff/Self) or `GET /api/v1/bookings/my-history` (Member)
- **Authentication:** Required

### 7.6 Staff: Department Schedule
- **Endpoint:** `GET /api/v1/bookings/department-schedule`
- **Authentication:** Required
- **Query Parameters:** `sport` (optional filter).
- **Success Response (`200 OK`):** Returns department-filtered court list and today's schedule.

### 7.7 Staff: Toggle Court Maintenance
- **Endpoint:** `POST /api/v1/bookings/courts/<int:court_id>/maintenance`
- **Authentication:** Required
- **Request Body:** `{"status": "MAINTENANCE", "notes": "Court resurfacing in progress"}`

---

## 8. Payments Engine Endpoints (`/api/v1/payments`)

### 8.1 Create or Initiate Payment
- **Endpoint:** `POST /api/v1/payments`
- **Authentication:** Required
- **Role Requirement:** `OWNER`, `ADMIN`, `FRONT_DESK`, `SHOP_STAFF`, `BAR_STAFF`, `MEMBER`
- **Request Body:**
```json
{
  "item_type": "BOOKING",
  "item_id": 15,
  "amount": 400.00,
  "payment_method": "ONLINE",
  "notes": "Online Razorpay payment for court reservation"
}
```
- **Supported `payment_method` Values:** `CASH`, `CARD`, `UPI`, `ONLINE`.
- **Supported `item_type` Values:** `BOOKING`, `MEMBERSHIP`, `SHOP_ORDER`, `BAR_TAB`, `INVOICE`.
- **Success Response (`201 Created` for ONLINE):**
```json
{
  "success": true,
  "data": {
    "id": 101,
    "transaction_reference": "TXN-A1B2C3D4",
    "item_type": "BOOKING",
    "item_id": 15,
    "amount": 400.00,
    "currency": "INR",
    "payment_method": "ONLINE",
    "status": "PENDING",
    "gateway_provider": "RAZORPAY",
    "gateway_order_id": "order_EKfWClPXqw2b4x",
    "gateway_payment_id": null,
    "notes": "Online Razorpay payment for court reservation",
    "created_at": "2026-10-03T18:00:00+05:30",
    "public_key_id": "rzp_test_placeholder_key_id"
  },
  "message": "Payment initiated successfully."
}
```

### 8.2 Verify Online Razorpay Payment
- **Endpoint:** `POST /api/v1/payments/verify`
- **Authentication:** Required
- **Request Body:**
```json
{
  "razorpay_order_id": "order_EKfWClPXqw2b4x",
  "razorpay_payment_id": "pay_EKfWClPXqw2b4x",
  "razorpay_signature": "4b6c4b22c83c0767be0e6538b7e..."
}
```
- **Business Rules:**
  - Verifies HMAC-SHA256 signature against `RAZORPAY_KEY_SECRET`.
  - Atomically marks payment status as `PAID`.

### 8.3 Staff: Confirm Offline Payment
- **Endpoint:** `POST /api/v1/payments/<int:payment_id>/confirm`
- **Authentication:** Required
- **Role Requirement:** `OWNER`, `ADMIN`, `FRONT_DESK`, `SHOP_STAFF`, `BAR_STAFF`
- **Request Body:** `{"notes": "Cash collected at counter"}`
- **Business Rules:** Only allowed for `CASH`, `CARD`, and `UPI`. Rejects `ONLINE` payments (`422 Validation Error`).

### 8.4 List & Filter Payments
- **Endpoint:** `GET /api/v1/payments`
- **Authentication:** Required
- **Query Parameters:** `status`, `payment_method`, `item_type`, `item_id`, `start_date`, `end_date`.

### 8.5 Get Single Payment Detail
- **Endpoint:** `GET /api/v1/payments/<int:payment_id>`
- **Authentication:** Required (Staff or item owner).

### 8.6 Cancel Pending Payment
- **Endpoint:** `POST /api/v1/payments/<int:payment_id>/cancel`
- **Authentication:** Required (Staff or payment creator).
- **Business Rules:** Can only cancel payments in `PENDING` or `FAILED` status.

### 8.7 Admin: Refund Payment
- **Endpoint:** `POST /api/v1/payments/<int:payment_id>/refund`
- **Authentication:** Required
- **Role Requirement:** `OWNER`, `ADMIN`
- **Request Body:** `{"reason": "Court maintenance closure refund"}`

### 8.8 Razorpay Webhook Receiver
- **Endpoint:** `POST /api/v1/payments/webhook`
- **Authentication:** None (Public / Signature-Verified)
- **Headers:** `X-Razorpay-Signature: <hmac_sha256_hex>`
- **Business Rules:** Verifies cryptographic signature over raw request bytes using `RAZORPAY_WEBHOOK_SECRET`. Handles `payment.captured`, `payment.failed`, and `refund.processed` events with full idempotency.

---

## 9. Contract Changes Since Earlier Phases

1. **Finalized Sports List Alignment:**
   - Court sport types updated from legacy 4 sports to the finalized 6 sports: `LAWN_TENNIS`, `SWIMMING_POOL`, `BADMINTON`, `BOX_CRICKET`, `TABLE_TENNIS`, and `VOLLEYBALL`.
2. **Standardized Response Envelope:**
   - Standardized `meta` dictionary across all paginated listing routes (`total`, `page`, `per_page`).
3. **Structured Benefits Schema:**
   - Membership plans now return JSON `benefits` dictionaries containing explicit discount percentages (`court_discount_percent`, `shop_discount_percent`, `priority_booking_days`) and `displayed_monthly_price`.
4. **Member Self-Service Payment Receipts:**
   - Added `/api/v1/members/requests` workflow allowing members to upload UPI/QR payment receipts with transaction UTR numbers for staff review.

---

## 10. Contract Consistency & Implementation Notes

- **Court Availability Date:** Query parameter `date` is required on `/api/v1/courts/availability` in `YYYY-MM-DD` format.
- **Timezone Standardization:** The backend standardizes on `Asia/Kolkata` (UTC+05:30). Frontend clients should send ISO datetime strings or local datetime strings, and all responses return localized ISO strings.
- **Razorpay Public Key:** When initiating an `ONLINE` payment via `POST /api/v1/payments`, the backend automatically includes `public_key_id` in the response payload to allow the Next.js frontend to open the Razorpay Checkout modal directly.

---

## Crm Endpoints (`/api/v1/crm`)

### Api Update Follow Up
- **Endpoint:** `PATCH /api/v1/crm/follow-ups/<int:follow_up_id>`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Api Follow Ups Due Today
- **Endpoint:** `GET /api/v1/crm/follow-ups/due-today`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Query Parameters:** (TODO: Fill params)
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Api List Leads
- **Endpoint:** `GET /api/v1/crm/leads`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Query Parameters:** (TODO: Fill params)
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Api Get Lead
- **Endpoint:** `GET /api/v1/crm/leads/<int:lead_id>`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Query Parameters:** (TODO: Fill params)
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Api Update Lead
- **Endpoint:** `PATCH /api/v1/crm/leads/<int:lead_id>`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Api Convert Lead
- **Endpoint:** `POST /api/v1/crm/leads/<int:lead_id>/convert`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Api Create Follow Up
- **Endpoint:** `POST /api/v1/crm/leads/<int:lead_id>/follow-ups`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Api Mark Lost
- **Endpoint:** `POST /api/v1/crm/leads/<int:lead_id>/lost`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Api Add Note
- **Endpoint:** `POST /api/v1/crm/leads/<int:lead_id>/notes`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Api Create Quote
- **Endpoint:** `POST /api/v1/crm/leads/<int:lead_id>/quotes`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Api Request Trial
- **Endpoint:** `POST /api/v1/crm/leads/<int:lead_id>/trial`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Api Public Availability
- **Endpoint:** `GET /api/v1/crm/public/availability`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Query Parameters:** (TODO: Fill params)
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Api Public Club Info
- **Endpoint:** `GET /api/v1/crm/public/club-info`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Query Parameters:** (TODO: Fill params)
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Api Public Enquiry
- **Endpoint:** `POST /api/v1/crm/public/enquiries`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Api Public Plans
- **Endpoint:** `GET /api/v1/crm/public/plans`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Query Parameters:** (TODO: Fill params)
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Api Public Products
- **Endpoint:** `GET /api/v1/crm/public/products`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Query Parameters:** (TODO: Fill params)
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Api Confirm Trial
- **Endpoint:** `POST /api/v1/crm/trial-sessions/<int:trial_id>/confirm`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)


---

## Employees Endpoints (`/api/v1/employees`)

### Get Employees
- **Endpoint:** `GET /api/v1/employees`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Query Parameters:** (TODO: Fill params)
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Post Employee
- **Endpoint:** `POST /api/v1/employees`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Get Single Employee
- **Endpoint:** `GET /api/v1/employees/<int:employee_id>`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Query Parameters:** (TODO: Fill params)
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Put Employee
- **Endpoint:** `PUT /api/v1/employees/<int:employee_id>`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Get Employee Linked Shifts
- **Endpoint:** `GET /api/v1/employees/<int:employee_id>/shifts`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Query Parameters:** (TODO: Fill params)
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Get Leave Requests
- **Endpoint:** `GET /api/v1/employees/leave`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Query Parameters:** (TODO: Fill params)
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Post Leave Request
- **Endpoint:** `POST /api/v1/employees/leave`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Put Approve Leave
- **Endpoint:** `POST /api/v1/employees/leave/<int:leave_id>/approve`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Put Approve Leave
- **Endpoint:** `PUT /api/v1/employees/leave/<int:leave_id>/approve`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Put Reject Leave
- **Endpoint:** `POST /api/v1/employees/leave/<int:leave_id>/reject`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Put Reject Leave
- **Endpoint:** `PUT /api/v1/employees/leave/<int:leave_id>/reject`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Get Payroll
- **Endpoint:** `GET /api/v1/employees/payroll`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Query Parameters:** (TODO: Fill params)
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Post Payroll
- **Endpoint:** `POST /api/v1/employees/payroll`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Put Pay Payroll
- **Endpoint:** `POST /api/v1/employees/payroll/<int:payroll_id>/pay`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Put Pay Payroll
- **Endpoint:** `PUT /api/v1/employees/payroll/<int:payroll_id>/pay`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)


---

## Inventory Endpoints (`/api/v1/inventory`)

### Create New Category
- **Endpoint:** `POST /api/v1/inventory/categories`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Get Categories
- **Endpoint:** `GET /api/v1/inventory/categories`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Query Parameters:** (TODO: Fill params)
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Get Category Detail
- **Endpoint:** `GET /api/v1/inventory/categories/<int:category_id>`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Query Parameters:** (TODO: Fill params)
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Update Category Endpoint
- **Endpoint:** `PATCH /api/v1/inventory/categories/<int:category_id>`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Update Category Endpoint
- **Endpoint:** `PUT /api/v1/inventory/categories/<int:category_id>`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Low Stock List Endpoint
- **Endpoint:** `GET /api/v1/inventory/low-stock`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Query Parameters:** (TODO: Fill params)
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### All Movements Endpoint
- **Endpoint:** `GET /api/v1/inventory/movements`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Query Parameters:** (TODO: Fill params)
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Create New Product
- **Endpoint:** `POST /api/v1/inventory/products`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Get Products
- **Endpoint:** `GET /api/v1/inventory/products`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Query Parameters:** (TODO: Fill params)
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Delete Product Endpoint
- **Endpoint:** `DELETE /api/v1/inventory/products/<int:product_id>`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Get Product Detail
- **Endpoint:** `GET /api/v1/inventory/products/<int:product_id>`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Query Parameters:** (TODO: Fill params)
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Update Product Endpoint
- **Endpoint:** `PATCH /api/v1/inventory/products/<int:product_id>`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Update Product Endpoint
- **Endpoint:** `PUT /api/v1/inventory/products/<int:product_id>`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Stock Adjust Endpoint
- **Endpoint:** `POST /api/v1/inventory/products/<int:product_id>/adjust`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Product Movements Endpoint
- **Endpoint:** `GET /api/v1/inventory/products/<int:product_id>/movements`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Query Parameters:** (TODO: Fill params)
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Restock Product Endpoint
- **Endpoint:** `POST /api/v1/inventory/products/<int:product_id>/stock-in`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Stock Out Endpoint
- **Endpoint:** `POST /api/v1/inventory/products/<int:product_id>/stock-out`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Validate Cart Endpoint
- **Endpoint:** `POST /api/v1/inventory/validate`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)


---

## Invoices Endpoints (`/api/v1/invoices`)

### Get Invoices
- **Endpoint:** `GET /api/v1/invoices`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Query Parameters:** (TODO: Fill params)
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Post Invoice
- **Endpoint:** `POST /api/v1/invoices`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Get Single Invoice
- **Endpoint:** `GET /api/v1/invoices/<int:invoice_id>`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Query Parameters:** (TODO: Fill params)
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Put Invoice
- **Endpoint:** `PUT /api/v1/invoices/<int:invoice_id>`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Post Issue Invoice
- **Endpoint:** `POST /api/v1/invoices/<int:invoice_id>/issue`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Post Pay Invoice
- **Endpoint:** `POST /api/v1/invoices/<int:invoice_id>/pay`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Post Void Invoice
- **Endpoint:** `POST /api/v1/invoices/<int:invoice_id>/void`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Get Clients
- **Endpoint:** `GET /api/v1/invoices/clients`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Query Parameters:** (TODO: Fill params)
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Post Client
- **Endpoint:** `POST /api/v1/invoices/clients`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Get Single Client
- **Endpoint:** `GET /api/v1/invoices/clients/<int:client_id>`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Query Parameters:** (TODO: Fill params)
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Put Client
- **Endpoint:** `PUT /api/v1/invoices/clients/<int:client_id>`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Get Tax Rates
- **Endpoint:** `GET /api/v1/invoices/tax-rates`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Query Parameters:** (TODO: Fill params)
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Post Tax Rate
- **Endpoint:** `POST /api/v1/invoices/tax-rates`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Get Tax Report
- **Endpoint:** `GET /api/v1/invoices/tax-summary`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Query Parameters:** (TODO: Fill params)
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)


---

## Pos Endpoints (`/api/v1/pos`)

### Api Daily Sales
- **Endpoint:** `GET /api/v1/pos/daily-sales`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Query Parameters:** (TODO: Fill params)
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Api Update Kitchen Status
- **Endpoint:** `POST /api/v1/pos/kitchen/items/<int:item_id>/status`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Api Kitchen Queue
- **Endpoint:** `GET /api/v1/pos/kitchen/queue`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Query Parameters:** (TODO: Fill params)
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Api Create Menu Item
- **Endpoint:** `POST /api/v1/pos/menu`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Api List Menu
- **Endpoint:** `GET /api/v1/pos/menu`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Query Parameters:** (TODO: Fill params)
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Api Update Menu Item
- **Endpoint:** `PATCH /api/v1/pos/menu/<int:item_id>`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Api Update Menu Item
- **Endpoint:** `PUT /api/v1/pos/menu/<int:item_id>`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Api Create Category
- **Endpoint:** `POST /api/v1/pos/menu/categories`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Api List Categories
- **Endpoint:** `GET /api/v1/pos/menu/categories`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Query Parameters:** (TODO: Fill params)
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Api List Shifts
- **Endpoint:** `GET /api/v1/pos/shifts`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Query Parameters:** (TODO: Fill params)
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Api Current Shift
- **Endpoint:** `GET /api/v1/pos/shifts/current`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Query Parameters:** (TODO: Fill params)
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Api End Shift
- **Endpoint:** `POST /api/v1/pos/shifts/end`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Api Start Shift
- **Endpoint:** `POST /api/v1/pos/shifts/start`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Api Create Table
- **Endpoint:** `POST /api/v1/pos/tables`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Api List Tables
- **Endpoint:** `GET /api/v1/pos/tables`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Query Parameters:** (TODO: Fill params)
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Api Get Table
- **Endpoint:** `GET /api/v1/pos/tables/<int:table_id>`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Query Parameters:** (TODO: Fill params)
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Api Update Table
- **Endpoint:** `PATCH /api/v1/pos/tables/<int:table_id>`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Api Update Table
- **Endpoint:** `PUT /api/v1/pos/tables/<int:table_id>`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Api List Tabs
- **Endpoint:** `GET /api/v1/pos/tabs`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Query Parameters:** (TODO: Fill params)
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Api Open Tab
- **Endpoint:** `POST /api/v1/pos/tabs`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Api Get Tab
- **Endpoint:** `GET /api/v1/pos/tabs/<int:tab_id>`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Query Parameters:** (TODO: Fill params)
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Api Close Tab
- **Endpoint:** `POST /api/v1/pos/tabs/<int:tab_id>/close`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Api Add Items
- **Endpoint:** `POST /api/v1/pos/tabs/<int:tab_id>/items`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Api Send To Kitchen
- **Endpoint:** `POST /api/v1/pos/tabs/<int:tab_id>/kitchen/send`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Api Pay Tab
- **Endpoint:** `POST /api/v1/pos/tabs/<int:tab_id>/pay`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Api Void Tab
- **Endpoint:** `POST /api/v1/pos/tabs/<int:tab_id>/void`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)


---

## Reports Endpoints (`/api/v1/reports`)

### Get Bar Report
- **Endpoint:** `GET /api/v1/reports/bar`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Query Parameters:** (TODO: Fill params)
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Get Courts Report
- **Endpoint:** `GET /api/v1/reports/courts`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Query Parameters:** (TODO: Fill params)
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Get Overview
- **Endpoint:** `GET /api/v1/reports/dashboard`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Query Parameters:** (TODO: Fill params)
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Export Report Excel
- **Endpoint:** `POST /api/v1/reports/export`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Get Memberships Report
- **Endpoint:** `GET /api/v1/reports/memberships`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Query Parameters:** (TODO: Fill params)
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Get Operations
- **Endpoint:** `GET /api/v1/reports/operations`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Query Parameters:** (TODO: Fill params)
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Get Overview
- **Endpoint:** `GET /api/v1/reports/overview`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Query Parameters:** (TODO: Fill params)
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Get Revenue
- **Endpoint:** `GET /api/v1/reports/revenue`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Query Parameters:** (TODO: Fill params)
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Get Shop Report
- **Endpoint:** `GET /api/v1/reports/shop`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Query Parameters:** (TODO: Fill params)
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)


---

## Shop Endpoints (`/api/v1/shop`)

### Create Order Endpoint
- **Endpoint:** `POST /api/v1/shop/orders`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### List Orders Endpoint
- **Endpoint:** `GET /api/v1/shop/orders`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Query Parameters:** (TODO: Fill params)
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Get Order Endpoint
- **Endpoint:** `GET /api/v1/shop/orders/<int:order_id>`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Query Parameters:** (TODO: Fill params)
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Cancel Order Endpoint
- **Endpoint:** `POST /api/v1/shop/orders/<int:order_id>/cancel`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### Update Status Endpoint
- **Endpoint:** `POST /api/v1/shop/orders/<int:order_id>/status`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Request Body:**
```json
{
}
```
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

### My Orders Endpoint
- **Endpoint:** `GET /api/v1/shop/orders/my-orders`
- **Authentication:** Required
- **Role Requirement:** (TODO: Fill role)
- **Query Parameters:** (TODO: Fill params)
- **Success Response:**
```json
{
  "success": true,
  "data": {}
}
```
- **Business Rules:** (TODO: Add rules)

