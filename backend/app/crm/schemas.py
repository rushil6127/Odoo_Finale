from marshmallow import Schema, fields, validate, validates_schema, ValidationError
from backend.app.crm.models import LeadSource, LeadStatus, LeadPriority, FollowUpType, FollowUpStatus, QuoteStatus, TrialStatus


class PublicEnquirySchema(Schema):
    """Strict public enquiry form validation with honeypot field and length constraints."""
    name = fields.String(required=True, validate=validate.Length(min=1, max=100))
    email = fields.Email(load_default=None, validate=validate.Length(max=120))
    phone = fields.String(load_default=None, validate=validate.Length(max=20))
    message = fields.String(load_default=None, validate=validate.Length(max=1000))
    preferred_sport = fields.String(load_default=None, validate=validate.Length(max=50))
    interested_plan = fields.String(load_default=None, validate=validate.Length(max=50))
    trial_requested = fields.Boolean(load_default=False)
    preferred_trial_date = fields.Date(load_default=None)
    preferred_trial_time = fields.String(load_default=None, validate=validate.Length(max=50))
    honeypot = fields.String(load_default=None)  # Anti-spam field

    @validates_schema
    def validate_contact_and_honeypot(self, data, **kwargs):
        # 1. Honeypot check
        if data.get("honeypot") and str(data["honeypot"]).strip():
            raise ValidationError("Spam bot submission detected.", field_name="honeypot")

        # 2. At least email or phone must be present
        email = data.get("email")
        phone = data.get("phone")
        if not email and not phone:
            raise ValidationError("Either email or phone number must be provided.", field_name="contact")


class CreateLeadSchema(Schema):
    first_name = fields.String(required=True, validate=validate.Length(min=1, max=100))
    last_name = fields.String(load_default=None, validate=validate.Length(max=100))
    email = fields.Email(load_default=None, validate=validate.Length(max=120))
    phone = fields.String(load_default=None, validate=validate.Length(max=20))
    source = fields.String(load_default="WEBSITE", validate=validate.OneOf([s.value for s in LeadSource]))
    priority = fields.String(load_default="MEDIUM", validate=validate.OneOf([p.value for p in LeadPriority]))
    preferred_sport = fields.String(load_default=None, validate=validate.Length(max=50))
    interested_plan = fields.String(load_default=None, validate=validate.Length(max=50))
    initial_message = fields.String(load_default=None, validate=validate.Length(max=2000))
    assigned_staff_id = fields.Integer(load_default=None)


class UpdateLeadSchema(Schema):
    first_name = fields.String(validate=validate.Length(min=1, max=100))
    last_name = fields.String(allow_none=True, validate=validate.Length(max=100))
    email = fields.Email(allow_none=True, validate=validate.Length(max=120))
    phone = fields.String(allow_none=True, validate=validate.Length(max=20))
    source = fields.String(validate=validate.OneOf([s.value for s in LeadSource]))
    status = fields.String(validate=validate.OneOf([s.value for s in LeadStatus]))
    priority = fields.String(validate=validate.OneOf([p.value for p in LeadPriority]))
    preferred_sport = fields.String(allow_none=True, validate=validate.Length(max=50))
    interested_plan = fields.String(allow_none=True, validate=validate.Length(max=50))
    assigned_staff_id = fields.Integer(allow_none=True)


class CreateFollowUpSchema(Schema):
    follow_up_type = fields.String(load_default="CALL", validate=validate.OneOf([t.value for t in FollowUpType]))
    scheduled_date = fields.DateTime(required=True)
    notes = fields.String(load_default=None, validate=validate.Length(max=1000))
    assigned_staff_id = fields.Integer(load_default=None)


class UpdateFollowUpSchema(Schema):
    status = fields.String(validate=validate.OneOf([s.value for s in FollowUpStatus]))
    outcome = fields.String(allow_none=True, validate=validate.Length(max=1000))
    notes = fields.String(allow_none=True, validate=validate.Length(max=1000))


class AddNoteSchema(Schema):
    content = fields.String(required=True, validate=validate.Length(min=1, max=2000))


class RequestTrialSchema(Schema):
    preferred_date = fields.Date(required=True)
    preferred_time_slot = fields.String(required=True, validate=validate.Length(min=1, max=50))
    sport = fields.String(load_default="TENNIS", validate=validate.Length(max=50))


class ConfirmTrialSchema(Schema):
    confirmed_datetime = fields.DateTime(required=True)
    court_id = fields.Integer(load_default=None)
    coach_user_id = fields.Integer(load_default=None)
    staff_notes = fields.String(load_default=None, validate=validate.Length(max=1000))


class CreateQuoteSchema(Schema):
    plan_code = fields.String(load_default=None, validate=validate.Length(max=30))
    plan_name = fields.String(required=True, validate=validate.Length(min=1, max=100))
    amount = fields.Decimal(as_string=True, required=True, validate=validate.Range(min=0))
    discount_amount = fields.Decimal(as_string=True, load_default="0.00", validate=validate.Range(min=0))
    valid_until = fields.Date(required=True)
    notes = fields.String(load_default=None, validate=validate.Length(max=1000))


class ConvertLeadSchema(Schema):
    plan_code = fields.String(load_default=None)
    address = fields.String(load_default=None, validate=validate.Length(max=255))
    date_of_birth = fields.Date(load_default=None)
    gender = fields.String(load_default="Unspecified")
    emergency_contact_name = fields.String(load_default=None, validate=validate.Length(max=100))
    emergency_contact_phone = fields.String(load_default=None, validate=validate.Length(max=20))


class MarkLostSchema(Schema):
    reason = fields.String(required=True, validate=validate.Length(min=3, max=500))
