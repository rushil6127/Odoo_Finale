import os
from celery import Celery, Task

default_broker = os.getenv("CELERY_BROKER_URL", os.getenv("REDIS_URL", "redis://localhost:6379/0"))
default_backend = os.getenv("CELERY_RESULT_BACKEND", os.getenv("REDIS_URL", "redis://localhost:6379/0"))

# Top-level Celery instance available to workers and modules
celery_app = Celery(
    "champions_club",
    broker=default_broker,
    backend=default_backend,
    include=["backend.app.tasks.jobs"],
)


def make_celery(app=None) -> Celery:
    """
    Configure and bind Celery instance to the Flask application context.
    """
    if app is None:
        from backend.app import create_app

        env_name = os.getenv("FLASK_ENV", "development").lower()
        app = create_app(env_name)

    broker_url = (
        app.config.get("CELERY_BROKER_URL")
        or app.config.get("REDIS_URL")
        or default_broker
    )
    result_backend = (
        app.config.get("CELERY_RESULT_BACKEND")
        or app.config.get("REDIS_URL")
        or default_backend
    )

    beat_schedule = {
        "membership-expiry-reminders-daily": {
            "task": "backend.app.tasks.jobs.send_membership_expiry_reminders_task",
            "schedule": float(app.config.get("BEAT_EXPIRY_SCHEDULE_SECONDS", 86400)),
        },
        "crm-follow-up-reminders-daily": {
            "task": "backend.app.tasks.jobs.send_crm_follow_up_reminders_task",
            "schedule": float(app.config.get("BEAT_CRM_SCHEDULE_SECONDS", 86400)),
        },
        "low-stock-alerts-periodic": {
            "task": "backend.app.tasks.jobs.check_and_alert_low_stock_task",
            "schedule": float(app.config.get("BEAT_LOW_STOCK_SCHEDULE_SECONDS", 3600)),
        },
    }

    celery_app.conf.update(
        broker_url=broker_url,
        result_backend=result_backend,
        task_serializer="json",
        accept_content=["json"],
        result_serializer="json",
        timezone="UTC",
        enable_utc=True,
        task_track_started=True,
        task_always_eager=app.config.get("CELERY_TASK_ALWAYS_EAGER", False),
        task_eager_propagates=app.config.get("CELERY_TASK_EAGER_PROPAGATES", False),
        beat_schedule=beat_schedule,
    )

    class ContextTask(Task):
        """Task executing inside Flask application context."""

        def __call__(self, *args, **kwargs):
            with app.app_context():
                return self.run(*args, **kwargs)

    celery_app.Task = ContextTask
    app.extensions["celery"] = celery_app
    return celery_app
