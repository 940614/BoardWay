from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional

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
    maxPlayers: int = Field(ge=2, le=10)

class MatchCreate(MatchBase):
    pass

class MatchResponse(MatchBase):
    id: str # This is match_id (e.g., "m1")
    participants: List[ParticipantBase] = []

    class Config:
        from_attributes = True

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    nickname: str = Field(min_length=2, max_length=20)

class UserResponse(BaseModel):
    email: str
    nickname: str
    mannerScore: int

    class Config:
        from_attributes = True

class LoginRequest(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

class GameBase(BaseModel):
    id: str
    name: str
    players: str
    difficulty: str
    description: str
    ruleUrl: str
    image: str

    class Config:
        from_attributes = True
