"""Top-level test runner alias forwarding to backend.tests.e2e.test_demo_journey."""

import os
import sys

# Ensure backend is on PYTHONPATH
repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if repo_root not in sys.path:
    sys.path.insert(0, repo_root)

from backend.tests.e2e.test_demo_journey import *  # noqa: F401, F403
