from flask import Blueprint, current_app
from sqlalchemy import text
from backend.app.extensions import db
from backend.app.common.responses import success_response, error_response

health_bp = Blueprint("health", __name__)


@health_bp.route("/health", methods=["GET"])
@health_bp.route("/api/v1/health", methods=["GET"])
def health_check():
    """Health check endpoint to verify API and DB connectivity."""
    db_status = "healthy"
    try:
        db.session.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"
        return error_response(
            code="SERVICE_UNHEALTHY",
            message="Database connectivity check failed",
            status_code=503,
            details={"database": db_status},
        )

    return success_response(
        data={
            "status": "healthy",
            "service": "champions-club-api",
            "environment": current_app.config.get("ENV", "development"),
            "database": db_status,
        },
        message="Champions Club API is operational",
    )
