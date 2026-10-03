from functools import wraps
from typing import Type, Union
from flask import request
from marshmallow import Schema, ValidationError
from backend.app.common.errors import ValidationException


def validate_schema(
    schema_cls_or_instance: Union[Type[Schema], Schema],
    location: str = "json",
):
    """Decorator to validate incoming request data using a Marshmallow schema.

    Args:
        schema_cls_or_instance: Marshmallow Schema class or instance.
        location: Where to extract payload from ('json', 'query', or 'form').

    Injects `validated_data` keyword argument into the decorated view function.
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            schema = (
                schema_cls_or_instance()
                if isinstance(schema_cls_or_instance, type)
                else schema_cls_or_instance
            )

            if location == "json":
                data = request.get_json(silent=True)
                if data is None:
                    raise ValidationException(
                        message="Request body must be valid JSON",
                        details={"body": ["Missing or malformed JSON payload"]},
                    )
            elif location == "query":
                data = request.args.to_dict()
            elif location == "form":
                data = request.form.to_dict()
            else:
                data = request.values.to_dict()

            try:
                validated_data = schema.load(data)
            except ValidationError as err:
                raise ValidationException(
                    message="Request validation failed",
                    details=err.messages,
                )

            kwargs["validated_data"] = validated_data
            return fn(*args, **kwargs)

        return wrapper

    return decorator
