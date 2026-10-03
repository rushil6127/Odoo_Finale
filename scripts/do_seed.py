import sys
import os
repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, repo_root)

from backend.app import create_app
from backend.app.extensions import db
from backend.app.seeds.demo_seed import seed_core_demo
from backend.app.seeds.demo_seed_b import seed_commerce_and_crm_demo

app = create_app("development")
with app.app_context():
    print("Dropping all tables...")
    db.drop_all()
    print("Creating all tables...")
    db.create_all()
    print("Running core demo seed...")
    seed_core_demo()
    print("Running commerce & CRM demo seed...")
    seed_commerce_and_crm_demo()
    print("Seed complete.")
