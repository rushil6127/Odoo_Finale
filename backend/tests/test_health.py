def test_health_endpoint(client):
    """Test that the /api/v1/health endpoint returns 200 and valid JSON."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    json_data = response.get_json()

    assert json_data["success"] is True
    assert "data" in json_data
    assert json_data["data"]["status"] == "healthy"
    assert json_data["data"]["service"] == "champions-club-api"
    assert json_data["data"]["database"] == "healthy"


def test_legacy_health_alias(client):
    """Test that the /health alias endpoint returns 200."""
    response = client.get("/health")
    assert response.status_code == 200
    json_data = response.get_json()
    assert json_data["success"] is True
    assert json_data["data"]["status"] == "healthy"


def test_standard_404_error_response(client):
    """Test that an unknown endpoint returns standardized error JSON."""
    response = client.get("/api/v1/non-existent-route")
    assert response.status_code == 404
    json_data = response.get_json()

    assert json_data["success"] is False
    assert "error" in json_data
    assert json_data["error"]["code"] == "NOT_FOUND"
    assert "message" in json_data["error"]
