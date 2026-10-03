# Security Audit Report

## Phase: Security Audit & Hardening (Module B)
**Auditor**: Developer B
**Modules Audited**: Inventory, Shop, POS, CRM, Reports, Tasks, Finance/HR

### Findings and Resolutions

#### 1. Excessive Data Exposure (Inventory / Shop)
- **Vulnerability**: The `Product.to_dict()` method exposed internal `cost_price` and detailed profit margins to all clients, including unauthenticated public website visitors.
- **Severity**: High (Leaked wholesale costs to retail customers)
- **Resolution**: **Fixed**. Added an `include_cost` flag to `Product.to_dict()` which defaults to `False`. Updated `inventory/routes.py` to evaluate `current_user.role` (checking for `RoleEnum.SHOP_STAFF`, `ADMIN`, `OWNER`) and conditionally pass `include_cost=is_staff`. Public CRM endpoints (`/api/v1/crm/public/products`) were verified to use a safe serialization logic.
- **Status**: Closed.

#### 2. Insecure Direct Object Reference (IDOR) / Impersonation (Shop Orders)
- **Vulnerability**: `create_shop_order` in `shop/services.py` allowed any authenticated `MEMBER` to supply an arbitrary `member_id` in the payload and charge orders or deduct stock under a different member's account.
- **Severity**: High (Impersonation and fraudulent billing)
- **Resolution**: **Fixed**. Added an explicit ownership check in `shop/services.py`. If the requesting user has the `MEMBER` role, the backend forces the `member_id` to match the authenticated user's linked member profile.
- **Status**: Closed.

#### 3. Mass Assignment Risks
- **Vulnerability**: Analyzed controllers and services for instances of unchecked model `update()` calls from `request.get_json()`.
- **Severity**: Low
- **Resolution**: **Verified Safe**. The `pos`, `crm`, and `employees` modules all utilize strict `marshmallow` schemas (e.g., `UpdateTableSchema`, `CreateQuoteSchema`) or safely extract explicitly permitted fields using `payload.get()`. No dynamic/unchecked model assignments were found.
- **Status**: Closed.

#### 4. Environment Secrets Exposure
- **Vulnerability**: Sensitive broker and database variables falling back to predictable defaults in production environments.
- **Severity**: Medium
- **Resolution**: **Identified/Logged**. `backend/app/config.py` correctly uses `os.getenv` for `SECRET_KEY`, `JWT_SECRET_KEY`, and `DATABASE_URL`. It provides a hardcoded default string which is convenient for local development but risky for production if the `.env` variable is accidentally omitted.
- **Status**: Note for Devops (Production `.env` MUST be strictly enforced).

#### 5. Unsafe Serialization (RCE Risk)
- **Vulnerability**: Usage of `pickle`, `yaml.load`, `eval()`, or `exec()`.
- **Severity**: Critical
- **Resolution**: **Verified Safe**. Searched the codebase for unsafe deserialization functions. None exist. Data mapping leverages SQLAlchemy ORM and structured JSON/marshmallow.
- **Status**: Closed.

#### 6. Error & Logs Leakage
- **Vulnerability**: Detailed exception traces containing passwords or PII leaking to clients or appearing as plain text in centralized logging.
- **Severity**: Medium
- **Resolution**: **Verified Safe**. `backend/app/common/errors.py` employs a global `Exception` catch-all that returns a generic `INTERNAL_SERVER_ERROR` JSON payload to the client, preventing stack trace leakage. Additionally, reviewed `tasks/jobs.py` and `notifications/sender.py` to ensure plaintext passwords/tokens are not included in notification templates or logged.
- **Status**: Closed.

#### 7. Leave Request Ownership (HR)
- **Vulnerability**: IDOR allowing members/employees to view or cancel leave requests of others.
- **Severity**: High
- **Resolution**: **Verified Safe**. `employees/routes.py` enforces role checks before listing or mutating leave requests. Only users with `OWNER` or `ADMIN` roles can query leave for other employee IDs; otherwise, the request is forced to the authenticated user's linked employee profile.
- **Status**: Closed.

#### 8. Public Abuse Protection (CRM)
- **Vulnerability**: The public `/api/v1/crm/public/enquiries` endpoint lacks rate limiting, opening the door to CRM spam and denial-of-service via massive lead creation.
- **Severity**: Medium
- **Resolution**: The schema validates lengths and format to prevent long-payload attacks, but actual rate limiting is absent in the route layer.
- **Status**: **Open**. Needs infrastructure-level rate limiting (e.g., `Flask-Limiter` or API Gateway) in the future.
