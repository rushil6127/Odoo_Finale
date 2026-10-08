from backend.app.inventory.models import Product
from backend.app import db
from backend.app.payments.providers import set_payment_provider, FakePaymentProvider

def test_shop_checkout_payment_options(client, shop_staff_headers, member_headers, member_user, app):
    with app.app_context():
        set_payment_provider(FakePaymentProvider())
        # Setup product directly
        from decimal import Decimal
        product = Product(
            name="Test Racket",
            sku="TEST-RACKET",
            price=Decimal("100.00"),
            stock_quantity=10,
            is_active=True,
            category_id=1
        )
        db.session.add(product)
        db.session.commit()
        product_id = product.id
    
    # Online Delivery + Cash (COD)
    res = client.post(
        "/api/v1/shop/orders",
        json={
            "order_type": "ONLINE",
            "fulfillment_type": "DELIVERY",
            "delivery_address": "123 Main St",
            "payment_method": "CASH",
            "items": [{"product_id": product_id, "quantity": 1}]
        },
        headers=member_headers,
    )
    assert res.status_code == 201
    
    # Online Delivery + Online
    res = client.post(
        "/api/v1/shop/orders",
        json={
            "order_type": "ONLINE",
            "fulfillment_type": "DELIVERY",
            "delivery_address": "123 Main St",
            "payment_method": "ONLINE",
            "items": [{"product_id": product_id, "quantity": 1}]
        },
        headers=member_headers,
    )
    assert res.status_code == 201, res.json
