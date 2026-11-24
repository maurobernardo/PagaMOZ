import pytest


@pytest.mark.django_db
def test_health_ok(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_schema(client):
    assert client.get("/api/schema").status_code == 200
