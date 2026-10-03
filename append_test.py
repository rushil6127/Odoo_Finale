import os

TEST_CODE = """

class TestStage5CommercePOSAndDashboard:
    \"\"\"Validate Developer B's additions: Shop, POS, and Dashboard.\"\"\"

    def test_commerce_pos_dashboard_journey(self, client, seeded_club):
        # 1. Login as required users
        shop_headers, _ = api_login(client, "shop@championsclub.example.com")
        bar_headers, _ = api_login(client, "bar@championsclub.example.com")
        owner_headers, _ = api_login(client, "owner@championsclub.example.com")
        gold_headers, gold_user = api_login(client, "gold.member@championsclub.example.com")

        # 2. Get Products
        resp_prods = client.get("/api/v1/inventory/products", headers=shop_headers)
        assert resp_prods.status_code == 200
        products = resp_prods.get_json()["data"]["products"]
        # Find balls and shirt
        balls = next(p for p in products if p["sku"] == "SKU-REQ-002")
        shirt = next(p for p in products if p["sku"] == "SKU-APP-001")
        
        initial_balls_stock = balls["current_stock"]

        # 3. Shop Purchase (Counter)
        resp_shop = client.post("/api/v1/shop/orders", headers=shop_headers, json={
            "order_type": "COUNTER",
            "fulfillment_type": "PICKUP",
            "items": [{"product_id": balls["id"], "quantity": 1}],
            "payment_method": "CASH"
        })
        assert resp_shop.status_code == 200, resp_shop.get_json()
        shop_order = resp_shop.get_json()["data"]["order"]

        # Verify Inventory changes
        resp_prods_after = client.get(f"/api/v1/inventory/products/{balls['id']}", headers=shop_headers)
        assert resp_prods_after.get_json()["data"]["current_stock"] == initial_balls_stock - 1

        # Failure Path: Out-of-stock purchase
        resp_fail = client.post("/api/v1/shop/orders", headers=shop_headers, json={
            "order_type": "COUNTER",
            "fulfillment_type": "PICKUP",
            "items": [{"product_id": balls["id"], "quantity": 1000}], # too many
            "payment_method": "CASH"
        })
        assert resp_fail.status_code in (400, 422), "Should fail for out of stock"

        # 4. Shop Purchase (Online) as Member
        resp_online = client.post("/api/v1/shop/orders", headers=gold_headers, json={
            "order_type": "ONLINE",
            "fulfillment_type": "DELIVERY",
            "items": [{"product_id": shirt["id"], "quantity": 1}],
            "delivery_address": "Test Address",
            "payment_method": "ONLINE"
        })
        assert resp_online.status_code == 200

        # 5. Bar/POS tab with member discount
        resp_tables = client.get("/api/v1/pos/tables", headers=bar_headers)
        tables = resp_tables.get_json()["data"]
        table = next(t for t in tables if t["table_number"] == "T1")

        # Start shift
        resp_shift = client.post("/api/v1/pos/shifts", headers=bar_headers, json={})
        # Wait, if shift is already started by seed, it might fail or return existing
        if resp_shift.status_code != 201:
            shift_id = client.get("/api/v1/pos/shifts?status=ACTIVE", headers=bar_headers).get_json()["data"][0]["id"]
        else:
            shift_id = resp_shift.get_json()["data"]["id"]

        resp_tab = client.post("/api/v1/pos/tabs", headers=bar_headers, json={
            "table_id": table["id"],
            "shift_id": shift_id,
            "member_id": gold_user["member_id"]
        })
        assert resp_tab.status_code == 201
        tab_id = resp_tab.get_json()["data"]["id"]

        resp_menu = client.get("/api/v1/pos/menu/items", headers=bar_headers)
        menu_items = resp_menu.get_json()["data"]["items"]
        coffee = next(i for i in menu_items if i["sku"] == "COF-01")

        # Add item
        resp_add = client.post(f"/api/v1/pos/tabs/{tab_id}/items", headers=bar_headers, json={
            "items": [{"menu_item_id": coffee["id"], "quantity": 2, "notes": ""}]
        })
        assert resp_add.status_code == 200

        # Failure Path: Closing an unpaid tab
        resp_close_fail = client.post(f"/api/v1/pos/tabs/{tab_id}/close", headers=bar_headers)
        assert resp_close_fail.status_code in (400, 422), "Cannot close unpaid tab"

        # Payment
        resp_pay = client.post(f"/api/v1/pos/tabs/{tab_id}/pay", headers=bar_headers, json={
            "payment_method": "CARD"
        })
        assert resp_pay.status_code == 200
        
        # Close
        resp_close = client.post(f"/api/v1/pos/tabs/{tab_id}/close", headers=bar_headers)
        assert resp_close.status_code == 200

        # Verify Payment records for Shop and POS
        resp_payments = client.get("/api/v1/payments", headers=owner_headers)
        payments = resp_payments.get_json()["data"]
        # shop_order has payment
        shop_payment = next(p for p in payments if p["reference_id"] == shop_order["id"] and p["reference_type"] == "SHOP_ORDER")
        assert shop_payment["status"] == "PAID"
        assert shop_payment["payment_method"] == "CASH"

        # POS tab payment
        pos_payment = next(p for p in payments if p["reference_id"] == tab_id and p["reference_type"] == "POS_TAB")
        assert pos_payment["status"] == "PAID"
        assert pos_payment["payment_method"] == "CARD"

        # 6. Revenue Aggregation Dashboard
        resp_dash = client.get("/api/v1/reports/dashboard", headers=owner_headers)
        assert resp_dash.status_code == 200
        dash = resp_dash.get_json()["data"]
        
        financial = dash["financial_summary"]
        methods = dash["payment_methods"]
        streams = dash["stream_breakdown"]

        # Ensure totals match
        total_paid_streams = sum(s["paid_amount"] for s in streams.values())
        total_refund_streams = sum(s["refunded_amount"] for s in streams.values())
        total_paid_methods = sum(m["paid_amount"] for m in methods.values())
        total_refund_methods = sum(m["refunded_amount"] for m in methods.values())

        # Assert totals are consistent
        assert round(financial["paid_amount"], 2) == round(total_paid_streams, 2)
        assert round(financial["paid_amount"], 2) == round(total_paid_methods, 2)
        assert round(financial["refunded_amount"], 2) == round(total_refund_streams, 2)
        assert round(financial["refunded_amount"], 2) == round(total_refund_methods, 2)

        # Permissions test (Bar staff shouldn't access dashboard)
        resp_dash_bar = client.get("/api/v1/reports/dashboard", headers=bar_headers)
        assert resp_dash_bar.status_code == 403

"""

file_path = "backend/tests/e2e/test_demo_journey.py"
with open(file_path, "a", encoding="utf-8") as f:
    f.write(TEST_CODE)
print("Done appending test.")
