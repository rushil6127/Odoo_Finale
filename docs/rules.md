# Champions Club — Engineering Rules

## 1. General Rules
- Keep the architecture modular but simple.
- Prefer readable code over clever code.
- Do not introduce a library without a clear problem it solves.
- Keep business rules in backend services, not only in the frontend.
- The frontend must never be treated as the source of truth for permissions, pricing, inventory, or booking conflicts.

## 2. Backend Rules
- Flask is responsible for API validation and business logic.
- Use SQLAlchemy for database access.
- Use migrations for schema changes.
- Use environment variables for secrets and configuration.
- Never hard-code JWT secrets, database credentials, or email credentials.
- Return consistent JSON response structures.
- Validate all user-controlled input.
- Use appropriate HTTP status codes.
- Never expose stack traces or internal exception details to clients.

## 3. Authentication & Authorization
- JWT is required for protected API routes.
- Authentication answers "who are you?"
- Authorization answers "what can you do?"
- Roles must be enforced server-side.
- Suggested roles: OWNER, ADMIN, FRONT_DESK, SHOP_STAFF, BAR_STAFF, COACH, MEMBER.
- Never trust a role supplied only by the frontend.

## 4. Booking Rules
- A court cannot have overlapping confirmed bookings.
- A member can play/book at most twice per day according to the problem statement.
- Session length is one hour.
- New booking slots open every 30 minutes.
- Pricing must be calculated by backend rules.
- Cancellation must update booking state rather than silently deleting history.
- Social-play bookings must use explicit booking/session rules.

## 5. Inventory Rules
- Shop and online orders must use the same inventory source.
- Stock changes must be traceable to an order or inventory operation.
- Do not allow negative stock unless an explicit business rule is added.
- Low-stock thresholds should be configurable.

## 6. Payments
- Never store raw card details.
- Payment method should be represented as an enum/value such as CASH, CARD, UPI, ONLINE.
- Payment state must be explicit.
- Financial records should be auditable.

## 7. Errors
Use a consistent shape:

```json
{
  "success": false,
  "error": {
    "code": "BOOKING_CONFLICT",
    "message": "The court is already booked for this time."
  }
}
```

Do not return raw Python exceptions to clients.

## 8. Redis & Celery
Use Redis for caching and as the Celery broker where appropriate.

Use Celery for:
- Emails
- Notifications
- Report generation
- Excel exports
- Other non-critical background work

Do not move core transactional operations such as creating a booking or recording a payment entirely into an asynchronous job when the user needs immediate confirmation.

## 9. AI Coding Boundaries
AI may:
- Generate boilerplate
- Suggest refactors
- Generate tests
- Explain errors
- Draft API documentation
- Suggest implementation approaches

AI must not:
- Invent business requirements
- Change booking/pricing rules without approval
- Remove authorization checks to make code "work"
- Invent database relationships
- Add dependencies without justification
- Hide errors with broad exception handling
- Store secrets in code
- Replace validation with frontend assumptions

Every AI-generated code change must be reviewed by a team member.

## 10. What to Avoid
- Microservices for this hackathon
- Unnecessary state-management libraries
- Duplicate business logic in frontend and backend
- Direct database access from frontend
- Giant Flask route files
- Giant React components
- Hard-coded membership prices throughout the codebase
- Silent exception handling
- `except Exception: pass`
- Secrets committed to Git
- Premature optimization
