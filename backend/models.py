from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, JSON, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    password = Column(String)
    nickname = Column(String, unique=True)
    mannerScore = Column(Integer, default=5)
    points = Column(Integer, default=0, nullable=False)
    is_admin = Column(Boolean, default=False, nullable=False)

    point_history = relationship(
        "PointHistory",
        back_populates="user",
        cascade="all, delete-orphan",
        order_by="PointHistory.created_at.desc()",
    )

    reviews_given = relationship(
        "Review",
        back_populates="reviewer",
        cascade="all, delete-orphan",
        order_by="Review.created_at.desc()",
    )


class PointHistory(Base):
    __tablename__ = "point_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    type = Column(String, nullable=False)  # '충전' | '사용'
    amount = Column(Integer, nullable=False)
    description = Column(String, nullable=False, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="point_history")

class Review(Base):
    __tablename__ = "reviews"

    # (reviewer × reviewee_nickname × match) 단위로 row 한 개.
    # 한 매치에 참여자 N명이면 reviewer 가 N-1 개 row INSERT (자기 자신 제외).
    id = Column(Integer, primary_key=True, index=True)
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    reviewee_nickname = Column(String, nullable=False, index=True)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False, index=True)
    rating = Column(Integer, nullable=False)  # 1~6
    comment = Column(String, nullable=False, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    reviewer = relationship("User", back_populates="reviews_given")


class Game(Base):
    __tablename__ = "games"

    id = Column(Integer, primary_key=True, index=True)
    game_id = Column(String, unique=True, index=True) # e.g., "g1"
    name = Column(String)
    players = Column(String)
    difficulty = Column(String)
    genre = Column(String, nullable=True)
    description = Column(String)
    ruleUrl = Column(String)
    image = Column(String)

class Match(Base):
    __tablename__ = "matches"

    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(String, unique=True, index=True) # e.g., "m1"
    
    games = Column(JSON) # List of strings
    difficulty = Column(String)
    tags = Column(JSON)
    date = Column(String) # YYYY-MM-DD
    startTime = Column(String)
    ruleVideoUrls = Column(JSON)
    
    # location fields
    venue = Column(String)
    branch = Column(String)
    address = Column(String)

    maxPlayers = Column(Integer)
    host_nickname = Column(String, nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    cancelled = Column(Boolean, default=False, nullable=False)
    is_flexible = Column(Boolean, default=False, nullable=False)

    participants = relationship("MatchParticipant", back_populates="match", cascade="all, delete-orphan")

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False, index=True)
    sender_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    sender_nickname = Column(String, nullable=False)  # 비정규화 캐시 — 메시지 표시 시 user 조회 안 해도 됨
    content = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    type = Column(String, nullable=False)  # 'match_cancelled' 등
    title = Column(String, nullable=False)
    body = Column(String, nullable=False, default="")
    match_business_id = Column(String, nullable=True)  # 'm1' 같은 비즈니스 ID. 탭 시 이동용.
    read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ConsumedPayment(Base):
    __tablename__ = "consumed_payments"

    payment_id = Column(String, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    amount = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class MatchParticipant(Base):
    __tablename__ = "match_participants"

    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(Integer, ForeignKey("matches.id"))
    nickname = Column(String)
    mannerScore = Column(Integer)
    joined_at = Column(DateTime, default=datetime.now, nullable=False)

    match = relationship("Match", back_populates="participants")
