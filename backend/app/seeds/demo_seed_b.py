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
    from backend.app.inventory.models import Product, ProductCategory
    if Product.query.filter(Product.sku.in_(["RCK-WIL-PRO97", "SKU-REQ-001"])).first():
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
    def get_or_create_cat(name: str, slug: str, desc: str = ""):
        c = ProductCategory.query.filter((ProductCategory.name == name) | (ProductCategory.slug == slug)).first()
        if not c:
            c = create_category(name, slug=slug, description=desc)
        return c

    cat_rackets = get_or_create_cat("Rackets", "rackets", "Tennis, squash, and padel racquets")
    cat_balls = get_or_create_cat("Balls & Shuttles", "balls", "Tennis balls, padel balls, and shuttlecocks")
    cat_shoes = get_or_create_cat("Footwear", "shoes", "Court shoes and athletic footwear")
    cat_apparel = get_or_create_cat("Club Apparel", "apparel", "Club branded clothing and athletic wear")
    cat_gear = get_or_create_cat("Strings & Gear", "accessories", "Grips, strings, and gear")
    cat_fd = get_or_create_cat("Food & Beverage", "food-and-beverage", "Snacks and drinks")
    
    prod_racket_1 = create_product("RCK-WIL-PRO97", "Wilson Pro Staff 97 v14", cat_rackets.id, 22000.0, 15000.0, 12, low_stock_threshold=3, description="Precision and feel for advanced players. 315g unstrung.", image_url="/images/products/wilson-pro-staff.jpg")
    prod_racket_2 = create_product("RCK-BAB-AER", "Babolat Pure Aero 2023", cat_rackets.id, 21500.0, 14000.0, 8, low_stock_threshold=3, description="Maximum spin and power. Rafael Nadal edition.", image_url="/images/products/babolat-pure-aero.jpg")
    prod_balls = create_product("BAL-WIL-US3", "Wilson US Open Tennis Balls (Can of 3)", cat_balls.id, 650.0, 400.0, 120, low_stock_threshold=25, description="Official ball of the US Open. Premium woven felt.", image_url="/images/products/wilson-us-open-balls.jpg")
    prod_padel = create_product("BAL-HEAD-PRO", "HEAD Padel Pro S (Can of 3)", cat_balls.id, 750.0, 450.0, 50, low_stock_threshold=15, description="Faster ball for dynamic padel rallies.", image_url="/images/products/head-padel-pro.jpg")
    prod_shoes = create_product("SHOE-ASI-RES8", "Asics Gel Resolution 8 (Size 10)", cat_shoes.id, 11999.0, 8000.0, 4, low_stock_threshold=5, description="Advanced stability and cushioning for competitive tennis.", image_url="/images/products/asics-gel-resolution.jpg")
    prod_shirt = create_product("APP-CHAMP-POLO", "Champions Club Dri-Fit Team Polo (M)", cat_apparel.id, 1499.0, 700.0, 25, low_stock_threshold=10, description="Official club crest moisture-wicking polo.", image_url="/images/products/champions-club-polo.jpg")
    prod_grip = create_product("ACC-YON-OVER3", "Yonex Super Grap Overgrip (Pack of 3)", cat_gear.id, 450.0, 200.0, 60, low_stock_threshold=20, description="Tacky feel and excellent shock absorption.", image_url="/images/products/yonex-super-grap.jpg")

    # Add initial stock
    record_stock_in(prod_racket_1.id, 12, "INITIAL_STOCK", admin.id)
    record_stock_in(prod_racket_2.id, 8, "INITIAL_STOCK", admin.id)
    record_stock_in(prod_balls.id, 120, "INITIAL_STOCK", admin.id)
    record_stock_in(prod_padel.id, 50, "INITIAL_STOCK", admin.id)
    record_stock_in(prod_shoes.id, 4, "INITIAL_STOCK", admin.id)
    record_stock_in(prod_shirt.id, 25, "INITIAL_STOCK", admin.id)
    record_stock_in(prod_grip.id, 60, "INITIAL_STOCK", admin.id)
    
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
    update_order_status(order_2.id, "CONFIRMED", "Confirmed order", shop_user)
    update_order_status(order_2.id, "PROCESSING", "Packing", shop_user)
    update_order_status(order_2.id, "SHIPPED", "Dispatched", shop_user)
    update_order_status(order_2.id, "COMPLETED", "Delivered", shop_user)
    # ==========================
    # 3. POS System
    # ==========================
    from backend.app.pos.models import POSMenuCategory, POSMenuItem

    def get_or_create_pos_cat(name: str, slug: str, display_order: int = 1):
        cat = POSMenuCategory.query.filter((POSMenuCategory.slug == slug) | (POSMenuCategory.name == name)).first()
        if not cat:
            cat = create_menu_category(name, slug, display_order)
        return cat

    def get_or_create_pos_item(cat_id: int, code: str, name: str, price: float, desc: str = "", prep_time: int = 10):
        item = POSMenuItem.query.filter((POSMenuItem.code == code) | (POSMenuItem.name == name)).first()
        if not item:
            item = create_menu_item(cat_id, code, name, price, description=desc, preparation_time_minutes=prep_time)
        return item

    menu_cat_drinks = get_or_create_pos_cat("Beverages & Coffee", "beverages", 1)
    menu_cat_snacks = get_or_create_pos_cat("Snacks & Appetizers", "snacks", 2)
    menu_cat_meals = get_or_create_pos_cat("Meals & Gourmet Bowls", "meals", 3)

    item_coffee = get_or_create_pos_item(menu_cat_drinks.id, "B01", "Double Shot Espresso", 150.0, "Single-origin Arabica roast extracted at 9 bars with thick golden crema.", 5)
    get_or_create_pos_item(menu_cat_drinks.id, "B02", "Artisan Cafe Latte / Cappuccino", 180.0, "Silky micro-foam steamed whole or oat milk over rich double-shot espresso.", 7)
    get_or_create_pos_item(menu_cat_drinks.id, "B03", "Cascade Nitro Cold Brew", 210.0, "Steeped for 24 hours and infused with pure nitrogen for a velvety, stout-like texture.", 3)
    get_or_create_pos_item(menu_cat_drinks.id, "B04", "Whey Protein Berry Blast Smoothie", 320.0, "30g grass-fed whey isolate, organic blueberries, banana, chia seeds, and almond milk.", 6)

    get_or_create_pos_item(menu_cat_snacks.id, "S01", "Truffle Parmesan Crisp Fries", 220.0, "Hand-cut Idaho potatoes tossed with white truffle oil, rosemary, and aged Parmigiano.", 10)
    get_or_create_pos_item(menu_cat_snacks.id, "S02", "Loaded Guacamole Nachos", 280.0, "Stone-ground organic corn chips, fresh pico de gallo, smashed Haas avocado, and warm queso.", 10)
    get_or_create_pos_item(menu_cat_snacks.id, "S03", "Crispy Golden Onion Rings", 190.0, "Panko & craft-beer battered Vidalia onion rings with smoked chipotle dipping sauce.", 8)

    item_sandwich = get_or_create_pos_item(menu_cat_meals.id, "M01", "Champions Club Artisan Sandwich", 290.0, "Roasted herb turkey breast, Haas avocado, arugula, aged white cheddar on toasted sourdough.", 12)
    get_or_create_pos_item(menu_cat_meals.id, "M02", "Grilled Chicken & Avocado Burger", 350.0, "Free-range marinated chicken breast, smashed avocado, heirloom tomato on a toasted brioche bun.", 15)
    get_or_create_pos_item(menu_cat_meals.id, "M03", "Mediterranean Quinoa & Protein Salad", 340.0, "Organic red quinoa, kalamata olives, diced cucumbers, bell peppers, Greek feta, and lemon vinaigrette.", 10)

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
    add_items_to_tab(tab_2.id, [{"menu_item_id": item_coffee.id, "quantity": 1}, {"menu_item_id": item_sandwich.id, "quantity": 1}], bar_user)

    end_shift(shift.id, ending_cash=1500.0)

    # ==========================
    # 4. CRM Enquiries
    # ==========================
    # Lead 1: New / Assigned
    lead_1, fw_1 = process_public_enquiry({
        "name": "John Doe",
        "email": "john.doe@example.com",
        "phone": "+91 99999 11111",
        "source": "WEBSITE",
        "notes": "Interested in tennis."
    })
    update_follow_up(fw_1.id, "COMPLETED", "CALLED", "Wants to visit")
    
    # Lead 2: Lost
    lead_2, fw_2 = process_public_enquiry({
        "name": "Jane Smith",
        "email": "jane.smith@example.com",
        "phone": "+91 99999 22222",
        "source": "WALK_IN"
    })
    update_lead(lead_2.id, {"status": "LOST"}, admin)
    
    # Lead 3: Converted
    lead_3, fw_3 = process_public_enquiry({
        "name": "New Member",
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
