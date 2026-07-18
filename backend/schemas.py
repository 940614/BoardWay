from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import List, Optional, Literal
from datetime import datetime

class LocationBase(BaseModel):
    venue: str
    branch: str
    address: str

class ParticipantBase(BaseModel):
    nickname: str
    mannerScore: int
    isMe: bool = False

class MatchBase(BaseModel):
    games: List[str]
    difficulty: str
    tags: List[str]
    date: str
    startTime: str
    ruleVideoUrls: List[str]
    location: LocationBase
    maxPlayers: int
    is_flexible: bool = False

class MatchCreate(MatchBase):
    pass

class MatchResponse(MatchBase):
    id: str # This is match_id (e.g., "m1")
    participants: List[ParticipantBase] = []

    class Config:
        from_attributes = True

class JoinMatchRequest(BaseModel):
    role: str = "participant"  # "participant" | "host"


class CancelResponse(BaseModel):
    cancelled: bool
    refunded_count: int
    refund_amount: int
    message: str


class NotificationItem(BaseModel):
    id: int
    type: str
    title: str
    body: str
    match_business_id: Optional[str] = None
    read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class MessageCreate(BaseModel):
    content: str


class MessageItem(BaseModel):
    id: int
    sender_nickname: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class FriendRequestCreate(BaseModel):
    nickname: str = Field(..., min_length=1, max_length=50)

    @field_validator("nickname")
    @classmethod
    def _strip_nickname(cls, value: str):
        value = value.strip()
        if not value:
            raise ValueError("닉네임을 입력해주세요.")
        return value


class FriendItem(BaseModel):
    friendship_id: int
    user_id: int
    nickname: str
    mannerScore: int
    status: str = "accepted"


class FriendRequestItem(BaseModel):
    id: int
    requester_id: int
    requester_nickname: str
    addressee_id: int
    addressee_nickname: str
    status: str
    created_at: datetime


class FriendMessageItem(BaseModel):
    id: int
    sender_id: int
    sender_nickname: str
    recipient_id: int
    recipient_nickname: str
    content: str
    read: bool
    created_at: datetime


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    nickname: str
    mannerScore: int = 5

    @field_validator("nickname")
    @classmethod
    def _validate_nickname(cls, value: str):
        value = value.strip()
        if not value:
            raise ValueError("닉네임을 입력해주세요.")
        if any(ch.isspace() for ch in value):
            raise ValueError("닉네임에는 띄어쓰기를 사용할 수 없습니다.")
        return value

class UserResponse(BaseModel):
    id: int
    email: EmailStr
    nickname: str
    mannerScore: int
    points: int = 0
    is_admin: bool = False
    bio: str = ""
    preferred_genres: List[str] = Field(default_factory=list)
    preferred_locations: List[str] = Field(default_factory=list)

    class Config:
        from_attributes = True


class PublicUserProfile(BaseModel):
    id: int
    nickname: str
    mannerScore: int
    bio: str = ""
    preferred_genres: List[str] = Field(default_factory=list)
    preferred_locations: List[str] = Field(default_factory=list)
    relation: str = "visible"


class UserProfileUpdate(BaseModel):
    bio: str = Field("", max_length=300)
    preferred_genres: List[str] = Field(default_factory=list)
    preferred_locations: List[str] = Field(default_factory=list)

    @field_validator("bio")
    @classmethod
    def _validate_bio(cls, value: str):
        return value.strip()

    @field_validator("preferred_genres", "preferred_locations")
    @classmethod
    def _clean_list(cls, value: List[str]):
        cleaned = []
        for item in value or []:
            text = str(item).strip()
            if text and text not in cleaned:
                cleaned.append(text)
        return cleaned[:10]


class PointsAdjustRequest(BaseModel):
    delta: int
    description: str = ""


class AdminPointsAdjustRequest(BaseModel):
    user_identifier: str = Field(..., min_length=1, max_length=100)
    delta: int
    description: str = ""

    @field_validator("user_identifier")
    @classmethod
    def _strip_user_identifier(cls, value: str):
        return value.strip()

    @field_validator("delta")
    @classmethod
    def _validate_delta(cls, value: int):
        if value == 0:
            raise ValueError("0P는 지급/차감할 수 없습니다.")
        return value


class ReviewItemIn(BaseModel):
    reviewee_nickname: str
    rating: int = Field(..., ge=1, le=6)


class ReviewCreateRequest(BaseModel):
    match_id: str  # 비즈니스 ID ("m1" 등)
    comment: str = ""
    reviews: List[ReviewItemIn]


class ReviewItem(BaseModel):
    id: int
    match_id: str  # 응답도 비즈니스 ID 로
    reviewee_nickname: str
    rating: int
    comment: str

    class Config:
        from_attributes = True


class PointHistoryItem(BaseModel):
    id: str
    type: str
    amount: int
    description: str
    # ORM 컬럼은 created_at 인데 응답 키는 'date' 로 노출 (프론트 친화).
    # Pydantic v2 의 validation_alias 는 입력 전용 alias — 출력은 필드명 그대로.
    date: datetime = Field(..., validation_alias="created_at")

    @field_validator("id", mode="before")
    @classmethod
    def _coerce_id(cls, v):
        return str(v)

    class Config:
        from_attributes = True
        populate_by_name = True

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[EmailStr] = None

class PaymentVerifyRequest(BaseModel):
    payment_id: str
    amount: int

class GameBase(BaseModel):
    id: str
    name: str
    players: str
    difficulty: str
    genre: Optional[str] = None
    description: str
    ruleUrl: str
    image: str

    class Config:
        from_attributes = True


class SuggestionCreate(BaseModel):
    category: Literal["게임 추가", "기능 개선", "불편 신고", "기타"]
    content: str = Field(..., min_length=5, max_length=1000)

    @field_validator("category", "content")
    @classmethod
    def _strip_suggestion_text(cls, value: str):
        value = value.strip()
        if not value:
            raise ValueError("빈 내용은 입력할 수 없습니다.")
        return value


class SuggestionReplyRequest(BaseModel):
    admin_reply: str = Field(..., min_length=1, max_length=1000)

    @field_validator("admin_reply")
    @classmethod
    def _strip_reply_text(cls, value: str):
        value = value.strip()
        if not value:
            raise ValueError("답변 내용을 입력해주세요.")
        return value


class SuggestionResponse(BaseModel):
    id: int
    user_id: int
    category: str
    content: str
    created_at: datetime
    user_nickname: Optional[str] = None
    admin_reply: Optional[str] = None
    answered_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserReportCreate(BaseModel):
    reported_user_id: int = Field(..., gt=0)
    # 신고는 반드시 동일한 매칭의 참여자 사이에서만 접수한다.
    match_id: str = Field(..., min_length=1, max_length=100)
    category: Literal["노쇼", "부적절한 언행", "괴롭힘", "사기·금전 요구", "기타"]
    content: str = Field(..., min_length=5, max_length=1000)

    @field_validator("content")
    @classmethod
    def _strip_report_content(cls, value: str):
        value = value.strip()
        if not value:
            raise ValueError("신고 내용을 입력해주세요.")
        return value


class UserReportStatusUpdate(BaseModel):
    status: Literal["received", "reviewing", "resolved"]
    admin_note: str = Field("", max_length=1000)

    @field_validator("admin_note")
    @classmethod
    def _strip_admin_note(cls, value: str):
        return value.strip()


class UserReportResponse(BaseModel):
    id: int
    reporter_id: int
    reporter_nickname: str
    reported_user_id: int
    reported_user_nickname: str
    match_id: Optional[str] = None
    category: str
    content: str
    status: str
    admin_note: Optional[str] = None
    handled_by_nickname: Optional[str] = None
    handled_at: Optional[datetime] = None
    created_at: datetime


class AdminUserDetailResponse(BaseModel):
    user: UserResponse
    point_history: List[PointHistoryItem] = []
    matches: List[dict] = []
    suggestions: List[SuggestionResponse] = []
