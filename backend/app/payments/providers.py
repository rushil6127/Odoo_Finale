import hmac
import hashlib
import uuid
from abc import ABC, abstractmethod
from decimal import Decimal
from typing import Dict, Any, Optional
from flask import current_app
from backend.app.common.errors import ValidationException, AppException


class PaymentProviderInterface(ABC):
    """Abstract interface isolating payment gateway operations from business logic."""

    @abstractmethod
    def create_order(
        self, amount_paise: int, currency: str, receipt: str, notes: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Create a gateway order for an online payment."""
        pass

    @abstractmethod
    def verify_payment_signature(self, order_id: str, payment_id: str, signature: str) -> bool:
        """Verify the authenticity of a checkout payment signature using constant-time comparison."""
        pass

    @abstractmethod
    def verify_webhook_signature(self, raw_body: bytes, signature_header: str) -> bool:
        """Verify gateway webhook authenticity computed over the raw request payload."""
        pass

    @abstractmethod
    def create_refund(
        self, gateway_payment_id: str, amount_paise: int, notes: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Create a refund through the gateway provider."""
        pass

    @abstractmethod
    def fetch_payment(self, gateway_payment_id: str) -> Dict[str, Any]:
        """Fetch payment details from gateway to verify amount and currency."""
        pass


class RazorpayProvider(PaymentProviderInterface):
    """Official Razorpay gateway provider implementation."""

    def __init__(
        self,
        key_id: Optional[str] = None,
        key_secret: Optional[str] = None,
        webhook_secret: Optional[str] = None,
    ):
        config = current_app.config if current_app else {}
        self.key_id = key_id or config.get("RAZORPAY_KEY_ID")
        self.key_secret = key_secret or config.get("RAZORPAY_KEY_SECRET")
        self.webhook_secret = webhook_secret or config.get("RAZORPAY_WEBHOOK_SECRET")

    def _ensure_configured(self) -> None:
        if not self.key_id or not self.key_secret:
            raise ValidationException(
                "Razorpay payment gateway is not configured. Missing credentials.",
                code="GATEWAY_NOT_CONFIGURED",
            )

    def _get_client(self):
        self._ensure_configured()
        import razorpay
        return razorpay.Client(auth=(self.key_id, self.key_secret))

    def create_order(
        self, amount_paise: int, currency: str, receipt: str, notes: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        client = self._get_client()
        order_data = {
            "amount": int(amount_paise),
            "currency": currency.upper(),
            "receipt": receipt,
            "notes": notes or {},
            "payment_capture": 1,
        }
        try:
            return client.order.create(data=order_data)
        except Exception as exc:
            raise ValidationException(
                f"Failed to create Razorpay order: {str(exc)}",
                code="GATEWAY_ORDER_CREATION_FAILED",
            )

    def verify_payment_signature(self, order_id: str, payment_id: str, signature: str) -> bool:
        self._ensure_configured()
        if not order_id or not payment_id or not signature:
            return False
        
        msg = f"{order_id}|{payment_id}".encode("utf-8")
        generated = hmac.new(
            self.key_secret.encode("utf-8"), msg, hashlib.sha256
        ).hexdigest()

        return hmac.compare_digest(generated, signature)

    def verify_webhook_signature(self, raw_body: bytes, signature_header: str) -> bool:
        if not self.webhook_secret:
            raise ValidationException(
                "Razorpay webhook secret is not configured.",
                code="GATEWAY_NOT_CONFIGURED",
            )
        if not raw_body or not signature_header:
            return False

        generated = hmac.new(
            self.webhook_secret.encode("utf-8"), raw_body, hashlib.sha256
        ).hexdigest()

        return hmac.compare_digest(generated, signature_header)

    def create_refund(
        self, gateway_payment_id: str, amount_paise: int, notes: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        client = self._get_client()
        refund_data = {
            "amount": int(amount_paise),
            "notes": notes or {},
        }
        try:
            return client.payment.refund(gateway_payment_id, refund_data)
        except Exception as exc:
            raise ValidationException(
                f"Failed to process Razorpay refund: {str(exc)}",
                code="GATEWAY_REFUND_FAILED",
            )

    def fetch_payment(self, gateway_payment_id: str) -> Dict[str, Any]:
        client = self._get_client()
        try:
            return client.payment.fetch(gateway_payment_id)
        except Exception as exc:
            raise ValidationException(
                f"Failed to fetch payment details: {str(exc)}",
                code="GATEWAY_FETCH_FAILED",
            )


class FakePaymentProvider(PaymentProviderInterface):
    """In-memory test provider implementing the exact provider interface without external calls."""

    def __init__(self, key_id: str = "rzp_test_fake_key", key_secret: str = "fake_secret_123", webhook_secret: str = "fake_webhook_secret_123"):
        self.key_id = key_id
        self.key_secret = key_secret
        self.webhook_secret = webhook_secret
        self.orders: Dict[str, Dict[str, Any]] = {}
        self.payments: Dict[str, Dict[str, Any]] = {}
        self.refunds: Dict[str, Dict[str, Any]] = {}

    def create_order(
        self, amount_paise: int, currency: str, receipt: str, notes: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        order_id = f"order_fake_{uuid.uuid4().hex[:12]}"
        order = {
            "id": order_id,
            "entity": "order",
            "amount": int(amount_paise),
            "amount_paid": 0,
            "amount_due": int(amount_paise),
            "currency": currency.upper(),
            "receipt": receipt,
            "status": "created",
            "notes": notes or {},
        }
        self.orders[order_id] = order
        return order

    def generate_signature(self, order_id: str, payment_id: str) -> str:
        """Utility for test suites to generate a valid checkout signature."""
        msg = f"{order_id}|{payment_id}".encode("utf-8")
        return hmac.new(self.key_secret.encode("utf-8"), msg, hashlib.sha256).hexdigest()

    def generate_webhook_signature(self, raw_body: bytes) -> str:
        """Utility for test suites to generate a valid webhook signature."""
        return hmac.new(self.webhook_secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()

    def verify_payment_signature(self, order_id: str, payment_id: str, signature: str) -> bool:
        if not order_id or not payment_id or not signature:
            return False
        expected = self.generate_signature(order_id, payment_id)
        return hmac.compare_digest(expected, signature)

    def verify_webhook_signature(self, raw_body: bytes, signature_header: str) -> bool:
        if not raw_body or not signature_header:
            return False
        expected = self.generate_webhook_signature(raw_body)
        return hmac.compare_digest(expected, signature_header)

    def create_refund(
        self, gateway_payment_id: str, amount_paise: int, notes: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        refund_id = f"rfnd_fake_{uuid.uuid4().hex[:12]}"
        refund = {
            "id": refund_id,
            "entity": "refund",
            "payment_id": gateway_payment_id,
            "amount": int(amount_paise),
            "currency": "INR",
            "status": "processed",
            "notes": notes or {},
        }
        self.refunds[refund_id] = refund
        return refund

    def fetch_payment(self, gateway_payment_id: str) -> Dict[str, Any]:
        if gateway_payment_id in self.payments:
            return self.payments[gateway_payment_id]
        # Return sensible default match
        return {
            "id": gateway_payment_id,
            "entity": "payment",
            "amount": 80000,
            "currency": "INR",
            "status": "captured",
        }


# Global active provider reference for dependency injection in testing
_custom_provider: Optional[PaymentProviderInterface] = None


def set_payment_provider(provider: Optional[PaymentProviderInterface]) -> None:
    """Set custom payment provider (e.g. for testing)."""
    global _custom_provider
    _custom_provider = provider


def get_payment_provider() -> PaymentProviderInterface:
    """Retrieve active payment provider (injected or default RazorpayProvider)."""
    global _custom_provider
    if _custom_provider is not None:
        return _custom_provider
    return RazorpayProvider()
