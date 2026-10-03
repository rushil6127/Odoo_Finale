"""Request Correlation ID Middleware for Champions Club backend."""
import re
import uuid
from typing import Optional
from flask import Flask, Request, Response, g, request, has_request_context

REQUEST_ID_HEADER = "X-Request-ID"
# Allow standard alphanumeric, dashes, underscores, periods up to 128 characters
SAFE_REQUEST_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_\-\.]{1,128}$")


def get_request_id() -> str:
    """Retrieve the current request's correlation ID from the Flask request context.

    If not in a request context or no ID is set, returns an empty string.
    """
    if has_request_context():
        req_id = getattr(g, "request_id", None)
        if req_id:
            return req_id
    return ""


def _extract_or_generate_request_id(req: Request) -> str:
    """Extract incoming X-Request-ID header if valid, or generate a new UUIDv4."""
    header_val = req.headers.get(REQUEST_ID_HEADER)
    if header_val:
        cleaned = header_val.strip()
        if SAFE_REQUEST_ID_PATTERN.match(cleaned):
            return cleaned
    return str(uuid.uuid4())


def register_request_id_middleware(app: Flask) -> None:
    """Register request ID before_request and after_request hooks on the Flask application."""

    @app.before_request
    def set_request_id():
        g.request_id = _extract_or_generate_request_id(request)

    @app.after_request
    def inject_request_id_header(response: Response) -> Response:
        req_id = getattr(g, "request_id", None)
        if req_id:
            response.headers[REQUEST_ID_HEADER] = req_id
        return response
