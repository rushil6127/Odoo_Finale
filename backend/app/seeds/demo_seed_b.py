"""Demo seed data generator for Champions Club (Developer B Scope)."""

import os
from datetime import date, datetime, timedelta
import decimal
from decimal import Decimal

from flask import current_app
from backend.app.extensions import db
from backend.app.auth.services import get_user_by_email
from backend.app.members.services import get_member_by_user_id

from backend.app.inventory.services import create_category, create_product, record_stock_in, record_stock_out
from backend.app.shop.services import create_shop_order, update_order_status
from backend.app.pos.services import (
    create_menu_category, create_menu_item, create_table, start_shift, open_tab,
    add_items_to_tab, send_tab_to_kitchen, pay_tab, close_tab, end_shift,
    get_table
)
from backend.app.crm.services import (
    process_public_enquiry, update_follow_up, request_trial_session,
    create_quote, update_lead, convert_lead_to_member
)
from backend.app.employees.services import (
    create_employee, request_leave, approve_leave, list_employees
)
from backend.app.invoices.services import (
    create_business_client, create_invoice, create_tax_rate, seed_default_tax_rates
)

def seed_commerce_and_crm_demo():
    """Seed Developer B demo data: Commerce (Inventory, Shop, POS), CRM, HR/Invoices."""
    
    # Run only once (idempotent check)
    # I'll check if a known product exists
    from backend.app.inventory.models import Product
    if Product.query.filter_by(sku="SKU-REQ-001").first():
        return
        
    today = date.today()
    now = datetime.now()
    
    # 1. Fetch needed users/members created by Developer A
    shop_user = get_user_by_email("shop@championsclub.example.com")
    bar_user = get_user_by_email("bar@championsclub.example.com")
    front_desk = get_user_by_email("frontdesk@championsclub.example.com")
    admin = get_user_by_email("admin@championsclub.example.com")
    
    gold_user = get_user_by_email("gold.member@championsclub.example.com")
    gold_member = get_member_by_user_id(gold_user.id)
    silver_user = get_user_by_email("silver.member@championsclub.example.com")
    silver_member = get_member_by_user_id(silver_user.id)

    # ==========================
    # 1. Inventory & Products
    # ==========================
    cat_eq = create_category("Equipment", "Tennis racquets, balls, and gear")
    cat_ap = create_category("Apparel", "Club branded clothing")
    cat_fd = create_category("Food & Beverage", "Snacks and drinks")
    
    prod_racquet = create_product("SKU-REQ-001", "Pro Staff Racquet", cat_eq.id, 15000.0, 10000.0, 10)
    prod_balls = create_product("SKU-REQ-002", "Tennis Balls (Can)", cat_eq.id, 500.0, 300.0, 50, low_stock_threshold=20)
    prod_shirt = create_product("SKU-APP-001", "Club Polo Shirt", cat_ap.id, 2500.0, 1000.0, 5, low_stock_threshold=10) # low stock!
    prod_grip = create_product("SKU-REQ-003", "Overgrip 3-pack", cat_eq.id, 800.0, 400.0, 2, low_stock_threshold=5) # low stock!

    # Add initial stock
    record_stock_in(prod_racquet.id, 10, "INITIAL_STOCK", admin.id)
    record_stock_in(prod_balls.id, 50, "INITIAL_STOCK", admin.id)
    record_stock_in(prod_shirt.id, 5, "INITIAL_STOCK", admin.id)
    record_stock_in(prod_grip.id, 2, "INITIAL_STOCK", admin.id)
    
    # ==========================
    # 2. Shop Orders
    # ==========================
    # Counter order (deducts stock immediately, payment collected)
    order_1 = create_shop_order(
        order_type="COUNTER",
        fulfillment_type="PICKUP",
        items_data=[{"product_id": prod_balls.id, "quantity": 2}],
        member_id=gold_member.id,
        payment_method="UPI",
        requesting_user=shop_user
    )
    
    # Online delivery order
    order_2 = create_shop_order(
        order_type="ONLINE",
        fulfillment_type="DELIVERY",
        items_data=[{"product_id": prod_shirt.id, "quantity": 1}],
        member_id=silver_member.id,
        delivery_address="402 Lavelle Road, Bengaluru",
        payment_method="ONLINE",
        requesting_user=silver_user
    )
    update_order_status(order_2.id, "COMPLETED", "Delivered", shop_user)

    # ==========================
    # 3. POS System
    # ==========================
    menu_cat_drinks = create_menu_category("Beverages", "beverages", 1)
    menu_cat_food = create_menu_category("Snacks", "snacks", 2)
    
    item_coffee = create_menu_item(menu_cat_drinks.id, "COF-01", "Espresso", 150.0)
    item_beer = create_menu_item(menu_cat_drinks.id, "BEER-01", "Craft Beer Pint", 350.0)
    item_sandwich = create_menu_item(menu_cat_food.id, "SND-01", "Club Sandwich", 250.0)
    
    table_1 = create_table("T1", "Terrace 1")
    table_2 = create_table("T2", "Lounge 1")
    
    # Start a shift
    shift = start_shift(bar_user.id, starting_cash=1000.0)
    
    # Closed Tab
    tab_1 = open_tab(table_1.id, bar_user, member_id=gold_member.id, shift_id=shift.id)
    add_items_to_tab(tab_1.id, [{"menu_item_id": item_coffee.id, "quantity": 2}], bar_user)
    send_tab_to_kitchen(tab_1.id, bar_user)
    pay_tab(tab_1.id, "CARD", staff_user=bar_user)
    close_tab(tab_1.id, bar_user)
    
    # Open Tab
    tab_2 = open_tab(table_2.id, bar_user, customer_name="Walk-in Guest", shift_id=shift.id)
    add_items_to_tab(tab_2.id, [{"menu_item_id": item_beer.id, "quantity": 1}, {"menu_item_id": item_sandwich.id, "quantity": 1}], bar_user)
    
    end_shift(shift.id, ending_cash=1500.0)

    # ==========================
    # 4. CRM Enquiries
    # ==========================
    # Lead 1: New / Assigned
    lead_1, fw_1 = process_public_enquiry({
        "first_name": "John",
        "last_name": "Doe",
        "email": "john.doe@example.com",
        "phone": "+91 99999 11111",
        "source": "WEBSITE",
        "notes": "Interested in tennis."
    })
    update_follow_up(fw_1.id, "COMPLETED", "CALLED", "Wants to visit")
    
    # Lead 2: Lost
    lead_2, fw_2 = process_public_enquiry({
        "first_name": "Jane",
        "last_name": "Smith",
        "email": "jane.smith@example.com",
        "phone": "+91 99999 22222",
        "source": "WALK_IN"
    })
    update_lead(lead_2.id, {"status": "LOST"}, admin)
    
    # Lead 3: Converted
    lead_3, fw_3 = process_public_enquiry({
        "first_name": "New",
        "last_name": "Member",
        "email": "new.member.convert@example.com",
        "phone": "+91 99999 33333",
        "source": "WALK_IN"
    })
    convert_lead_to_member(lead_3.id, plan_code="SILVER", requesting_user=admin)

    # ==========================
    # 5. Employees & Invoices
    # ==========================
    if not list_employees():
        emp_1 = create_employee("Alice", "HR", "alice.hr@championsclub.example.com", "HR", "Manager")
        leave_1 = request_leave(emp_1.id, "ANNUAL", today + timedelta(days=5), today + timedelta(days=7), "Vacation")
        approve_leave(leave_1.id, admin, "Approved")

    tax_rates = seed_default_tax_rates()
    default_tax = tax_rates[0]
    
    client_1 = create_business_client("TechCorp", "Bob IT", "bob@techcorp.com")
    invoice_1 = create_invoice(
        client_id=client_1.id,
        due_date=today + timedelta(days=30),
        items=[{"description": "Corporate Membership", "quantity": 1, "unit_price": 100000.0}],
        tax_rate_id=default_tax.id
    )

    db.session.commit()
