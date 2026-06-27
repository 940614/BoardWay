"""
pytest 공통 설정 — 테스트용 인메모리 DB + FastAPI TestClient 제공.

각 테스트 함수마다 깨끗한 DB를 새로 만들어 테스트끼리 데이터가 섞이지 않습니다.

SQLite :memory: 주의: 새 연결마다 빈 DB가 생성됨 → StaticPool로 단일 연결 강제.
"""
import os
import sys

# 테스트용 환경변수 — main.py 임포트 전에 반드시 설정
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-only")

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import models  # Base.metadata에 모든 테이블 등록
from database import Base, get_db
from main import app

TEST_DATABASE_URL = "sqlite:///:memory:"


@pytest.fixture()
def client():
    # StaticPool: 모든 연결이 동일한 인메모리 DB를 공유 (create_all 한 곳, 쿼리도 같은 곳)
    engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as c:
        c.testing_session_factory = TestingSession
        yield c

    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.clear()


@pytest.fixture()
def registered_user(client):
    """회원가입된 사용자 + 토큰을 반환하는 픽스처."""
    client.post("/signup", json={
        "email": "test@boardway.io",
        "password": "testpass123",
        "nickname": "테스트유저",
    })
    resp = client.post("/login", json={
        "email": "test@boardway.io",
        "password": "testpass123",
    })
    token = resp.json()["access_token"]
    return {"token": token, "email": "test@boardway.io", "nickname": "테스트유저"}


@pytest.fixture()
def auth_headers(registered_user):
    return {"Authorization": f"Bearer {registered_user['token']}"}
