"""Shared model factories and test data generators for Champions Club test suites."""

from datetime import datetime, date, timedelta, timezone
from decimal import Decimal
from typing import Optional, Dict, Any

from backend.app.extensions import db
from backend.app.common.permissions import RoleEnum
from backend.app.auth.models import User
from backend.app.auth.services import create_user
from backend.app.members.models import Member
from backend.app.members.services import create_member
from backend.app.memberships.models import MembershipPlan, Membership
from backend.app.memberships.services import assign_membership
from backend.app.courts.models import Court, SportType, CourtStatus
from backend.app.bookings.models import Booking, BookingStatus
from backend.app.bookings.services import create_booking
from backend.app.payments.models import Payment, PaymentMethod, PaymentStatus, PaymentItemType
from backend.app.payments.services import create_or_initiate_payment
from backend.app.inventory.models import ProductCategory, Product, InventoryMovement, MovementType
from backend.app.pos.models import POSTable, TableStatus


class UserFactory:
    """Factory helper for creating users across roles."""

    _counter = 0

    @classmethod
    def create(
        cls,
        email: Optional[str] = None,
        password: str = "TestPassword123!",
        first_name: str = "Test",
        last_name: str = "User",
        role: RoleEnum = RoleEnum.MEMBER,
        is_active: bool = True,
    ) -> User:
        cls._counter += 1
        final_email = email or f"user_{cls._counter}_{role.value.lower()}@championsclub.com"
        user = create_user(
            email=final_email,
            password=password,
            first_name=first_name,
            last_name=f"{last_name}{cls._counter}",
            role=role,
            is_active=is_active,
        )
        return user


class MemberFactory:
    """Factory helper for creating member profiles and memberships."""

    _counter = 0

    @classmethod
    def create(
        cls,
        user: Optional[User] = None,
        plan_code: Optional[str] = None,
        phone: Optional[str] = None,
        date_of_birth: Optional[date] = None,
        start_date: Optional[date] = None,
        duration_months: int = 12,
        is_active: bool = True,
    ) -> Member:
        cls._counter += 1
        if user is None:
            user = UserFactory.create(
                role=RoleEnum.MEMBER,
                is_active=is_active,
            )

        member = Member.query.filter_by(user_id=user.id).first()
        if not member:
            final_phone = phone or f"98765{cls._counter:05d}"
            member = create_member(
                user_id=user.id,
                phone=final_phone,
                date_of_birth=date_of_birth or date(1995, 5, 20),
            )

        if plan_code:
            plan = MembershipPlan.query.filter_by(code=plan_code.upper()).first()
            if not plan:
                discount_map = {"GOLD": 100.0, "SILVER": 50.0, "JUNIOR": 50.0}
                fee_map = {"GOLD": 5000.0, "SILVER": 2500.0, "JUNIOR": 1500.0}
                plan = MembershipPlan(
                    name=f"{plan_code.capitalize()} Tier",
                    code=plan_code.upper(),
                    displayed_monthly_price=Decimal(str(fee_map.get(plan_code.upper(), 2500.0))),
                    benefits={"court_discount_percent": discount_map.get(plan_code.upper(), 50.0)},
                    is_active=True,
                )
                db.session.add(plan)
                db.session.commit()

            s_date = start_date or date.today()
            assign_membership(
                member_id=member.id,
                plan_id=plan.id,
                start_date=s_date,
                duration_months=duration_months,
            )

        return member


class CourtFactory:
    """Factory helper for sports courts and arenas."""

    _counter = 0

    @classmethod
    def create(
        cls,
        name: Optional[str] = None,
        sport_type: SportType = SportType.LAWN_TENNIS,
        surface_type: str = "Synthetic Hard Court",
        is_indoor: bool = False,
        status: CourtStatus = CourtStatus.ACTIVE,
        features: Optional[Dict[str, Any]] = None,
    ) -> Court:
        cls._counter += 1
        court = Court(
            name=name or f"{sport_type.value.replace('_', ' ').title()} Court {cls._counter}",
            sport_type=sport_type,
            surface_type=surface_type,
            is_indoor=is_indoor,
            status=status,
            features=features or {"floodlights": True, "electronic_scoreboard": True},
        )
        db.session.add(court)
        db.session.commit()
        return court


class BookingFactory:
    """Factory helper for court reservations."""

    @classmethod
    def create(
        cls,
        court: Court,
        start_time: datetime,
        user: Optional[User] = None,
        member: Optional[Member] = None,
        is_walk_in: bool = False,
        is_social_play: bool = False,
        guest_name: Optional[str] = None,
        status: BookingStatus = BookingStatus.CONFIRMED,
    ) -> Booking:
        if not is_walk_in and not member:
            if user:
                member = Member.query.filter_by(user_id=user.id).first()
                if not member:
                    member = MemberFactory.create(user=user)
            else:
                user = UserFactory.create(role=RoleEnum.MEMBER)
                member = MemberFactory.create(user=user)

        user_id = user.id if user else (member.user_id if member else None)
        member_id = member.id if member else None

        booking = create_booking(
            court_id=court.id,
            start_time=start_time,
            user_id=user_id,
            member_id=member_id,
            is_walk_in=is_walk_in,
            is_social_play=is_social_play,
            guest_name=guest_name or ("Walk-in Guest" if is_walk_in else None),
        )
        return booking


class PaymentFactory:
    """Factory helper for financial payment records."""

    @classmethod
    def create(
        cls,
        item_type: str = "BOOKING",
        item_id: int = 1,
        amount: Decimal = Decimal("800.00"),
        payment_method: PaymentMethod = PaymentMethod.CASH,
        user: Optional[User] = None,
        member: Optional[Member] = None,
        status: PaymentStatus = PaymentStatus.PENDING,
    ) -> Payment:
        payment = Payment(
            payment_reference=f"PAY-FAC-{datetime.now(timezone.utc).timestamp()}",
            item_type=PaymentItemType(item_type.upper()),
            item_id=item_id,
            amount=amount,
            currency="INR",
            payment_method=payment_method,
            status=status,
            user_id=user.id if user else None,
            member_id=member.id if member else None,
            paid_at=datetime.now(timezone.utc) if status == PaymentStatus.PAID else None,
        )
        db.session.add(payment)
        db.session.commit()
        return payment


class ProductFactory:
    """Factory helper for shop / inventory items."""

    _counter = 0

    @classmethod
    def create(
        cls,
        name: Optional[str] = None,
        sku: Optional[str] = None,
        price: float = 1200.0,
        stock: int = 20,
        category: Optional[ProductCategory] = None,
    ) -> Product:
        cls._counter += 1
        if not category:
            category = ProductCategory.query.filter_by(slug="general").first()
            if not category:
                category = ProductCategory(name="General Equipment", slug="general", is_active=True)
                db.session.add(category)
                db.session.commit()

        product = Product(
            name=name or f"Pro Equipment {cls._counter}",
            sku=sku or f"SKU-{cls._counter:04d}",
            price=Decimal(str(price)),
            current_stock=stock,
            low_stock_threshold=5,
            category_id=category.id,
            is_active=True,
        )
        db.session.add(product)
        db.session.commit()
        return product


class TableFactory:
    """Factory helper for cafeteria / bar POS tables."""

    _counter = 0

    @classmethod
    def create(
        cls,
        table_number: Optional[str] = None,
        capacity: int = 4,
        section: str = "Indoor Lounge",
        status: TableStatus = TableStatus.AVAILABLE,
    ) -> POSTable:
        cls._counter += 1
        table = POSTable(
            table_number=table_number or f"T-{cls._counter:02d}",
            capacity=capacity,
            section=section,
            status=status,
            is_active=True,
        )
        db.session.add(table)
        db.session.commit()
        return table
