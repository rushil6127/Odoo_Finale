from flask import jsonify
from typing import Any, Optional, Dict


def success_response(
    data: Any = None,
    message: Optional[str] = None,
    status_code: int = 200,
    meta: Optional[Dict[str, Any]] = None,
):
    """Generate a standard success JSON response.

    Envelope:
    {
        "success": true,
        "data": {},
        "message": "optional",
        "meta": {}
    }
    """
    payload = {
        "success": True,
        "data": data if data is not None else {},
    }
    if message is not None:
        payload["message"] = message
    if meta is not None:
        payload["meta"] = meta

    return jsonify(payload), status_code


def error_response(
    code: str,
    message: str,
    status_code: int = 400,
    details: Optional[Any] = None,
):
    """Generate a standard error JSON response.

    Envelope:
    {
        "success": false,
        "error": {
            "code": "ERROR_CODE",
            "message": "Human readable message",
            "details": {}
        }
    }
    """
    error_obj = {
        "code": code,
        "message": message,
    }
    if details is not None:
        error_obj["details"] = details

    payload = {
        "success": False,
        "error": error_obj,
    }
    return jsonify(payload), status_code
