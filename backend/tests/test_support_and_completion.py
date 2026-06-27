"""Customer support and match completion flow tests."""

from datetime import datetime, timedelta

from tests.test_matches import MATCH_PAYLOAD


def _signup_and_login(client, email, nickname):
    signup = client.post(
        "/signup",
        json={"email": email, "password": "testpass123", "nickname": nickname},
    )
    assert signup.status_code == 200
    login = client.post(
        "/login",
        json={"email": email, "password": "testpass123"},
    )
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def _create_finished_match(client, headers):
    end_time = datetime.now() - timedelta(minutes=1)
    start_time = end_time - timedelta(hours=2)
    payload = {
        **MATCH_PAYLOAD,
        "date": start_time.strftime("%Y-%m-%d"),
        "startTime": start_time.strftime("%H:%M"),
    }
    response = client.post("/matches", json=payload, headers=headers)
    assert response.status_code == 200
    return response.json()["id"]


def test_user_sees_only_own_suggestions(client, auth_headers):
    other_headers = _signup_and_login(client, "other-suggestion@boardway.io", "다른제안자")

    first = client.post(
        "/suggestions",
        json={"category": "게임 추가", "content": "아크노바 게임을 추가해주세요."},
        headers=auth_headers,
    )
    second = client.post(
        "/suggestions",
        json={"category": "기능 개선", "content": "검색 필터를 추가해주세요."},
        headers=other_headers,
    )

    assert first.status_code == 200
    assert second.status_code == 200
    mine = client.get("/suggestions", headers=auth_headers)
    assert mine.status_code == 200
    assert len(mine.json()["suggestions"]) == 1
    assert mine.json()["suggestions"][0]["content"] == "아크노바 게임을 추가해주세요."


def test_admin_sees_all_suggestions(client, auth_headers):
    other_headers = _signup_and_login(client, "admin-view@boardway.io", "관리자후보")
    client.post(
        "/suggestions",
        json={"category": "게임 추가", "content": "게임 하나를 더 추가해주세요."},
        headers=auth_headers,
    )
    client.post(
        "/suggestions",
        json={"category": "기타", "content": "고객센터 테스트 의견입니다."},
        headers=other_headers,
    )

    db = client.testing_session_factory()
    try:
        import models

        admin = db.query(models.User).filter(models.User.email == "admin-view@boardway.io").first()
        admin.is_admin = True
        db.commit()
    finally:
        db.close()

    response = client.get("/suggestions", headers=other_headers)
    assert response.status_code == 200
    assert len(response.json()["suggestions"]) == 2


def test_admin_can_reply_to_suggestion_and_user_sees_reply(client, auth_headers):
    admin_headers = _signup_and_login(client, "reply-admin@boardway.io", "답변관리자")
    created = client.post(
        "/suggestions",
        json={"category": "게임 추가", "content": "부루마불을 더 추가해주세요."},
        headers=auth_headers,
    )
    assert created.status_code == 200
    suggestion_id = created.json()["id"]

    forbidden = client.post(
        f"/suggestions/{suggestion_id}/reply",
        json={"admin_reply": "일반 사용자는 답변할 수 없어야 합니다."},
        headers=auth_headers,
    )
    assert forbidden.status_code == 403

    db = client.testing_session_factory()
    try:
        import models

        admin = db.query(models.User).filter(models.User.email == "reply-admin@boardway.io").first()
        admin.is_admin = True
        db.commit()
    finally:
        db.close()

    replied = client.post(
        f"/suggestions/{suggestion_id}/reply",
        json={"admin_reply": "요청 주신 게임은 다음 업데이트 후보에 넣어둘게요."},
        headers=admin_headers,
    )
    assert replied.status_code == 200
    assert replied.json()["admin_reply"] == "요청 주신 게임은 다음 업데이트 후보에 넣어둘게요."
    assert replied.json()["answered_at"] is not None

    mine = client.get("/suggestions", headers=auth_headers)
    assert mine.status_code == 200
    assert mine.json()["suggestions"][0]["admin_reply"] == "요청 주신 게임은 다음 업데이트 후보에 넣어둘게요."


def test_only_host_can_complete_finished_match(client, auth_headers):
    match_id = _create_finished_match(client, auth_headers)
    other_headers = _signup_and_login(client, "completion-user@boardway.io", "완료참여자")
    joined = client.post(f"/matches/{match_id}/join", json={}, headers=other_headers)
    assert joined.status_code == 200

    forbidden = client.post(f"/matches/{match_id}/complete", headers=other_headers)
    assert forbidden.status_code == 403

    completed = client.post(f"/matches/{match_id}/complete", headers=auth_headers)
    assert completed.status_code == 200

    detail = client.get(f"/matches/{match_id}")
    assert detail.status_code == 200
    assert detail.json()["completed"] is True
    assert detail.json()["completed_at"] is not None


def test_completion_starts_participant_reviews(client, auth_headers, registered_user):
    match_id = _create_finished_match(client, auth_headers)
    other_headers = _signup_and_login(client, "review-user@boardway.io", "평가참여자")
    joined = client.post(f"/matches/{match_id}/join", json={}, headers=other_headers)
    assert joined.status_code == 200

    before_completion = client.post(
        "/me/reviews",
        json={
            "match_id": match_id,
            "reviews": [{"reviewee_nickname": registered_user["nickname"], "rating": 6}],
            "comment": "좋은 모임이었습니다.",
        },
        headers=other_headers,
    )
    assert before_completion.status_code == 400

    completed = client.post(f"/matches/{match_id}/complete", headers=auth_headers)
    assert completed.status_code == 200

    review = client.post(
        "/me/reviews",
        json={
            "match_id": match_id,
            "reviews": [{"reviewee_nickname": registered_user["nickname"], "rating": 6}],
            "comment": "좋은 모임이었습니다.",
        },
        headers=other_headers,
    )
    assert review.status_code == 200
    assert len(review.json()) == 1


def test_host_cancellation_does_not_refund_host(client, auth_headers):
    created = client.post("/matches", json=MATCH_PAYLOAD, headers=auth_headers)
    assert created.status_code == 200
    match_id = created.json()["id"]

    other_headers = _signup_and_login(client, "cancel-user@boardway.io", "취소참여자")
    joined = client.post(f"/matches/{match_id}/join", json={}, headers=other_headers)
    assert joined.status_code == 200

    cancelled = client.post(f"/matches/{match_id}/cancel", headers=auth_headers)
    assert cancelled.status_code == 200
    assert cancelled.json()["refunded_count"] == 1

    host_me = client.get("/me", headers=auth_headers)
    participant_me = client.get("/me", headers=other_headers)
    assert host_me.json()["points"] == 0
    assert participant_me.json()["points"] == 12000


def test_host_reward_paid_after_good_host_reviews(client, auth_headers, registered_user):
    match_id = _create_finished_match(client, auth_headers)
    other_headers = _signup_and_login(client, "host-reward-user@boardway.io", "리워드참여자")
    joined = client.post(f"/matches/{match_id}/join", json={}, headers=other_headers)
    assert joined.status_code == 200

    completed = client.post(f"/matches/{match_id}/complete", headers=auth_headers)
    assert completed.status_code == 200

    review = client.post(
        "/me/reviews",
        json={
            "match_id": match_id,
            "reviews": [{"reviewee_nickname": registered_user["nickname"], "rating": 5}],
            "comment": "방장이 친절하게 진행해줬어요.",
        },
        headers=other_headers,
    )
    assert review.status_code == 200

    host_me = client.get("/me", headers=auth_headers)
    assert host_me.status_code == 200
    assert host_me.json()["points"] == 3000

    history = client.get("/me/points/history", headers=auth_headers)
    assert history.status_code == 200
    assert history.json()[0]["amount"] == 3000
    assert "우수 방장 리워드" in history.json()[0]["description"]

    notifications = client.get("/me/notifications", headers=auth_headers)
    assert notifications.status_code == 200
    assert any(item["type"] == "host_reward_paid" for item in notifications.json())
