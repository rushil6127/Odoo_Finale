import inspect
import sys
import os

repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if repo_root not in sys.path:
    sys.path.insert(0, repo_root)

def list_functions(module_path, module_name):
    import importlib.util
    spec = importlib.util.spec_from_file_location(module_name, module_path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    
    print(f"--- {module_name} ---")
    for name, obj in inspect.getmembers(module, inspect.isfunction):
        if obj.__module__ == module_name:
            sig = inspect.signature(obj)
            print(f"def {name}{sig}")
    print()

list_functions("backend/app/inventory/services.py", "inventory.services")
list_functions("backend/app/shop/services.py", "shop.services")
list_functions("backend/app/pos/services.py", "pos.services")
list_functions("backend/app/crm/services.py", "crm.services")
list_functions("backend/app/employees/services.py", "employees.services")
list_functions("backend/app/invoices/services.py", "invoices.services")
