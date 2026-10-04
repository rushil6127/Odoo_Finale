import click
from flask.cli import with_appcontext
from backend.app.extensions import db
from backend.app.inventory.models import ProductCategory, Product, MovementType, generate_movement_reference, InventoryMovement
from backend.app.inventory.services import create_category, create_product


DEFAULT_CATEGORIES = [
    {
        "name": "Rackets",
        "slug": "rackets",
        "description": "High-performance tennis, padel, and badminton rackets.",
    },
    {
        "name": "Balls",
        "slug": "balls",
        "description": "Championship-grade tennis balls, padel balls, and shuttlecocks.",
    },
    {
        "name": "Shoes",
        "slug": "shoes",
        "description": "Court shoes engineered for clay, grass, and synthetic turf.",
    },
    {
        "name": "Apparel",
        "slug": "apparel",
        "description": "Breathable club sportswear, jerseys, shorts, and skirts.",
    },
    {
        "name": "Accessories",
        "slug": "accessories",
        "description": "Grips, dampeners, wristbands, kit bags, and water bottles.",
    },
]

SAMPLE_PRODUCTS = [
    {
        "sku": "RCK-WIL-PRO97",
        "name": "Wilson Pro Staff 97 v14",
        "category_slug": "rackets",
        "price": 22000.00,
        "cost_price": 16000.00,
        "stock_quantity": 12,
        "low_stock_threshold": 3,
        "description": "Precision and feel for advanced players. 315g unstrung.",
        "barcode": "887768991011",
        "image_url": "/images/products/wilson-pro-staff.jpg",
    },
    {
        "sku": "RCK-BAB-AER",
        "name": "Babolat Pure Aero 2023",
        "category_slug": "rackets",
        "price": 21500.00,
        "cost_price": 15500.00,
        "stock_quantity": 8,
        "low_stock_threshold": 3,
        "description": "Maximum spin and power. Rafael Nadal edition.",
        "barcode": "887768991012",
        "image_url": "/images/products/babolat-pure-aero.jpg",
    },
    {
        "sku": "BAL-WIL-US3",
        "name": "Wilson US Open Tennis Balls (Can of 3)",
        "category_slug": "balls",
        "price": 650.00,
        "cost_price": 420.00,
        "stock_quantity": 120,
        "low_stock_threshold": 25,
        "description": "Official ball of the US Open. Premium woven felt.",
        "barcode": "887768991021",
        "image_url": "/images/products/wilson-us-open-balls.jpg",
    },
    {
        "sku": "BAL-HEAD-PRO",
        "name": "HEAD Padel Pro S (Can of 3)",
        "category_slug": "balls",
        "price": 750.00,
        "cost_price": 500.00,
        "stock_quantity": 50,
        "low_stock_threshold": 15,
        "description": "Faster ball for dynamic padel rallies.",
        "barcode": "887768991022",
        "image_url": "/images/products/head-padel-pro.jpg",
    },
    {
        "sku": "SHOE-ASI-RES8",
        "name": "Asics Gel Resolution 8 (Size 10)",
        "category_slug": "shoes",
        "price": 11999.00,
        "cost_price": 8500.00,
        "stock_quantity": 4,
        "low_stock_threshold": 5,
        "description": "Advanced stability and cushioning for competitive tennis.",
        "barcode": "887768991031",
        "image_url": "/images/products/asics-gel-resolution.jpg",
    },
    {
        "sku": "APP-CHAMP-POLO",
        "name": "Champions Club Dri-Fit Team Polo (M)",
        "category_slug": "apparel",
        "price": 1499.00,
        "cost_price": 800.00,
        "stock_quantity": 25,
        "low_stock_threshold": 10,
        "description": "Official club crest moisture-wicking polo.",
        "barcode": "887768991041",
        "image_url": "/images/products/champions-club-polo.jpg",
    },
    {
        "sku": "ACC-YON-OVER3",
        "name": "Yonex Super Grap Overgrip (Pack of 3)",
        "category_slug": "accessories",
        "price": 450.00,
        "cost_price": 250.00,
        "stock_quantity": 60,
        "low_stock_threshold": 20,
        "description": "Tacky feel and excellent shock absorption.",
        "barcode": "887768991051",
        "image_url": "/images/products/yonex-super-grap.jpg",
    },
]


@click.command("seed-inventory")
@with_appcontext
def seed_inventory_command():
    """Seed product categories and baseline equipment/apparel inventory."""
    click.echo("Seeding inventory categories and products...")

    cat_map = {}
    for cat_data in DEFAULT_CATEGORIES:
        existing = ProductCategory.query.filter_by(slug=cat_data["slug"]).first()
        if not existing:
            cat = ProductCategory(
                name=cat_data["name"],
                slug=cat_data["slug"],
                description=cat_data["description"],
                is_active=True,
            )
            db.session.add(cat)
            db.session.flush()
            cat_map[cat.slug] = cat
            click.echo(f"  Created category: {cat.name}")
        else:
            cat_map[existing.slug] = existing
            click.echo(f"  Category exists: {existing.name}")

    db.session.commit()

    for p_data in SAMPLE_PRODUCTS:
        existing = Product.query.filter_by(sku=p_data["sku"]).first()
        if not existing:
            cat = cat_map.get(p_data["category_slug"])
            if not cat:
                continue
            prod = Product(
                sku=p_data["sku"],
                name=p_data["name"],
                category_id=cat.id,
                price=p_data["price"],
                cost_price=p_data["cost_price"],
                stock_quantity=p_data["stock_quantity"],
                low_stock_threshold=p_data["low_stock_threshold"],
                description=p_data["description"],
                barcode=p_data["barcode"],
                image_url=p_data.get("image_url"),
                is_active=True,
            )
            db.session.add(prod)
            db.session.flush()

            # Record initial stock movement
            if prod.stock_quantity > 0:
                mov = InventoryMovement(
                    movement_reference=generate_movement_reference("INIT"),
                    product_id=prod.id,
                    movement_type=MovementType.STOCK_IN,
                    quantity_change=prod.stock_quantity,
                    previous_stock=0,
                    new_stock=prod.stock_quantity,
                    reason="INITIAL_STOCK",
                    notes="Baseline seed inventory",
                )
                db.session.add(mov)

            click.echo(f"  Created product: {prod.sku} - {prod.name} (Stock: {prod.stock_quantity})")
        else:
            click.echo(f"  Product exists: {existing.sku}")

    db.session.commit()
    click.echo("Inventory seeding completed successfully.")
