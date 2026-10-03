import os
import re
import pytest
from scripts.dump_routes import get_developer_a_routes, get_registered_routes


def test_api_contract_covers_all_developer_a_routes(app):
    """Verify that every registered Developer A route is documented in docs/api-contract.md."""
    contract_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "docs", "api-contract.md")
    )
    assert os.path.exists(contract_path), f"Contract file not found at {contract_path}"

    with open(contract_path, "r", encoding="utf-8") as f:
        contract_content = f.read()

    dev_a_routes = get_developer_a_routes()
    missing_from_contract = []

    for route in dev_a_routes:
        method = route["method"]
        rule = route["rule"]

        # Normalize rule pattern for markdown matching (e.g. <int:court_id> -> <int:court_id> or :id)
        # Check for presence of `METHOD` and rule pattern in markdown
        rule_pattern = re.sub(r"<[^>]+>", r"[^ \n`]+", rule)
        # Pattern to match e.g. "POST /api/v1/bookings" or "`POST` | `/api/v1/bookings`"
        escaped_rule = re.escape(rule)
        escaped_rule_generic = re.sub(r"\\[<][a-z_:]+\\[>]", r"[^ \n`]+", escaped_rule)

        pattern = rf"{method}[ \t`|/]+{escaped_rule_generic}"
        if not re.search(pattern, contract_content, re.IGNORECASE) and rule not in contract_content:
            missing_from_contract.append(f"{method} {rule} ({route['endpoint']})")

    assert (
        len(missing_from_contract) == 0
    ), f"Routes registered in app but missing from docs/api-contract.md:\n" + "\n".join(
        missing_from_contract
    )


def test_api_contract_contains_no_ghost_endpoints():
    """Verify that endpoints mentioned in docs/api-contract.md correspond to actual app routes."""
    contract_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "docs", "api-contract.md")
    )
    with open(contract_path, "r", encoding="utf-8") as f:
        contract_content = f.read()

    all_routes = get_registered_routes()
    registered_rules = {r["rule"] for r in all_routes}
    # Also create pattern-matched versions
    registered_patterns = [
        re.compile(f"^{re.sub(r'<[^>]+>', r'[^/]+', r)}$") for r in registered_rules
    ]
    registered_patterns.append(re.compile(r"^/health$"))
    registered_patterns.append(re.compile(r"^/api/v1/health$"))

    # Extract all endpoint declarations like `POST /api/v1/...`
    endpoint_matches = re.findall(
        r"(?:GET|POST|PUT|PATCH|DELETE)\s+([/api/v1|/health][^\s`\)\"]+)",
        contract_content,
    )

    unmatched_contract_endpoints = []
    for ep in endpoint_matches:
        ep_clean = ep.rstrip("`").rstrip(",").rstrip(")")
        if not any(p.match(ep_clean) for p in registered_patterns):
            unmatched_contract_endpoints.append(ep_clean)

    assert (
        len(unmatched_contract_endpoints) == 0
    ), f"Endpoints in docs/api-contract.md not found in Flask app:\n" + "\n".join(
        unmatched_contract_endpoints
    )
