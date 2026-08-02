import os
from fastapi import FastAPI, HTTPException, Depends, status, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from typing import List, Dict
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt

import models, schemas, crud
from database import get_db
from auth_utils import verify_password, create_access_token, SECRET_KEY, ALGORITHM

# 스키마는 Alembic 으로 관리합니다 (alembic upgrade head). create_all 제거.

app = FastAPI(title="BoardWay API")

# 개발 기본값: Expo Web(8081), Vite(5173), Expo dev(19006), 휴대폰 LAN IP에서의 접근까지 허용
DEFAULT_DEV_ORIGINS = ",".join([
    "http://localhost:8081",
    "http://localhost:5173",
    "http://localhost:19006",
    "http://127.0.0.1:8081",
    "http://127.0.0.1:5173",
    "https://board-way.vercel.app",
])
_origins_env = os.getenv("CORS_ORIGINS", DEFAULT_DEV_ORIGINS)
ALLOWED_ORIGINS = [o.strip() for o in _origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 이미지 디렉토리 경로 절대 경로로 설정
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
IMAGES_DIR = os.path.join(BASE_DIR, "images")
if not os.path.exists(IMAGES_DIR):
    os.makedirs(IMAGES_DIR)

app.mount("/images", StaticFiles(directory=IMAGES_DIR), name="images")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")
optional_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login", auto_error=False)

# 현재 로그인한 사용자 가져오기 dependency
async def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = schemas.TokenData(email=email)
    except JWTError:
        raise credentials_exception
    user = crud.get_user_by_email(db, email=token_data.email)
    if user is None:
        raise credentials_exception
    return user

from fastapi.responses import JSONResponse
from fastapi import Request

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    error_details = traceback.format_exc()
    print(error_details)
    return JSONResponse(
        status_code=500,
        content={"message": "Internal Server Error", "detail": str(exc), "traceback": error_details},
    )

def format_match(m, db: Session = None, friend_nicknames: set = None, include_chat_summary: bool = False):
    try:
        rule_video_urls = m.ruleVideoUrls
        if db and (not rule_video_urls or all(not url for url in rule_video_urls)):
            if m.games:
                def normalize(name):
                    if not name:
                        return ""
                    return "".join(c for c in name if c.isalnum()).lower()
                all_games = db.query(models.Game).all()
                db_game_map = {normalize(g.name): g.ruleUrl for g in all_games}
                rule_video_urls = [db_game_map.get(normalize(game_name), "") for game_name in m.games]
            else:
                rule_video_urls = []

        min_players = 3
        if db:
            min_players = crud.calculate_min_players_for_match(db, m.games)

        friend_nicknames = friend_nicknames or set()
        friend_participants = []
        participant_users = {}
        if db and m.participants:
            participant_nicknames = [p.nickname for p in m.participants if p.nickname]
            users = db.query(models.User).filter(models.User.nickname.in_(participant_nicknames)).all()
            participant_users = {u.nickname: u for u in users}
        try:
            match_start = datetime.fromisoformat(f"{m.date}T{m.startTime}:00")
            if match_start > datetime.now():
                friend_participants = [
                    p.nickname for p in m.participants
                    if p.nickname in friend_nicknames
                ]
        except (TypeError, ValueError):
            friend_participants = []

        result = {
            "id": m.match_id,
            "games": m.games,
            "difficulty": m.difficulty,
            "tags": m.tags,
            "date": m.date,
            "startTime": m.startTime,
            "ruleVideoUrls": rule_video_urls,
            "location": {
                "venue": m.venue,
                "branch": m.branch,
                "address": m.address
            },
            "maxPlayers": m.maxPlayers,
            "minPlayers": min_players,
            "host": m.host_nickname,
            "cancelled": m.cancelled,
            "is_flexible": m.is_flexible,
            "completed": getattr(m, "completed", False),
            "completed_at": f"{m.completed_at.isoformat()}Z" if getattr(m, "completed_at", None) else None,
            "completed_by_host": getattr(m, "completed_by_host", False),
            "friend_participants": friend_participants,
            "participants": [
                {
                    "user_id": participant_users[p.nickname].id if p.nickname in participant_users else None,
                    "nickname": p.nickname,
                    "mannerScore": p.mannerScore,
                    # Railway에서는 신청 시각을 UTC 기준으로 저장한다. 시간대 정보 없이
                    # 전달하면 브라우저가 로컬 시간으로 잘못 해석하므로 UTC임을 명시한다.
                    "joined_at": f"{p.joined_at.isoformat()}Z" if getattr(p, "joined_at", None) else None,
                    "isMe": False,
                }
                for p in m.participants
            ]
        }

        # 채팅 미리보기는 매치 참가자에게만 제공한다. 공개 매칭 목록에서
        # 메시지 내용이나 대화 시각이 노출되지 않도록 전용 채팅 목록 API에서만 사용한다.
        if include_chat_summary and db:
            latest_message = (
                db.query(models.Message)
                .filter(models.Message.match_id == m.id)
                .order_by(models.Message.created_at.desc(), models.Message.id.desc())
                .first()
            )
            joined_times = [p.joined_at for p in m.participants if getattr(p, "joined_at", None)]
            chat_created_at = min(joined_times) if joined_times else None
            activity_at = latest_message.created_at if latest_message else chat_created_at
            result.update({
                "chat_created_at": chat_created_at.isoformat() if chat_created_at else None,
                "last_message_at": activity_at.isoformat() if activity_at else None,
                "last_message": (
                    {
                        "content": latest_message.content,
                        "sender_nickname": latest_message.sender_nickname,
                        "created_at": latest_message.created_at.isoformat() if latest_message.created_at else None,
                    }
                    if latest_message else None
                ),
            })

        return result
    except Exception as e:
        print(f"Error formatting match {getattr(m, 'match_id', m.id)}: {e}")
        return None

def public_url(request: Request, path_or_url: str):
    if not path_or_url:
        return path_or_url
    if path_or_url.startswith(("http://", "https://")):
        return path_or_url
    base = str(request.base_url).rstrip("/")
    # Railway 등 리버스 프록시 뒤에서는 X-Forwarded-Proto가 실제 외부 프로토콜(https)을 알려줌
    proto = request.headers.get("x-forwarded-proto")
    if proto:
        base = proto + base[base.index("://"):]
    return base + "/" + path_or_url.lstrip("/")

@app.get("/")
def read_root():
    return {"message": "Welcome to BoardWay API Server! (DB Connected)"}

@app.get("/matches")
def get_matches(
    db: Session = Depends(get_db),
    token: str = Depends(optional_oauth2_scheme),
):
    matches = crud.get_matches(db)
    friend_nicknames = set()
    current_user = None
    if token:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            email = payload.get("sub")
            current_user = crud.get_user_by_email(db, email=email) if email else None
        except JWTError:
            current_user = None
    else:
        current_user = None

    if current_user:
        friend_rows = crud.list_friendships(db, current_user.id)
        friend_nicknames = {
            (row.addressee.nickname if row.requester_id == current_user.id else row.requester.nickname)
            for row in friend_rows
            if row.requester and row.addressee
        }
    formatted = [format_match(m, db, friend_nicknames=friend_nicknames) for m in matches]
    return {"matches": [f for f in formatted if f is not None]}

@app.get("/matches/{match_id}")
def get_match(match_id: str, db: Session = Depends(get_db)):
    match = crud.get_match_by_match_id(db, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="매치를 찾을 수 없습니다.")
    return format_match(match, db)

@app.post("/matches")
def create_match(
    match: schemas.MatchCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    try:
        match_date = datetime.strptime(match.date, "%Y-%m-%d").date()
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)")

    today = datetime.now(timezone(timedelta(hours=9))).date()
    max_bookable_date = today + timedelta(days=9)
    if match_date < today or match_date > max_bookable_date:
        raise HTTPException(status_code=400, detail="매칭은 오늘부터 10일 이내 날짜로만 생성할 수 있습니다.")

    new_match = crud.create_match(
        db, match, creator_user_id=current_user.id, host_nickname=current_user.nickname
    )

    # 매치 개설 알림 발송
    games_label = ", ".join(new_match.games or ["자율 선택"])
    crud.create_notification(
        db, current_user.id, "match_created",
        "매칭 개설 완료",
        f"[{games_label}] 매칭 개설 및 {12000:,}P 결제가 완료되었습니다. 방장으로서 참여자들을 기다려주세요!",
        match_business_id=new_match.match_id
    )

    return format_match(new_match, db)


@app.delete("/matches/{match_id}")
def delete_match(
    match_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    db_match = crud.get_match_by_match_id(db, match_id)
    if not db_match:
        raise HTTPException(status_code=404, detail="매치를 찾을 수 없습니다.")
    # 만든 사람만 삭제 가능. 시드 매치 (created_by_user_id IS NULL) 는 아무도 못 지움.
    if db_match.created_by_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="이 매치를 삭제할 권한이 없습니다.")
    db.delete(db_match)
    db.commit()
    return {"message": "삭제 완료"}

@app.post("/matches/{match_id}/join")
def join_match(
    match_id: str,
    payload: schemas.JoinMatchRequest = schemas.JoinMatchRequest(),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    result = crud.join_match(db, match_id, current_user.nickname, payload.role)
    if result == "ALREADY_JOINED":
        raise HTTPException(status_code=400, detail="이미 참여가 완료된 매치입니다.")
    elif result == "CANCELLED":
        raise HTTPException(status_code=400, detail="취소된 매치에는 참여할 수 없습니다.")
    elif result == "COMPLETED":
        raise HTTPException(status_code=400, detail="완료 처리되어 신청 마감된 매치입니다.")
    elif result == "FULL":
        raise HTTPException(status_code=400, detail="매치가 이미 가득 찼습니다.")
    elif result == "HOST_TAKEN":
        raise HTTPException(status_code=400, detail="이미 방장이 정해진 매치입니다.")
    elif result is None:
        raise HTTPException(status_code=404, detail="매치를 찾을 수 없습니다.")

    return {"message": "참여 완료", "host": result.host_nickname}

@app.delete("/matches/{match_id}/leave")
def leave_match(match_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    result = crud.leave_match(db, match_id, current_user.nickname)
    if result == "MATCH_NOT_FOUND":
        raise HTTPException(status_code=404, detail="매치를 찾을 수 없습니다.")
    if result == "NOT_PARTICIPATING":
        raise HTTPException(status_code=400, detail="참여 중인 매치가 아닙니다.")
    if result == "ALREADY_STARTED":
        raise HTTPException(status_code=400, detail="이미 시작된 매치는 취소할 수 없습니다.")
    if result == "CANCELLED":
        raise HTTPException(status_code=400, detail="이미 취소된 매치입니다.")
    return {"message": "참여 취소 완료", "refunded": result["refunded"]}

@app.get("/my-matches")
def get_my_matches(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    matches = crud.get_user_matches(db, current_user.nickname)
    return {"matches": [format_match(m, db) for m in matches]}


@app.get("/my-match-chat-rooms")
def get_my_match_chat_rooms(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """현재 사용자가 참가한 매치 채팅방과 최근 대화 정보를 반환한다."""
    matches = crud.get_user_matches(db, current_user.nickname)
    rooms = [format_match(m, db, include_chat_summary=True) for m in matches]
    return {"matches": [room for room in rooms if room is not None]}

@app.get("/games")
def get_games(request: Request, db: Session = Depends(get_db)):
    games = crud.get_games(db)
    result = []
    for g in games:
        result.append({
            "id": g.game_id,
            "name": g.name,
            "players": g.players,
            "difficulty": g.difficulty,
            "genre": g.genre,
            "description": g.description,
            "ruleUrl": g.ruleUrl,
            "image": public_url(request, g.image)
        })
    return {"games": result}

@app.post("/signup")
def signup(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="이미 가입된 이메일입니다.")
    
    db_nickname = crud.get_user_by_nickname(db, nickname=user.nickname)
    if db_nickname:
        raise HTTPException(status_code=400, detail="이미 사용중인 닉네임입니다.")
        
    created_user = crud.create_user(db=db, user=user)
    return {"message": "회원가입 성공", "user": {"email": created_user.email, "nickname": created_user.nickname, "mannerScore": created_user.mannerScore}}

@app.post("/login")
def login(request: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = crud.get_user_by_email(db, request.email)
    if not user or not verify_password(request.password, user.password):
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 틀렸습니다.")
    
    access_token = create_access_token(data={"sub": user.email})
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "nickname": user.nickname,
            "mannerScore": user.mannerScore,
            "points": user.points,
            "is_admin": user.is_admin,
            "bio": user.bio or "",
            "preferred_genres": user.preferred_genres or [],
            "preferred_locations": user.preferred_locations or [],
        }
    }

@app.get("/me", response_model=schemas.UserResponse)
def read_users_me(current_user: models.User = Depends(get_current_user)):
    return current_user


def _share_visible_match(db: Session, nickname_a: str, nickname_b: str) -> bool:
    if not nickname_a or not nickname_b:
        return False
    candidate_matches = (
        db.query(models.Match)
        .join(models.MatchParticipant)
        .filter(
            models.Match.cancelled == False,
            models.MatchParticipant.nickname.in_([nickname_a, nickname_b]),
        )
        .all()
    )
    for match in candidate_matches:
        participant_nicknames = {p.nickname for p in match.participants}
        if nickname_a in participant_nicknames and nickname_b in participant_nicknames:
            return True
    return False


def _format_user_report(report: models.UserReport, include_admin_details: bool = True):
    result = {
        "id": report.id,
        "reporter_id": report.reporter_id,
        "reporter_nickname": report.reporter.nickname if report.reporter else "알 수 없음",
        "reported_user_id": report.reported_user_id,
        "reported_user_nickname": report.reported_user.nickname if report.reported_user else "알 수 없음",
        "match_id": report.match.match_id if report.match else None,
        "category": report.category,
        "content": report.content,
        "status": report.status,
        "created_at": report.created_at.isoformat() if report.created_at else None,
    }
    if include_admin_details:
        result.update({
            "admin_note": report.admin_note,
            "handled_by_nickname": report.handled_by.nickname if report.handled_by else None,
            "handled_at": report.handled_at.isoformat() if report.handled_at else None,
        })
    return result


@app.get("/users/{user_id}/profile", response_model=schemas.PublicUserProfile)
def read_public_user_profile(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    target_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    is_me = target_user.id == current_user.id
    is_friend = crud.are_friends(db, current_user.id, target_user.id)
    is_matchmate = _share_visible_match(db, current_user.nickname, target_user.nickname)
    if not (is_me or is_friend or is_matchmate):
        raise HTTPException(status_code=403, detail="프로필을 볼 수 있는 권한이 없습니다.")

    relation = "me" if is_me else "friend" if is_friend else "matchmate"
    return {
        "id": target_user.id,
        "nickname": target_user.nickname,
        "mannerScore": target_user.mannerScore,
        "bio": target_user.bio or "",
        "preferred_genres": target_user.preferred_genres or [],
        "preferred_locations": target_user.preferred_locations or [],
        "relation": relation,
    }


@app.put("/me/profile", response_model=schemas.UserResponse)
def update_my_profile(
    payload: schemas.UserProfileUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    current_user.bio = payload.bio.strip()
    current_user.preferred_genres = payload.preferred_genres
    current_user.preferred_locations = payload.preferred_locations
    db.commit()
    db.refresh(current_user)
    return current_user


@app.post("/reports", response_model=schemas.UserReportResponse)
def create_user_report(
    payload: schemas.UserReportCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """성공적으로 완료된 같은 매칭의 참여자를 신고한다."""
    target_user = db.query(models.User).filter(models.User.id == payload.reported_user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="신고 대상을 찾을 수 없습니다.")
    if target_user.id == current_user.id:
        raise HTTPException(status_code=400, detail="자기 자신은 신고할 수 없습니다.")

    match = crud.get_match_by_match_id(db, payload.match_id)
    if not match:
        raise HTTPException(status_code=404, detail="관련 매칭을 찾을 수 없습니다.")
    if match.cancelled or not match.completed:
        raise HTTPException(status_code=400, detail="신고는 매칭이 성공적으로 완료된 후에만 접수할 수 있습니다.")
    participant_names = {participant.nickname for participant in match.participants}
    if current_user.nickname not in participant_names or target_user.nickname not in participant_names:
        raise HTTPException(status_code=403, detail="신고는 같은 매칭에 참여한 사용자에게만 할 수 있습니다.")
    has_submitted_review = (
        db.query(models.Review.id)
        .filter(
            models.Review.match_id == match.id,
            models.Review.reviewer_id == current_user.id,
        )
        .first()
    )
    if not has_submitted_review:
        raise HTTPException(status_code=403, detail="신고는 해당 매칭의 상호 매너 평가를 제출한 후에 할 수 있습니다.")

    report = crud.create_user_report(
        db,
        payload,
        reporter_id=current_user.id,
        reported_user_id=target_user.id,
        match_db_id=match.id,
    )
    if report == "DUPLICATE":
        raise HTTPException(status_code=400, detail="같은 대상에 대한 미처리 신고가 이미 접수되어 있습니다.")
    return _format_user_report(report)


@app.get("/reports", response_model=List[schemas.UserReportResponse])
def get_user_reports(
    status_filter: str | None = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if status_filter and status_filter not in {"received", "reviewing", "resolved"}:
        raise HTTPException(status_code=400, detail="올바르지 않은 신고 상태입니다.")
    reports = (
        crud.get_all_user_reports(db, status_filter)
        if current_user.is_admin
        else crud.get_user_reports(db, current_user.id)
    )
    return [
        _format_user_report(report, include_admin_details=current_user.is_admin)
        for report in reports
    ]


@app.patch("/reports/{report_id}/status", response_model=schemas.UserReportResponse)
def update_user_report_status(
    report_id: int,
    payload: schemas.UserReportStatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="운영진만 신고를 처리할 수 있습니다.")

    report = crud.update_user_report_status(
        db,
        report_id,
        payload.status,
        payload.admin_note,
        current_user.id,
    )
    if not report:
        raise HTTPException(status_code=404, detail="신고 내역을 찾을 수 없습니다.")

    status_labels = {
        "received": "접수됨",
        "reviewing": "검토 중",
        "resolved": "처리 완료",
    }
    crud.create_notification(
        db,
        report.reporter_id,
        "report_status_updated",
        "신고 처리 상태 안내",
        f"접수하신 신고가 ‘{status_labels[payload.status]}’ 상태로 변경되었습니다.",
    )
    return _format_user_report(report)


@app.get("/admin/users", response_model=List[schemas.UserResponse])
def admin_list_users(
    q: str = "",
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="관리자만 회원을 조회할 수 있습니다.")

    query = db.query(models.User)
    keyword = q.strip()
    if keyword:
        like_keyword = f"%{keyword}%"
        query = query.filter(
            (models.User.email.ilike(like_keyword))
            | (models.User.nickname.ilike(like_keyword))
        )

    return query.order_by(models.User.id.desc()).limit(100).all()


@app.get("/admin/users/{user_id}/detail", response_model=schemas.AdminUserDetailResponse)
def admin_get_user_detail(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="관리자만 회원 상세 정보를 조회할 수 있습니다.")

    target_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="대상 사용자를 찾을 수 없습니다.")

    point_history = crud.get_user_point_history(db, target_user.id)
    matches = crud.get_user_matches(db, target_user.nickname)
    suggestions = crud.get_suggestions_by_user(db, target_user.id)

    suggestion_items = []
    for sug in suggestions:
        suggestion_items.append(
            {
                "id": sug.id,
                "user_id": sug.user_id,
                "user_nickname": target_user.nickname,
                "category": sug.category,
                "content": sug.content,
                "admin_reply": sug.admin_reply,
                "answered_at": sug.answered_at,
                "created_at": sug.created_at,
            }
        )

    return {
        "user": target_user,
        "point_history": point_history[:20],
        "matches": [format_match(m, db) for m in matches[:20]],
        "suggestions": suggestion_items[:20],
    }

@app.post("/me/points/adjust", response_model=schemas.UserResponse)
def adjust_my_points(
    payload: schemas.PointsAdjustRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    updated = crud.add_user_points(
        db, current_user.nickname, payload.delta, payload.description
    )
    if updated is False:
        raise HTTPException(status_code=400, detail="포인트 잔액이 부족합니다.")
    if updated is None:
        raise HTTPException(status_code=404, detail="User not found")

    # 일반적인 포인트 충전/사용 시에만 알림 발송 (매칭 결제/참여취소 환불 등은 별도 알림 존재하므로 제외)
    desc = payload.description or ""
    if "참여" not in desc and "환불" not in desc and "취소" not in desc:
        type_ = "point_recharged" if payload.delta > 0 else "point_used"
        title = "포인트 충전 완료" if payload.delta > 0 else "포인트 사용 완료"
        crud.create_notification(
            db, current_user.id, type_,
            title,
            f"{abs(payload.delta):,}P 가 {desc} 처리되었습니다. (현재 보유 포인트: {updated.points:,}P)",
            match_business_id=None
        )

    return updated


@app.get(
    "/me/points/history",
    response_model=List[schemas.PointHistoryItem],
)
def read_my_point_history(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return crud.get_user_point_history(db, current_user.id)


@app.post("/admin/users/points/adjust", response_model=schemas.UserResponse)
def admin_adjust_user_points(
    payload: schemas.AdminPointsAdjustRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="관리자만 포인트를 지급/차감할 수 있습니다.")

    identifier = payload.user_identifier.strip()
    target_user = (
        crud.get_user_by_email(db, identifier)
        if "@" in identifier
        else crud.get_user_by_nickname(db, identifier)
    )
    if not target_user:
        raise HTTPException(status_code=404, detail="대상 사용자를 찾을 수 없습니다.")

    description = payload.description.strip() or (
        "관리자 포인트 지급" if payload.delta > 0 else "관리자 포인트 차감"
    )
    updated = crud.add_user_points(
        db,
        target_user.nickname,
        payload.delta,
        description,
    )
    if updated is False:
        raise HTTPException(status_code=400, detail="대상 사용자의 포인트 잔액이 부족합니다.")
    if updated is None:
        raise HTTPException(status_code=404, detail="대상 사용자를 찾을 수 없습니다.")

    type_ = "admin_point_granted" if payload.delta > 0 else "admin_point_deducted"
    title = "관리자 포인트 지급" if payload.delta > 0 else "관리자 포인트 차감"
    crud.create_notification(
        db,
        updated.id,
        type_,
        title,
        f"{abs(payload.delta):,}P가 {description} 처리되었습니다. (현재 보유 포인트: {updated.points:,}P)",
        match_business_id=None,
    )
    return updated


def _friend_item(row: models.Friendship, current_user_id: int):
    friend = row.addressee if row.requester_id == current_user_id else row.requester
    return {
        "friendship_id": row.id,
        "user_id": friend.id,
        "nickname": friend.nickname,
        "mannerScore": friend.mannerScore,
        "status": row.status,
    }


def _friend_request_item(row: models.Friendship):
    return {
        "id": row.id,
        "requester_id": row.requester_id,
        "requester_nickname": row.requester.nickname if row.requester else "",
        "addressee_id": row.addressee_id,
        "addressee_nickname": row.addressee.nickname if row.addressee else "",
        "status": row.status,
        "created_at": row.created_at,
    }


def _friend_message_item(row: models.FriendMessage):
    return {
        "id": row.id,
        "sender_id": row.sender_id,
        "sender_nickname": row.sender.nickname if row.sender else "",
        "recipient_id": row.recipient_id,
        "recipient_nickname": row.recipient.nickname if row.recipient else "",
        "content": row.content,
        "read": row.read,
        "created_at": row.created_at,
    }


@app.post("/friends/requests")
def send_friend_request(
    payload: schemas.FriendRequestCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    result = crud.create_friend_request(db, current_user, payload.nickname)
    if result == "USER_NOT_FOUND":
        raise HTTPException(status_code=404, detail="해당 닉네임의 사용자를 찾을 수 없습니다.")
    if result == "SELF":
        raise HTTPException(status_code=400, detail="자기 자신에게는 친구 신청을 보낼 수 없습니다.")
    if result == "ALREADY_FRIENDS":
        raise HTTPException(status_code=400, detail="이미 친구로 등록된 사용자입니다.")
    if result == "ALREADY_PENDING":
        raise HTTPException(status_code=400, detail="이미 대기 중인 친구 신청이 있습니다.")
    return _friend_request_item(result)


@app.get("/friends")
def list_my_friends(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    rows = crud.list_friendships(db, current_user.id)
    return {"friends": [_friend_item(row, current_user.id) for row in rows]}


@app.get("/friends/requests")
def list_my_friend_requests(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    incoming, outgoing = crud.list_friend_requests(db, current_user.id)
    return {
        "incoming": [_friend_request_item(row) for row in incoming],
        "outgoing": [_friend_request_item(row) for row in outgoing],
    }


@app.post("/friends/requests/{request_id}/accept")
def accept_friend_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    result = crud.respond_friend_request(db, request_id, current_user, True)
    if result == "NOT_FOUND":
        raise HTTPException(status_code=404, detail="친구 신청을 찾을 수 없습니다.")
    if result == "FORBIDDEN":
        raise HTTPException(status_code=403, detail="내게 온 친구 신청만 처리할 수 있습니다.")
    if result == "ALREADY_HANDLED":
        raise HTTPException(status_code=400, detail="이미 처리된 친구 신청입니다.")
    return _friend_item(result, current_user.id)


@app.post("/friends/requests/{request_id}/reject")
def reject_friend_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    result = crud.respond_friend_request(db, request_id, current_user, False)
    if result == "NOT_FOUND":
        raise HTTPException(status_code=404, detail="친구 신청을 찾을 수 없습니다.")
    if result == "FORBIDDEN":
        raise HTTPException(status_code=403, detail="내게 온 친구 신청만 처리할 수 있습니다.")
    if result == "ALREADY_HANDLED":
        raise HTTPException(status_code=400, detail="이미 처리된 친구 신청입니다.")
    return {"status": "rejected"}


@app.delete("/friends/{friend_id}")
def delete_friend(
    friend_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    result = crud.remove_friend(db, current_user.id, friend_id)
    if result == "NOT_FOUND":
        raise HTTPException(status_code=404, detail="친구 관계를 찾을 수 없습니다.")
    return {"status": "removed"}


@app.get("/friends/{friend_id}/messages")
def list_friend_messages(
    friend_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    result = crud.list_friend_messages(db, current_user.id, friend_id)
    if result == "NOT_FRIENDS":
        raise HTTPException(status_code=403, detail="친구로 등록된 사용자와만 채팅할 수 있습니다.")
    return {"messages": [_friend_message_item(row) for row in result]}


@app.post("/friends/{friend_id}/messages")
def create_friend_message(
    friend_id: int,
    payload: schemas.MessageCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    content = (payload.content or "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="메시지 내용을 입력해주세요.")
    result = crud.create_friend_message(db, current_user, friend_id, content)
    if result == "USER_NOT_FOUND":
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    if result == "NOT_FRIENDS":
        raise HTTPException(status_code=403, detail="친구로 등록된 사용자와만 채팅할 수 있습니다.")
    return _friend_message_item(result)


@app.get("/friends/{friend_id}/matches")
def list_friend_matches(
    friend_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    result = crud.get_friend_matches(db, current_user.id, friend_id)
    if result == "USER_NOT_FOUND":
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    if result == "NOT_FRIENDS":
        raise HTTPException(status_code=403, detail="친구로 등록된 사용자의 매칭만 확인할 수 있습니다.")
    return {"matches": [format_match(m, db) for m in result]}


@app.post("/me/reviews", response_model=List[schemas.ReviewItem])
def submit_match_reviews(
    payload: schemas.ReviewCreateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    match = crud.get_match_by_match_id(db, payload.match_id)
    if not match:
        raise HTTPException(status_code=404, detail="매치를 찾을 수 없습니다.")
    if not getattr(match, "completed", False) or not match.completed_at:
        raise HTTPException(status_code=400, detail="방장이 매칭 완료를 확인한 뒤 평가할 수 있습니다.")
    if datetime.now(timezone.utc).replace(tzinfo=None) > match.completed_at + timedelta(minutes=30):
        raise HTTPException(status_code=400, detail="매너 평가 가능 시간(완료 후 30분)이 지났습니다.")

    participant_names = {p.nickname for p in match.participants}
    if current_user.nickname not in participant_names:
        raise HTTPException(status_code=403, detail="이 매치에 참여한 사용자만 평가할 수 있습니다.")

    reviewee_names = [item.reviewee_nickname for item in payload.reviews]
    allowed_reviewees = participant_names - {current_user.nickname}
    if not reviewee_names:
        raise HTTPException(status_code=400, detail="평가할 참여자가 없습니다.")
    if len(reviewee_names) != len(set(reviewee_names)):
        raise HTTPException(status_code=400, detail="같은 참여자를 중복 평가할 수 없습니다.")
    if not set(reviewee_names).issubset(allowed_reviewees):
        raise HTTPException(status_code=400, detail="본인 또는 매치에 참여하지 않은 사용자는 평가할 수 없습니다.")

    try:
        result = crud.create_match_reviews(
            db, current_user.id, payload.match_id, payload.reviews, payload.comment
        )
    except Exception as exc:
        # 배포 DB 스키마 불일치 등 저장 예외가 발생해도 CORS 헤더가 포함된
        # JSON 응답을 반환해야 브라우저가 단순 "Failed to fetch"로 숨기지 않는다.
        db.rollback()
        print(f"Review submission failed for match {payload.match_id}: {exc}")
        raise HTTPException(
            status_code=500,
            detail="리뷰 저장 중 서버 오류가 발생했습니다. 운영진에게 문의해주세요.",
        )
    if result is None:
        raise HTTPException(status_code=404, detail="매치를 찾을 수 없습니다.")
    if result == "ALREADY_REVIEWED":
        raise HTTPException(status_code=400, detail="이미 리뷰를 남긴 매치입니다.")
    return [
        schemas.ReviewItem(
            id=r.id,
            match_id=payload.match_id,
            reviewee_nickname=r.reviewee_nickname,
            rating=r.rating,
            comment=r.comment,
        )
        for r in result
    ]


@app.get("/me/reviewed-matches", response_model=List[str])
def my_reviewed_match_ids(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return crud.get_reviewer_match_business_ids(db, current_user.id)


@app.post("/payments/verify", response_model=schemas.UserResponse)
def verify_payment(
    req: schemas.PaymentVerifyRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    from sqlalchemy.exc import IntegrityError
    import requests as http_requests

    # 1. PortOne API로 결제 정보 조회
    secret = os.getenv("PORTONE_SECRET", "")
    resp = http_requests.get(
        f"https://api.portone.io/payments/{req.payment_id}",
        headers={"Authorization": f"PortOne {secret}"},
        timeout=10,
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=400, detail=f"결제 조회 실패 ({resp.status_code})")
    payment = resp.json()

    # 2. 결제 상태 검증
    if payment.get("status") != "PAID":
        raise HTTPException(status_code=400, detail=f"결제 미완료 (status={payment.get('status')})")

    # 3. 금액 검증
    paid_amount = payment.get("amount", {}).get("total", 0)
    if paid_amount != req.amount:
        raise HTTPException(status_code=400, detail="결제 금액 불일치")

    # 4. 소유자 검증 — PortOne이 반환한 customerId 우선, paymentId 형식은 보조
    customer_id = str((payment.get("customer") or {}).get("customerId") or "")
    if customer_id:
        # PortOne이 customerId를 저장한 경우: 서버 측 증거로 검증
        if customer_id != str(current_user.id):
            raise HTTPException(status_code=403, detail="결제 소유자 불일치")
    else:
        # customerId 없는 경우(테스트 채널 등): paymentId 형식으로 보조 검증
        try:
            pid_user_id = req.payment_id.split("-")[1]
        except (IndexError, AttributeError):
            raise HTTPException(status_code=400, detail="잘못된 결제 ID 형식")
        if pid_user_id != str(current_user.id):
            raise HTTPException(status_code=403, detail="결제 소유자 불일치")

    # 5. 재사용(replay) 방지 — payment_id UNIQUE 제약으로 원자적 삽입
    # ConsumedPayment를 세션에 추가하면 add_user_points의 db.commit() 시 함께 원자적으로 INSERT됨.
    # duplicate payment_id면 IntegrityError가 commit 시점에 발생 → 포인트 적립도 같이 롤백.
    try:
        db.add(models.ConsumedPayment(
            payment_id=req.payment_id,
            user_id=current_user.id,
            amount=req.amount,
        ))
        return crud.add_user_points(db, current_user.nickname, req.amount, f"포인트 충전 ({req.amount:,}원)")
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="이미 처리된 결제입니다.")


@app.post("/matches/{match_id}/cancel", response_model=schemas.CancelResponse)
def cancel_match_endpoint(
    match_id: str,
    as_admin: bool = False,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    match = crud.get_match_by_match_id(db, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="매치를 찾을 수 없습니다.")
    if match.cancelled:
        raise HTTPException(status_code=400, detail="이미 취소된 매치입니다.")
    if getattr(match, "completed", False):
        raise HTTPException(status_code=400, detail="완료된 매치는 취소할 수 없습니다.")

    is_host = (match.host_nickname == current_user.nickname)
    if not current_user.is_admin and not is_host:
        raise HTTPException(status_code=403, detail="매치 취소는 운영진 또는 개설자(방장)만 가능합니다.")

    host_forfeits = is_host and not (current_user.is_admin and as_admin)
    result = crud.cancel_match(db, match_id, host_forfeits=host_forfeits)
    
    if host_forfeits:
        msg = f"매치가 취소되었습니다. 동료 참여자 {result['refunded_count']}명에게 환불이 완료되었습니다. 방장 개설 참여비는 환불되지 않습니다."
    else:
        msg = f"매치가 취소되었습니다. 참여자 {result['refunded_count']}명에게 {result['refund_amount']:,}P씩 환불 완료."

    return schemas.CancelResponse(
        cancelled=True,
        refunded_count=result["refunded_count"],
        refund_amount=result["refund_amount"],
        message=msg,
    )


@app.get("/me/notifications", response_model=List[schemas.NotificationItem])
def list_my_notifications(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return crud.list_user_notifications(db, current_user.id)


@app.post("/me/notifications/{notif_id}/read", response_model=schemas.NotificationItem)
def mark_notification_read_endpoint(
    notif_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    result = crud.mark_notification_read(db, current_user.id, notif_id)
    if result == "NOT_FOUND":
        raise HTTPException(status_code=404, detail="알림을 찾을 수 없습니다.")
    return result


@app.post("/me/notifications/read-all")
def mark_all_notifications_read_endpoint(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    count = crud.mark_all_notifications_read(db, current_user.id)
    return {"updated": count}


@app.get("/matches/{match_id}/messages", response_model=List[schemas.MessageItem])
def list_match_messages_endpoint(
    match_id: str,
    after_id: int = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    result = crud.list_match_messages(db, match_id, current_user.nickname, after_id)
    if result == "NOT_FOUND":
        raise HTTPException(status_code=404, detail="매치를 찾을 수 없습니다.")
    if result == "FORBIDDEN":
        raise HTTPException(status_code=403, detail="이 매치에 참여한 사용자만 채팅을 볼 수 있습니다.")
    return result


@app.post("/matches/{match_id}/messages", response_model=schemas.MessageItem)
def create_match_message_endpoint(
    match_id: str,
    payload: schemas.MessageCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not payload.content or not payload.content.strip():
        raise HTTPException(status_code=400, detail="메시지 내용이 비어 있습니다.")
    result = crud.create_match_message(db, match_id, current_user, payload.content.strip())
    if result == "NOT_FOUND":
        raise HTTPException(status_code=404, detail="매치를 찾을 수 없습니다.")
    if result == "FORBIDDEN":
        raise HTTPException(status_code=403, detail="이 매치에 참여한 사용자만 채팅을 보낼 수 있습니다.")
    return result


# WebSocket 연결 관리자 — 매치별로 연결된 클라이언트 목록 유지
class ConnectionManager:
    def __init__(self):
        self.rooms: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, match_id: str):
        await websocket.accept()
        self.rooms.setdefault(match_id, []).append(websocket)

    def disconnect(self, websocket: WebSocket, match_id: str):
        if match_id in self.rooms:
            self.rooms[match_id].discard(websocket) if hasattr(self.rooms[match_id], 'discard') else None
            try:
                self.rooms[match_id].remove(websocket)
            except ValueError:
                pass

    async def broadcast(self, match_id: str, data: dict):
        for ws in list(self.rooms.get(match_id, [])):
            try:
                await ws.send_json(data)
            except Exception:
                pass

ws_manager = ConnectionManager()


@app.websocket("/ws/matches/{match_id}/chat")
async def websocket_chat(websocket: WebSocket, match_id: str, db: Session = Depends(get_db)):
    # 토큰은 URL 쿼리 대신 연결 직후 첫 번째 메시지로 수신 (URL 로그 노출 방지)
    await websocket.accept()
    try:
        auth_data = await websocket.receive_json()
        token = auth_data.get("token", "")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if not email:
            await websocket.close(code=4001)
            return
        user = crud.get_user_by_email(db, email)
        if not user:
            await websocket.close(code=4001)
            return
    except (JWTError, Exception):
        await websocket.close(code=4001)
        return

    # 참여자 권한 검증 — 비참여자 연결 차단 (IDOR 방지)
    match = crud.get_match_by_match_id(db, match_id)
    if not match:
        await websocket.close(code=4004)
        return
    from crud import _is_match_participant
    if not _is_match_participant(db, match, user.nickname):
        await websocket.close(code=4003)
        return

    ws_manager.rooms.setdefault(match_id, []).append(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            content = (data.get("content") or "").strip()
            if not content:
                continue
            result = crud.create_match_message(db, match_id, user, content)
            if isinstance(result, str):
                await websocket.send_json({"error": result})
                continue
            msg_dict = {
                "id": result.id,
                "sender_nickname": result.sender_nickname,
                "content": result.content,
                "created_at": result.created_at.isoformat(),
            }
            await ws_manager.broadcast(match_id, msg_dict)
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, match_id)

@app.post("/matches/{match_id}/complete")
def complete_match_endpoint(
    match_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """방장이 매칭 성공 완료 처리. 방장 또는 관리자만 가능."""
    match = crud.get_match_by_match_id(db, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="매치를 찾을 수 없습니다.")
    if match.cancelled:
        raise HTTPException(status_code=400, detail="취소된 매치입니다.")
    if match.completed:
        raise HTTPException(status_code=400, detail="이미 완료 처리된 매치입니다.")

    min_required = crud.calculate_min_players_for_match(db, match.games)
    participants_count = len(match.participants)
    # 운영진은 현장 상황에 따라 최소 인원 미달 매치도 강제 완료 처리할 수 있다.
    # 일반 방장은 최소 인원이 충족된 매치만 완료 처리 가능하다.
    if participants_count < min_required and not current_user.is_admin:
        raise HTTPException(
            status_code=400,
            detail=f"최소 인원({min_required}명)을 충족하지 못한 매치는 완료 처리할 수 없습니다. 현재 참여자 {participants_count}명",
        )

    is_host = (match.host_nickname == current_user.nickname)
    if not current_user.is_admin and not is_host:
        raise HTTPException(status_code=403, detail="방장 또는 운영진만 완료 처리할 수 있습니다.")

    # 운영진은 현장 상황에 따라 최소 인원·정규시간과 무관하게 매칭을 종료·완료 처리할 수 있다.
    # 방장은 기존 정책대로 정규 2시간이 지난 뒤에만 완료 처리가 가능하다.
    if not current_user.is_admin:
        try:
            match_end = datetime.fromisoformat(f"{match.date}T{match.startTime}:00") + timedelta(hours=2)
        except ValueError:
            raise HTTPException(status_code=500, detail="매치 일정 정보가 올바르지 않습니다.")
        korea_now = datetime.now(timezone(timedelta(hours=9))).replace(tzinfo=None)
        if korea_now < match_end:
            raise HTTPException(status_code=400, detail="매칭 종료 시각 이후에 완료 처리할 수 있습니다.")

    completed_by_admin = current_user.is_admin and not is_host
    result = crud.complete_match(
        db,
        match_id,
        completed_by_host=is_host,
        completed_by_admin=completed_by_admin,
    )
    if isinstance(result, str):
        raise HTTPException(status_code=400, detail=result)

    message = (
        "운영진 권한으로 매칭을 완료 처리했습니다. 상호 매너 평가를 진행해주세요!"
        if completed_by_admin
        else "매칭이 성공적으로 완료 처리되었습니다. 상호 매너 평가를 진행해주세요!"
    )
    return {"status": "success", "message": message}


@app.post("/suggestions")
def create_suggestion(
    req: schemas.SuggestionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """사용자 건의사항 제출."""
    sug = crud.create_suggestion(db, req, current_user.id)
    return {
        "id": sug.id,
        "user_id": sug.user_id,
        "user_nickname": current_user.nickname,
        "category": sug.category,
        "content": sug.content,
        "admin_reply": sug.admin_reply,
        "answered_at": sug.answered_at.isoformat() if sug.answered_at else None,
        "created_at": sug.created_at.isoformat() if sug.created_at else None,
    }


@app.get("/suggestions")
def get_suggestions(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """관리자는 전체 건의 조회, 일반 사용자는 본인 건의만 조회."""
    if current_user.is_admin:
        items = crud.get_all_suggestions(db)
    else:
        items = crud.get_suggestions_by_user(db, current_user.id)

    result = []
    for sug in items:
        # user_nickname 조회
        user = db.query(models.User).filter(models.User.id == sug.user_id).first()
        result.append({
            "id": sug.id,
            "user_id": sug.user_id,
            "user_nickname": user.nickname if user else None,
            "category": sug.category,
            "content": sug.content,
            "admin_reply": sug.admin_reply,
            "answered_at": sug.answered_at.isoformat() if sug.answered_at else None,
            "created_at": sug.created_at.isoformat() if sug.created_at else None,
        })
    return {"suggestions": result}


@app.post("/suggestions/{suggestion_id}/reply")
def reply_to_suggestion(
    suggestion_id: int,
    req: schemas.SuggestionReplyRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """관리자가 사용자 건의에 답변."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="운영진만 답변할 수 있습니다.")

    sug = crud.reply_to_suggestion(db, suggestion_id, req.admin_reply)
    if not sug:
        raise HTTPException(status_code=404, detail="건의를 찾을 수 없습니다.")

    user = db.query(models.User).filter(models.User.id == sug.user_id).first()
    if user:
        crud.create_notification(
            db,
            user.id,
            "suggestion_replied",
            "고객센터 답변 도착",
            f"보내주신 [{sug.category}] 의견에 운영진 답변이 등록되었습니다.",
        )

    return {
        "id": sug.id,
        "user_id": sug.user_id,
        "user_nickname": user.nickname if user else None,
        "category": sug.category,
        "content": sug.content,
        "admin_reply": sug.admin_reply,
        "answered_at": sug.answered_at.isoformat() if sug.answered_at else None,
        "created_at": sug.created_at.isoformat() if sug.created_at else None,
    }


def check_and_cancel_matches(db: Session):
    from datetime import datetime, timedelta
    # 매칭 일시(date/startTime)는 한국 시간으로 저장되므로 Railway(UTC)에서도 같은 기준으로 비교한다.
    now = datetime.now(timezone(timedelta(hours=9))).replace(tzinfo=None)
    active_matches = db.query(models.Match).filter(models.Match.cancelled == False).all()
    for match in active_matches:
        try:
            match_datetime_str = f"{match.date}T{match.startTime}:00"
            match_start = datetime.fromisoformat(match_datetime_str)
        except (ValueError, TypeError, AttributeError):
            continue

        min_required = crud.calculate_min_players_for_match(db, match.games)
        participants_count = len(match.participants)

        time_until_start = match_start - now
        if match.completed:
            crud._maybe_reward_host_for_match(db, match)
            continue

        if now < match_start and participants_count >= min_required:
            already_confirmed = (
                db.query(models.Notification)
                .filter(
                    models.Notification.type == "match_confirmed",
                    models.Notification.match_business_id == match.match_id,
                )
                .first()
            )
            if not already_confirmed:
                games_label = ", ".join(match.games or ["자율 선택"])
                for p in list(match.participants):
                    p_user = crud.get_user_by_nickname(db, p.nickname)
                    if p_user:
                        crud.create_notification(
                            db,
                            p_user.id,
                            "match_confirmed",
                            "매칭 확정 알림",
                            f"[{games_label}] 매칭의 최소 인원({min_required}명)이 충족되어 매칭이 확정되었습니다!",
                            match_business_id=match.match_id,
                        )

        if time_until_start <= timedelta(minutes=30) and participants_count < min_required:
            match.cancelled = True
            db.flush()

            games_label = ", ".join(match.games or ["자율 선택"])
            for p in list(match.participants):
                p_user = crud.get_user_by_nickname(db, p.nickname)
                if p_user:
                    crud.add_user_points(
                        db, p.nickname, crud.MATCH_PARTICIPATION_COST,
                        f"[{games_label}] 최소 인원 미달로 인한 매치 자동 취소 환불",
                    )
                    crud.create_notification(
                        db, p_user.id, "match_cancelled",
                        "매칭 자동 취소",
                        f"[{games_label}] 매칭이 시작 30분 전까지 최소 인원({min_required}명)을 충족하지 못해 자동 취소되었습니다. {crud.MATCH_PARTICIPATION_COST:,}P가 환불되었습니다.",
                        match_business_id=match.match_id
                    )
            db.commit()
            continue

        match_end = match_start + timedelta(hours=2)
        if now >= match_end and not match.completed and match.host_nickname:
            # 종료 후 1시간 동안 방장의 완료 확인을 기다린 뒤 평가를 자동 시작한다.
            # 자동 시작 건은 방장 리워드 지급 대상이 아니다.
            if now >= match_end + timedelta(hours=1):
                crud.complete_match(db, match.match_id, completed_by_host=False)
                continue

            host_user = crud.get_user_by_nickname(db, match.host_nickname)
            if host_user:
                already_prompted = (
                    db.query(models.Notification)
                    .filter(
                        models.Notification.user_id == host_user.id,
                        models.Notification.type == "match_completion_prompt",
                        models.Notification.match_business_id == match.match_id,
                    )
                    .first()
                )
                if not already_prompted:
                    games_label = ", ".join(match.games or ["자율 선택"])
                    crud.create_notification(
                        db,
                        host_user.id,
                        "match_completion_prompt",
                        "매칭 완료 확인 필요",
                        f"[{games_label}] 매칭 종료 시간이 지났습니다. 내 매칭에서 '매칭 성공적으로 완료' 버튼을 눌러 참여자 평가를 시작해주세요. 종료 후 1시간 안에 완료 처리하지 않으면 평가는 자동으로 시작되며, 방장 리워드는 지급되지 않습니다.",
                        match_business_id=match.match_id,
                    )

def start_match_cancellation_scheduler():
    import threading
    import time
    from database import SessionLocal

    def run_scheduler():
        time.sleep(5)
        while True:
            try:
                db = SessionLocal()
                try:
                    check_and_cancel_matches(db)
                finally:
                    db.close()
            except Exception as e:
                print(f"Error in match cancellation scheduler: {e}")
            time.sleep(60)

    thread = threading.Thread(target=run_scheduler, daemon=True)
    thread.start()

@app.on_event("startup")
def startup_event():
    start_match_cancellation_scheduler()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
