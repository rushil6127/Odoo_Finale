import sys
import os
import json
from datetime import date, datetime

class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (date, datetime)):
            return obj.isoformat()
        from decimal import Decimal
        if isinstance(obj, Decimal):
            return str(obj)
        return super().default(obj)

repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, repo_root)

from backend.app import create_app
from backend.app.extensions import db
from backend.app.seeds.demo_seed import seed_core_demo
from backend.app.seeds.demo_seed_b import seed_commerce_and_crm_demo
from backend.app.reports.services import get_dashboard_overview

app = create_app("development")
with app.app_context():
    print("Dropping tables...")
    db.drop_all()
    print("Creating tables...")
    db.create_all()
    print("Running core demo seed...")
    seed_core_demo()
    print("Running commerce demo seed...")
    seed_commerce_and_crm_demo()
    
    print("Generating dashboard...")
    dashboard = get_dashboard_overview()
    
    output_path = os.path.join(repo_root, "dashboard_output.json")
    with open(output_path, "w") as f:
        json.dump(dashboard, f, indent=2, cls=CustomJSONEncoder)
    print("Done. Output saved to dashboard_output.json.")
