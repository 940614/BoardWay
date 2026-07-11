"""User report and administrator handling flow tests."""


def _signup_and_login(client, email, nickname):
    signup = client.post(
        "/signup",
        json={"email": email, "password": "testpass123", "nickname": nickname},
    )
    assert signup.status_code == 200
    login = client.post("/login", json={"email": email, "password": "testpass123"})
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def test_friend_report_can_be_received_and_handled(client, auth_headers):
    target_headers = _signup_and_login(client, "reported@boardway.io", "신고대상")
    request = client.post("/friends/requests", json={"nickname": "신고대상"}, headers=auth_headers)
    assert request.status_code == 200

    requests = client.get("/friends/requests", headers=target_headers)
    assert requests.status_code == 200
    accepted = client.post(
        f"/friends/requests/{requests.json()['incoming'][0]['id']}/accept",
        headers=target_headers,
    )
    assert accepted.status_code == 200

    db = client.testing_session_factory()
    try:
        import models

        target = db.query(models.User).filter(models.User.email == "reported@boardway.io").first()
        reporter = db.query(models.User).filter(models.User.email == "test@boardway.io").first()
        reporter.is_admin = True
        db.commit()
        target_id = target.id
    finally:
        db.close()

    created = client.post(
        "/reports",
        json={
            "reported_user_id": target_id,
            "category": "노쇼",
            "content": "약속한 시간에 사전 연락 없이 참석하지 않았습니다.",
        },
        headers=auth_headers,
    )
    assert created.status_code == 200
    report_id = created.json()["id"]
    assert created.json()["status"] == "received"

    duplicate = client.post(
        "/reports",
        json={
            "reported_user_id": target_id,
            "category": "노쇼",
            "content": "같은 사유로 다시 신고합니다.",
        },
        headers=auth_headers,
    )
    assert duplicate.status_code == 400

    handled = client.patch(
        f"/reports/{report_id}/status",
        json={"status": "resolved", "admin_note": "사실관계를 확인하고 경고 조치했습니다."},
        headers=auth_headers,
    )
    assert handled.status_code == 200
    assert handled.json()["status"] == "resolved"
    assert handled.json()["admin_note"] == "사실관계를 확인하고 경고 조치했습니다."
