from datetime import datetime, timezone


def utc_now() -> datetime:
    """Return the current datetime in UTC timezone."""
    return datetime.now(timezone.utc)
