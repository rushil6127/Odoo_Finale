import json
from datetime import date, datetime
from decimal import Decimal

class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (date, datetime)):
            return obj.isoformat()
        if isinstance(obj, Decimal):
            return str(obj)
        return super().default(obj)

def test_dashboard_overview_data(app, monkeypatch):
    import celery.app.task
    monkeypatch.setattr(celery.app.task.Task, "delay", lambda *args, **kwargs: None)
    
    from backend.app.seeds.demo_seed import seed_core_demo
    from backend.app.seeds.demo_seed_b import seed_commerce_and_crm_demo
    from backend.app.reports.services import get_dashboard_overview
    
    print("\n--- RUNNING SEED ---")
    seed_core_demo()
    seed_commerce_and_crm_demo()
    print("--- SEED COMPLETE ---")
    
    dashboard = get_dashboard_overview()
    print("\n--- DASHBOARD DATA ---")
    print(json.dumps(dashboard, indent=2, cls=CustomJSONEncoder))
    print("--- END DASHBOARD DATA ---")
