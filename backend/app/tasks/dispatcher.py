import logging
from sqlalchemy import event
from backend.app.extensions import db

logger = logging.getLogger("celery.dispatcher")


@event.listens_for(db.session, "after_commit")
def _on_session_after_commit(session):
    """
    Hook executed immediately after a database transaction successfully commits.
    Dispatches any queued background tasks.
    """
    pending = session.info.pop("_pending_tasks", [])
    for task_func, args, kwargs in pending:
        try:
            task_func.delay(*args, **kwargs)
        except Exception as e:
            logger.error(
                f"Error dispatching post-commit task {getattr(task_func, 'name', task_func)}: {e}",
                exc_info=True,
            )


@event.listens_for(db.session, "after_rollback")
def _on_session_after_rollback(session):
    """
    Hook executed on transaction rollback. Discards all pending tasks so they are never executed.
    """
    session.info.pop("_pending_tasks", None)


def safe_enqueue_task(task_func, *args, **kwargs):
    """
    Safely enqueue a Celery task post-commit.
    - If a database transaction is active, the task is held in the session and only dispatched
      after db.session.commit() completes successfully.
    - If the transaction rolls back, all tasks are discarded.
    - If no transaction is active (or outside a transaction), the task is dispatched immediately.
    """
    session = db.session()
    if session.is_active and session.in_transaction():
        if "_pending_tasks" not in session.info:
            session.info["_pending_tasks"] = []
        session.info["_pending_tasks"].append((task_func, args, kwargs))
        return None
    else:
        return task_func.delay(*args, **kwargs)
