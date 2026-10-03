import sys
import os
import re

# Ensure repository root is in python path
repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if repo_root not in sys.path:
    sys.path.insert(0, repo_root)

from scripts.dump_routes import get_registered_routes

def generate():
    contract_path = os.path.join(repo_root, "docs", "api-contract.md")
    with open(contract_path, "r", encoding="utf-8") as f:
        contract_content = f.read()

    all_routes = get_registered_routes()
    missing_routes = []
    
    for route in all_routes:
        method = route["method"]
        rule = route["rule"]
        escaped_rule = re.escape(rule)
        escaped_rule_generic = re.sub(r"\\[<][a-z_:]+\\[>]", r"[^ \\n`]+", escaped_rule)
        pattern = rf"{method}[ \\t`|/]+{escaped_rule_generic}"
        if not re.search(pattern, contract_content, re.IGNORECASE) and rule not in contract_content:
            missing_routes.append(route)

    if not missing_routes:
        print("No missing routes.")
        return

    # Group by blueprint
    groups = {}
    for r in missing_routes:
        groups.setdefault(r["blueprint"], []).append(r)
    
    with open(contract_path, "a", encoding="utf-8") as f:
        for bp, routes in sorted(groups.items()):
            f.write(f"\n---\n\n## {bp.title()} Endpoints (`/api/v1/{bp}`)\n\n")
            for r in routes:
                f.write(f"### {r['endpoint'].split('.')[-1].replace('_', ' ').title()}\n")
                f.write(f"- **Endpoint:** `{r['method']} {r['rule']}`\n")
                f.write(f"- **Authentication:** Required\n")
                f.write(f"- **Role Requirement:** (TODO: Fill role)\n")
                if r["method"] in ["POST", "PUT", "PATCH"]:
                    f.write(f"- **Request Body:**\n```json\n{{\n}}\n```\n")
                if r["method"] == "GET":
                    f.write(f"- **Query Parameters:** (TODO: Fill params)\n")
                f.write(f"- **Success Response:**\n```json\n{{\n  \"success\": true,\n  \"data\": {{}}\n}}\n```\n")
                f.write(f"- **Business Rules:** (TODO: Add rules)\n\n")

    print(f"Added {len(missing_routes)} missing routes to api-contract.md")

if __name__ == "__main__":
    generate()
