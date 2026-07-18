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


def test_same_match_report_can_be_received_and_handled(client, auth_headers):
    _signup_and_login(client, "reported@boardway.io", "신고대상")
    db = client.testing_session_factory()
    try:
        import models

        target = db.query(models.User).filter(models.User.email == "reported@boardway.io").first()
        reporter = db.query(models.User).filter(models.User.email == "test@boardway.io").first()
        reporter.is_admin = True
        match = models.Match(
            match_id="m-report-test",
            games=["스플랜더"], difficulty="보통", tags=["전략"],
            date="2030-01-01", startTime="19:00", ruleVideoUrls=[],
            venue="테스트카페", branch="강남점", address="서울 강남구",
            maxPlayers=4, host_nickname=reporter.nickname, created_by_user_id=reporter.id,
            completed=True,
        )
        db.add(match)
        db.flush()
        db.add_all([
            models.MatchParticipant(match_id=match.id, nickname=reporter.nickname, mannerScore=5),
            models.MatchParticipant(match_id=match.id, nickname=target.nickname, mannerScore=5),
            models.Review(reviewer_id=reporter.id, reviewee_nickname=target.nickname, match_id=match.id, rating=4, comment="테스트 평가"),
        ])
        db.commit()
        target_id = target.id
    finally:
        db.close()

    created = client.post(
        "/reports",
        json={
            "reported_user_id": target_id,
            "match_id": "m-report-test",
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
            "match_id": "m-report-test",
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


def test_report_requires_same_match(client, auth_headers):
    _signup_and_login(client, "reported2@boardway.io", "신고대상2")
    db = client.testing_session_factory()
    try:
        import models

        target = db.query(models.User).filter(models.User.email == "reported2@boardway.io").first()
        target_id = target.id
    finally:
        db.close()

    response = client.post(
        "/reports",
        json={
            "reported_user_id": target_id,
            "match_id": "m-not-shared",
            "category": "노쇼",
            "content": "같은 매칭에 참여하지 않은 사용자는 신고할 수 없습니다.",
        },
        headers=auth_headers,
    )
    assert response.status_code == 404
