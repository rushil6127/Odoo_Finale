import pytest
from datetime import date, datetime, time, timedelta
from flask_jwt_extended import create_access_token
from backend.app.auth.models import User
from backend.app.auth.services import create_user
from backend.app.common.permissions import RoleEnum
from backend.app.courts.models import Court, SportType, CourtStatus
from backend.app.courts.services import (
    generate_candidate_slots,
    get_court_availability,
    create_court,
    get_court_by_id,
    get_all_courts,
    update_court,
    seed_default_courts,
)


@pytest.fixture
def admin_token(app, db_session):
    """Admin auth header."""
    user = create_user(
        email="admin.courts@club.com",
        password="AdminPassword123!",
        first_name="Admin",
        last_name="Courts",
        role=RoleEnum.ADMIN,
    )
    token = create_access_token(identity=str(user.id), additional_claims={"role": "ADMIN"})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def member_token(app, db_session):
    """Member auth header."""
    user = create_user(
        email="member.courts@club.com",
        password="MemberPassword123!",
        first_name="Member",
        last_name="Courts",
        role=RoleEnum.MEMBER,
    )
    token = create_access_token(identity=str(user.id), additional_claims={"role": "MEMBER"})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def front_desk_token(app, db_session):
    """Front desk auth header."""
    user = create_user(
        email="desk.courts@club.com",
        password="DeskPassword123!",
        first_name="Desk",
        last_name="Courts",
        role=RoleEnum.FRONT_DESK,
    )
    token = create_access_token(identity=str(user.id), additional_claims={"role": "FRONT_DESK"})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def seeded_courts(app, db_session):
    """Seed the default courts for testing."""
    return seed_default_courts()


# ---------------------------------------------------------
# 1. Slot Generation & Boundary Tests
# ---------------------------------------------------------

def test_slot_generation_boundaries(app):
    """Test slot generation algorithm adhering to operating hours and steps."""
    with app.app_context():
        target_date = date(2026, 10, 18)
        slots = generate_candidate_slots(
            target_date=target_date,
            open_time_str="06:00",
            close_time_str="22:00",
            slot_duration_minutes=60,
            slot_interval_minutes=30,
        )

        assert len(slots) > 0

        # First valid slot starts at 06:00 and ends at 07:00
        first_slot = slots[0]
        assert first_slot["start_time"] == "06:00"
        assert first_slot["end_time"] == "07:00"
        assert first_slot["duration_minutes"] == 60
        assert first_slot["is_available"] is True

        # Second valid slot starts at 06:30 and ends at 07:30 (30-min step)
        second_slot = slots[1]
        assert second_slot["start_time"] == "06:30"
        assert second_slot["end_time"] == "07:30"

        # Third slot
        third_slot = slots[2]
        assert third_slot["start_time"] == "07:00"
        assert third_slot["end_time"] == "08:00"

        # Last valid slot starts at 21:00 and ends at 22:00
        last_slot = slots[-1]
        assert last_slot["start_time"] == "21:00"
        assert last_slot["end_time"] == "22:00"

        # Total count from 06:00 to 21:00 in 30-min increments = 31 slots
        assert len(slots) == 31

        # Verify NO slot starts after 21:00 or ends after 22:00
        for slot in slots:
            assert slot["start_time"] <= "21:00"
            assert slot["end_time"] <= "22:00"


def test_custom_operating_hours_slot_generation(app):
    """Test slot generation with custom court operating hours (e.g. 08:00 to 20:00)."""
    with app.app_context():
        target_date = date(2026, 10, 18)
        slots = generate_candidate_slots(
            target_date=target_date,
            open_time_str="08:00",
            close_time_str="20:00",
            slot_duration_minutes=60,
            slot_interval_minutes=30,
        )

        assert slots[0]["start_time"] == "08:00"
        assert slots[-1]["start_time"] == "19:00"
        assert slots[-1]["end_time"] == "20:00"
        assert len(slots) == 23


# ---------------------------------------------------------
# 2. Four Supported Sports Tests
# ---------------------------------------------------------

def test_all_four_sports_supported(app, db_session):
    """Test that Tennis, Padel, Badminton, and Box Cricket courts can be created."""
    tennis = create_court(name="Tennis Court Test", sport_type="TENNIS", surface_type="Grass")
    padel = create_court(name="Padel Court Test", sport_type="PADEL", surface_type="Turf")
    badminton = create_court(name="Badminton Court Test", sport_type="BADMINTON", is_indoor=True)
    box_cricket = create_court(name="Box Cricket Pitch Test", sport_type="BOX_CRICKET")

    assert tennis.sport_type == SportType.TENNIS
    assert padel.sport_type == SportType.PADEL
    assert badminton.sport_type == SportType.BADMINTON
    assert box_cricket.sport_type == SportType.BOX_CRICKET


def test_unsupported_sport_rejected(app, db_session, client, admin_token):
    """Test attempting to create a court with an unsupported sport fails with 422."""
    payload = {
        "name": "Olympic Swimming Pool",
        "sport_type": "SWIMMING",
    }
    response = client.post("/api/v1/courts", json=payload, headers=admin_token)
    assert response.status_code == 422
    data = response.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "VALIDATION_ERROR"


# ---------------------------------------------------------
# 3. Inactive and Maintenance Courts Excluded from Availability
# ---------------------------------------------------------

def test_maintenance_and_inactive_courts_excluded_from_availability(
    app, db_session, seeded_courts
):
    """Test that only ACTIVE courts appear in candidate availability slots."""
    # Create an inactive and a maintenance court
    create_court(
        name="Under Maintenance Arena",
        sport_type="TENNIS",
        status=CourtStatus.MAINTENANCE,
    )
    create_court(
        name="Decommissioned Court",
        sport_type="PADEL",
        status=CourtStatus.INACTIVE,
    )

    avail = get_court_availability(target_date=date(2026, 10, 18))
    court_names = [c["name"] for c in avail["courts"]]

    assert "Under Maintenance Arena" not in court_names
    assert "Decommissioned Court" not in court_names

    # All returned courts must have ACTIVE status and is_bookable True
    for c in avail["courts"]:
        assert c["status"] == "ACTIVE"
        assert c["is_bookable"] is True
        assert len(c["slots"]) > 0


# ---------------------------------------------------------
# 4. Availability API Endpoint Tests
# ---------------------------------------------------------

def test_availability_endpoint_valid_date(client, seeded_courts):
    """Test GET /api/v1/courts/availability with valid date parameter."""
    response = client.get("/api/v1/courts/availability?date=2026-10-18")
    assert response.status_code == 200
    data = response.get_json()
    assert data["success"] is True
    assert data["data"]["date"] == "2026-10-18"
    assert "operating_hours" in data["data"]
    assert data["data"]["operating_hours"]["open_time"] == "06:00"
    assert data["data"]["operating_hours"]["close_time"] == "22:00"
    assert data["data"]["operating_hours"]["slot_duration_minutes"] == 60
    assert data["data"]["operating_hours"]["slot_interval_minutes"] == 30
    assert len(data["data"]["courts"]) == 8  # 8 seeded active courts


def test_availability_endpoint_filter_by_sport(client, seeded_courts):
    """Test GET /api/v1/courts/availability filtered by sport_type."""
    response = client.get("/api/v1/courts/availability?date=2026-10-18&sport_type=BADMINTON")
    assert response.status_code == 200
    data = response.get_json()
    assert data["success"] is True
    assert len(data["data"]["courts"]) == 2
    for court in data["data"]["courts"]:
        assert court["sport_type"] == "BADMINTON"


def test_availability_endpoint_missing_date(client, seeded_courts):
    """Test GET /api/v1/courts/availability without date returns 422."""
    response = client.get("/api/v1/courts/availability")
    assert response.status_code == 422
    data = response.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "VALIDATION_ERROR"


def test_availability_endpoint_invalid_date_format(client, seeded_courts):
    """Test GET /api/v1/courts/availability with invalid date format returns 422."""
    response = client.get("/api/v1/courts/availability?date=18-10-2026")
    assert response.status_code == 422
    data = response.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "VALIDATION_ERROR"


def test_availability_endpoint_unsupported_sport_filter(client, seeded_courts):
    """Test GET /api/v1/courts/availability with unsupported sport returns 422."""
    response = client.get("/api/v1/courts/availability?date=2026-10-18&sport_type=RUGBY")
    assert response.status_code == 422
    data = response.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "VALIDATION_ERROR"


# ---------------------------------------------------------
# 5. Court CRUD & Role-Based Authorization Tests
# ---------------------------------------------------------

def test_admin_create_court_success(client, admin_token):
    """Test ADMIN role can create a new court."""
    payload = {
        "name": "Championship Court 1",
        "sport_type": "TENNIS",
        "surface_type": "Hard",
        "is_indoor": False,
        "features": {"floodlights": True},
        "description": "Stadium court with electronic scoreboard.",
    }
    response = client.post("/api/v1/courts", json=payload, headers=admin_token)
    assert response.status_code == 201
    data = response.get_json()
    assert data["success"] is True
    assert data["data"]["court"]["name"] == "Championship Court 1"
    assert data["data"]["court"]["sport_type"] == "TENNIS"


def test_member_cannot_create_court(client, member_token):
    """Test MEMBER role cannot create a court (403 Forbidden)."""
    payload = {"name": "Member Court", "sport_type": "TENNIS"}
    response = client.post("/api/v1/courts", json=payload, headers=member_token)
    assert response.status_code == 403
    data = response.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "FORBIDDEN"


def test_front_desk_cannot_create_court(client, front_desk_token):
    """Test FRONT_DESK role cannot create a court (403 Forbidden)."""
    payload = {"name": "Front Desk Court", "sport_type": "TENNIS"}
    response = client.post("/api/v1/courts", json=payload, headers=front_desk_token)
    assert response.status_code == 403
    data = response.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "FORBIDDEN"


def test_admin_update_court_success(client, admin_token, seeded_courts):
    """Test ADMIN role can update court attributes."""
    court = seeded_courts[0]
    payload = {
        "status": "MAINTENANCE",
        "description": "Court resurfacing in progress.",
    }
    response = client.put(f"/api/v1/courts/{court.id}", json=payload, headers=admin_token)
    assert response.status_code == 200
    data = response.get_json()
    assert data["success"] is True
    assert data["data"]["court"]["status"] == "MAINTENANCE"
    assert data["data"]["court"]["is_bookable"] is False


def test_get_court_detail_public(client, seeded_courts):
    """Test anyone can view court detail."""
    court = seeded_courts[0]
    response = client.get(f"/api/v1/courts/{court.id}")
    assert response.status_code == 200
    data = response.get_json()
    assert data["success"] is True
    assert data["data"]["court"]["id"] == court.id


def test_get_nonexistent_court_returns_404(client):
    """Test requesting non-existent court returns 404."""
    response = client.get("/api/v1/courts/9999")
    assert response.status_code == 404
    data = response.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "NOT_FOUND"


def test_duplicate_court_name_conflict(client, admin_token, seeded_courts):
    """Test creating a court with duplicate name returns 409 Conflict."""
    payload = {
        "name": seeded_courts[0].name,
        "sport_type": "TENNIS",
    }
    response = client.post("/api/v1/courts", json=payload, headers=admin_token)
    assert response.status_code == 409
    data = response.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "CONFLICT"
