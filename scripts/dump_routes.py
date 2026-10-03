#!/usr/bin/env python3
"""Script to dump all registered Flask routes and verify API contract coverage.

Usage:
    python scripts/dump_routes.py [--format json|markdown]
"""

import sys
import os
import argparse
import json

# Ensure repository root is in python path
repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if repo_root not in sys.path:
    sys.path.insert(0, repo_root)

from backend.app import create_app


def get_registered_routes():
    """Extract all registered application routes."""
    app = create_app("testing")
    routes = []

    for rule in sorted(app.url_map.iter_rules(), key=lambda r: (r.rule, r.endpoint)):
        if rule.endpoint == "static":
            continue
        methods = sorted(list(rule.methods - {"OPTIONS", "HEAD"}))
        for method in methods:
            blueprint = rule.endpoint.split(".")[0] if "." in rule.endpoint else "common"
            routes.append({
                "endpoint": rule.endpoint,
                "method": method,
                "rule": rule.rule,
                "blueprint": blueprint,
            })

    return routes


def get_developer_a_routes():
    """Return routes owned by Developer A (common, auth, members, memberships, courts, bookings, payments)."""
    dev_a_blueprints = {
        "health",
        "auth",
        "members",
        "membership_plans",
        "memberships",
        "courts",
        "bookings",
        "payments",
    }
    all_routes = get_registered_routes()
    return [r for r in all_routes if r["blueprint"] in dev_a_blueprints]


def main():
    parser = argparse.ArgumentParser(description="Dump registered Flask API routes.")
    parser.add_argument(
        "--format",
        choices=["text", "json", "markdown"],
        default="markdown",
        help="Output format",
    )
    parser.add_argument(
        "--dev-a-only",
        action="store_true",
        help="Only output routes owned by Developer A",
    )
    args = parser.parse_args()

    routes = get_developer_a_routes() if args.dev_a_only else get_registered_routes()

    if args.format == "json":
        print(json.dumps(routes, indent=2))
    elif args.format == "markdown":
        print("| Method | Endpoint / Rule | Blueprint | Handler |")
        print("| :--- | :--- | :--- | :--- |")
        for r in routes:
            print(f"| `{r['method']}` | `{r['rule']}` | `{r['blueprint']}` | `{r['endpoint']}` |")
    else:
        for r in routes:
            print(f"[{r['method']:6}] {r['rule']:45} ({r['endpoint']})")


if __name__ == "__main__":
    main()
