import uuid
import re
from datetime import datetime, timedelta, timezone
from sqlalchemy import func
from sqlalchemy.orm import Session
import models, schemas
from auth_utils import get_password_hash

def parse_player_count(players_str: str):
    """'2-4인', '2인 전용', '5-10인' 등 포맷에서 (min_players, max_players)를 추출"""
    if not players_str:
        return 2, 4
    nums = [int(n) for n in re.findall(r'\d+', players_str)]
    if len(nums) >= 2:
        return nums[0], nums[1]
    elif len(nums) == 1:
        return nums[0], nums[0]
    return 2, 4

def calculate_min_players_for_match(db: Session, games_list: list) -> int:
    """매칭에 포함된 게임들 중 모든 게임이 플레이 가능하기 위한 최소 필요 인원 계산
    각 게임의 최소 인원 중 최댓값(MAX)을 반환. 자율 선택 매치는 기본 3명.
    """
    if not games_list or games_list == ["자율 선택"]:
        return 3
    max_min = 2
    for game_name in games_list:
        game = db.query(models.Game).filter(models.Game.name == game_name).first()
        if game:
            min_p, max_p = parse_player_count(game.players)
            if min_p > max_min:
                max_min = min_p
    return max_min

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def get_user_by_nickname(db: Session, nickname: str):
    return db.query(models.User).filter(models.User.nickname == nickname).first()

def create_user(db: Session, user: schemas.UserCreate):
    db_user = models.User(
        email=user.email,
        password=get_password_hash(user.password),
        nickname=user.nickname,
        mannerScore=user.mannerScore
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def get_games(db: Session):
    return db.query(models.Game).all()

def get_matches(db: Session):
    return db.query(models.Match).all()

def get_match_by_match_id(db: Session, match_id: str):
    return db.query(models.Match).filter(models.Match.match_id == match_id).first()

def create_match(db: Session, match: schemas.MatchCreate, creator_user_id: int = None, host_nickname: str = None):
    new_match_id = f"m-{str(uuid.uuid4())[:8]}"
    db_match = models.Match(
        match_id=new_match_id,
        games=match.games,
        difficulty=match.difficulty,
        tags=match.tags,
        date=match.date,
        startTime=match.startTime,
        ruleVideoUrls=match.ruleVideoUrls,
        venue=match.location.venue,
        branch=match.location.branch,
        address=match.location.address,
        maxPlayers=match.maxPlayers,
        created_by_user_id=creator_user_id,
        host_nickname=host_nickname,
        is_flexible=match.is_flexible,
    )
    db.add(db_match)
    db.flush()

    if host_nickname:
        user = get_user_by_nickname(db, host_nickname)
        p = models.MatchParticipant(
            match_id=db_match.id,
            nickname=host_nickname,
            mannerScore=user.mannerScore if user else 5
        )
        db.add(p)

    db.commit()
    db.refresh(db_match)
    return db_match

def join_match(db: Session, match_id: str, participant_nickname: str, role: str = "participant"):
    db_match = get_match_by_match_id(db, match_id)
    if not db_match:
        return None

    # 중복 참여 검사
    for p in db_match.participants:
        if p.nickname == participant_nickname:
            return "ALREADY_JOINED"

    if len(db_match.participants) >= db_match.maxPlayers:
        return "FULL"

    # 호스트 신청은 빈자리(host_nickname IS NULL)일 때만
    if role == "host" and db_match.host_nickname:
        return "HOST_TAKEN"

    user = get_user_by_nickname(db, participant_nickname)
    db_participant = models.MatchParticipant(
        match_id=db_match.id,
        nickname=participant_nickname,
        mannerScore=user.mannerScore if user else 5
    )
    db.add(db_participant)

    if role == "host":
        db_match.host_nickname = participant_nickname

    # 알림 생성
    games_label = ", ".join(db_match.games or ["자율 선택"])
    if user:
        create_notification(
            db, user.id, "match_joined",
            "매칭 참여 완료",
            f"[{games_label}] 매치 참여 및 {MATCH_PARTICIPATION_COST:,}P 결제가 완료되었습니다.",
            match_business_id=db_match.match_id
        )
    
    # 방장이 있는 경우, 방장에게 새 참가자 참여 알림 전송 (단, 방장 본인 제외)
    if db_match.host_nickname and db_match.host_nickname != participant_nickname:
        host_user = get_user_by_nickname(db, db_match.host_nickname)
        if host_user:
            create_notification(
                db, host_user.id, "participant_joined",
                "새로운 매칭 참가자",
                f"{participant_nickname}님이 [{games_label}] 매칭에 참여하셨습니다.",
                match_business_id=db_match.match_id
            )

    # 최소 인원 도달 시 매칭 확정 알림
    min_required = calculate_min_players_for_match(db, db_match.games)
    current_participants = {p.nickname for p in db_match.participants}
    current_participants.add(participant_nickname)
    new_count = len(current_participants)

    if new_count == min_required:
        for nick in current_participants:
            p_user = get_user_by_nickname(db, nick)
            if p_user:
                create_notification(
                    db, p_user.id, "match_confirmed",
                    "매칭 확정 알림",
                    f"[{games_label}] 매칭의 최소 인원({min_required}명)이 충족되어 매칭이 확정되었습니다!",
                    match_business_id=db_match.match_id
                )

    db.commit()
    db.refresh(db_match)
    return db_match

def leave_match(db: Session, match_id: str, nickname: str):
    """참여 취소 + 환불. 시작 전 매치만 가능.

    Returns:
        - "MATCH_NOT_FOUND" / "NOT_PARTICIPATING" / "ALREADY_STARTED" / "CANCELLED"
        - dict { refunded: int }: 성공
    """
    from datetime import datetime

    db_match = get_match_by_match_id(db, match_id)
    if not db_match:
        return "MATCH_NOT_FOUND"

    participant = db.query(models.MatchParticipant).filter(
        models.MatchParticipant.match_id == db_match.id,
        models.MatchParticipant.nickname == nickname
    ).first()
    if not participant:
        return "NOT_PARTICIPATING"

    if db_match.cancelled:
        return "CANCELLED"

    try:
        match_start = datetime.fromisoformat(f"{db_match.date}T{db_match.startTime}:00")
    except ValueError:
        match_start = None
    if match_start and datetime.now() >= match_start:
        return "ALREADY_STARTED"

    refund_amount = MATCH_PARTICIPATION_COST
    if match_start:
        time_to_start = match_start - datetime.now()
        if time_to_start.total_seconds() < 1800: # 30 minutes
            refund_amount = 0
        else:
            joined_at = participant.joined_at
            if joined_at:
                if joined_at.tzinfo is not None:
                    joined_at = joined_at.replace(tzinfo=None)
                time_since_join = datetime.now() - joined_at
                if time_since_join.total_seconds() > 3600: # 1 hour
                    refund_amount = int(MATCH_PARTICIPATION_COST * 0.2)

    db.delete(participant)
    db.flush()

    if refund_amount > 0:
        add_user_points(
            db, nickname, refund_amount,
            f"[{', '.join(db_match.games or [])}] 참여 취소 환불",
        )

    # 알림 생성
    user = get_user_by_nickname(db, nickname)
    games_label = ", ".join(db_match.games or [])
    if user:
        refund_msg = f"{refund_amount:,}P 가 환불되었습니다." if refund_amount > 0 else "환불 불가 기간(시작 30분 이내)으로 포인트 환불 없이 처리되었습니다."
        create_notification(
            db, user.id, "match_left",
            "매칭 참여 취소 완료",
            f"[{games_label}] 매치 참여를 취소하여 {refund_msg}",
            match_business_id=db_match.match_id
        )

    # 방장이 있는 경우, 방장에게 참여자 탈퇴 알림 전송 (단, 방장 본인 제외)
    if db_match.host_nickname and db_match.host_nickname != nickname:
        host_user = get_user_by_nickname(db, db_match.host_nickname)
        if host_user:
            create_notification(
                db, host_user.id, "participant_left",
                "참가자 매칭 취소",
                f"{nickname}님이 [{games_label}] 매칭 참여를 취소했습니다.",
                match_business_id=db_match.match_id
            )

    return {"refunded": refund_amount}

def get_user_matches(db: Session, nickname: str):
    # Matches user is participating in
    participating_match_ids = db.query(models.MatchParticipant.match_id).filter(
        models.MatchParticipant.nickname == nickname
    ).all()
    participating_match_ids = [m[0] for m in participating_match_ids]

    participating_matches = db.query(models.Match).filter(models.Match.id.in_(participating_match_ids)).all()
    return participating_matches

def add_user_points(db: Session, nickname: str, delta: int, description: str = ""):
    """포인트 가감 + 거래내역 INSERT 를 한 트랜잭션으로.

    delta 양수 = 적립('충전'), 음수 = 차감('사용').
    amount 는 절댓값으로 저장(부호는 type 으로 판별).
    """
    if delta == 0:
        return get_user_by_nickname(db, nickname)

    user = get_user_by_nickname(db, nickname)
    if not user:
        return None

    current = user.points or 0
    if delta < 0 and current + delta < 0:
        return False  # 잔액 부족 신호 — caller가 400 처리

    user.points = current + delta

    history = models.PointHistory(
        user_id=user.id,
        type="충전" if delta > 0 else "사용",
        amount=abs(delta),
        description=description or "",
    )
    db.add(history)

    db.commit()
    db.refresh(user)
    return user


def _recompute_manner_score(db: Session, nickname: str):
    """이 닉네임이 지금까지 받은 모든 별점의 평균을 User.mannerScore 로 갱신.

    트랜잭션 안에서 호출되는 헬퍼 — 별도 commit 안 함.
    """
    avg = (
        db.query(func.avg(models.Review.rating))
        .filter(models.Review.reviewee_nickname == nickname)
        .scalar()
    )
    if avg is None:
        return
    user = get_user_by_nickname(db, nickname)
    if user:
        # 학교식 반올림 (round-half-up) — Python 의 round() 는 banker's (round-half-to-even).
        # 별점은 양수만이라 (avg + 0.5) 후 int() 변환이 안전.
        user.mannerScore = int(avg + 0.5)


HOST_REWARD_AMOUNT = 3000
HOST_REWARD_THRESHOLD = 4.0


def _maybe_reward_host_for_match(db: Session, match: models.Match):
    """방장이 받은 평가 평균이 기준 이상이면 우수 방장 리워드를 1회 지급."""
    if not match or not match.host_nickname:
        return None
    if not match.completed or not match.completed_at or not getattr(match, "completed_by_host", False):
        return None

    host_user = get_user_by_nickname(db, match.host_nickname)
    if not host_user:
        return None

    review_window_start = match.completed_at
    review_window_end = match.completed_at + timedelta(minutes=30)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if now < review_window_end:
        return None

    host_reviews = (
        db.query(models.Review)
        .join(models.User, models.User.id == models.Review.reviewer_id)
        .filter(
            models.Review.match_id == match.id,
            models.Review.reviewee_nickname == match.host_nickname,
            models.User.nickname != match.host_nickname,
            models.Review.created_at >= review_window_start,
            models.Review.created_at <= review_window_end,
        )
        .all()
    )
    if not host_reviews:
        return None

    average_rating = sum(review.rating for review in host_reviews) / len(host_reviews)
    if average_rating < HOST_REWARD_THRESHOLD:
        return None

    reward_description = f"[{match.match_id}] 우수 방장 리워드"
    already_rewarded = (
        db.query(models.PointHistory)
        .filter(
            models.PointHistory.user_id == host_user.id,
            models.PointHistory.amount == HOST_REWARD_AMOUNT,
            models.PointHistory.description == reward_description,
        )
        .first()
    )
    if already_rewarded:
        return None

    updated_host = add_user_points(
        db,
        match.host_nickname,
        HOST_REWARD_AMOUNT,
        reward_description,
    )
    games_label = ", ".join(match.games or [])
    create_notification(
        db,
        host_user.id,
        "host_reward_paid",
        "우수 방장 리워드 지급",
        f"[{games_label}] 참여자 평가 평균 {average_rating:.1f}점으로 우수 방장 리워드 {HOST_REWARD_AMOUNT:,}P가 지급되었습니다.",
        match_business_id=match.match_id,
    )
    return updated_host


def create_match_reviews(db: Session, reviewer_id: int, match_business_id: str, items, comment: str = ""):
    """한 매치에 대한 참여자별 리뷰 N개를 한 트랜잭션으로 INSERT + reviewee 들의 매너 주사위 자동 갱신.

    Returns:
        - None: 매치 못 찾음
        - "ALREADY_REVIEWED": 이 사용자가 이 매치에 이미 리뷰함
        - List[Review]: 성공 시 INSERT 된 Review row 들
    """
    match = get_match_by_match_id(db, match_business_id)
    if not match:
        return None

    existing = db.query(models.Review).filter(
        models.Review.reviewer_id == reviewer_id,
        models.Review.match_id == match.id,
    ).first()
    if existing:
        return "ALREADY_REVIEWED"

    created = []
    affected_nicknames = set()
    for item in items:
        row = models.Review(
            reviewer_id=reviewer_id,
            reviewee_nickname=item.reviewee_nickname,
            match_id=match.id,
            rating=item.rating,
            comment=comment,
        )
        db.add(row)
        created.append(row)
        affected_nicknames.add(item.reviewee_nickname)

    # flush: INSERT 가 같은 트랜잭션의 후속 SELECT 에 보이게 함 (commit 전).
    # 이 한 줄이 없으면 avg() 가 방금 추가한 row 를 못 보고 옛 평균을 반환.
    db.flush()

    for nickname in affected_nicknames:
        _recompute_manner_score(db, nickname)

    db.commit()
    try:
        _maybe_reward_host_for_match(db, match)
    except Exception as exc:
        print(f"Failed to process host reward for match {match_business_id}: {exc}")

    # 알림 생성 (리뷰가 정상 등록된 후 피평가자들에게 전송)
    try:
        reviewer = db.query(models.User).filter(models.User.id == reviewer_id).first()
        reviewer_nickname = reviewer.nickname if reviewer else "참여자"
        games_label = ", ".join(match.games or [])
        for nickname in affected_nicknames:
            reviewee_user = get_user_by_nickname(db, nickname)
            if reviewee_user:
                create_notification(
                    db, reviewee_user.id, "manner_evaluated",
                    "매너 주사위 평가 도착",
                    f"[{games_label}] 매치 참여자({reviewer_nickname}님)가 회원님에게 매너 주사위 평가를 남겼습니다. 마이페이지에서 확인해 보세요!",
                    match_business_id=match.match_id
                )
    except Exception as exc:
        print(f"Failed to create review notifications for match {match_business_id}: {exc}")

    for row in created:
        db.refresh(row)
    return created


MATCH_PARTICIPATION_COST = 12000


def cancel_match(db: Session, match_business_id: str, host_forfeits: bool = False):
    """매치 취소 + 참여자 전원 환불 (한 트랜잭션).

    Returns:
        - "NOT_FOUND": 매치 없음
        - "ALREADY_CANCELLED": 이미 취소된 매치
        - dict { refunded_count, refund_amount }: 성공
    """
    match = get_match_by_match_id(db, match_business_id)
    if not match:
        return "NOT_FOUND"
    if match.cancelled:
        return "ALREADY_CANCELLED"

    refunded = 0
    games_label = ", ".join(match.games or [])
    for p in list(match.participants):
        user = get_user_by_nickname(db, p.nickname)
        if user is None:
            continue

        if host_forfeits and p.nickname == match.host_nickname:
            create_notification(
                db, user.id, "match_cancelled",
                "개설 매치 취소 안내",
                f"[{games_label}] 개설하신 매치가 취소되었습니다. 방장 책임 규정으로 인해 개설 참여비는 환불되지 않습니다.",
                match_business_id=match.match_id,
            )
            continue

        add_user_points(
            db, p.nickname, MATCH_PARTICIPATION_COST,
            f"[{games_label}] 매치 취소 환불",
        )
        create_notification(
            db, user.id, "match_cancelled",
            "매치가 취소되었습니다",
            f"[{games_label}] 매치가 취소되어 {MATCH_PARTICIPATION_COST:,}P 가 환불되었습니다.",
            match_business_id=match.match_id,
        )
        refunded += 1

    match.cancelled = True
    db.commit()

    return {
        "refunded_count": refunded,
        "refund_amount": MATCH_PARTICIPATION_COST,
    }


def get_reviewer_match_business_ids(db: Session, reviewer_id: int):
    """이 사용자가 리뷰 완료한 매치들의 비즈니스 ID(예: 'm1') 리스트."""
    rows = (
        db.query(models.Match.match_id)
        .join(models.Review, models.Review.match_id == models.Match.id)
        .filter(models.Review.reviewer_id == reviewer_id)
        .distinct()
        .all()
    )
    return [r[0] for r in rows]


def _is_match_participant(db: Session, match, nickname: str) -> bool:
    """이 매치에 nickname 으로 참여 중인지."""
    return any(p.nickname == nickname for p in match.participants)


def list_match_messages(db: Session, match_business_id: str, requester_nickname: str, after_id: int = None):
    """매치 메시지 조회.

    Returns:
        - "NOT_FOUND": 매치 없음
        - "FORBIDDEN": 참여자 아님
        - List[Message]: 메시지 (id 오름차순)
    """
    match = get_match_by_match_id(db, match_business_id)
    if not match:
        return "NOT_FOUND"
    if not _is_match_participant(db, match, requester_nickname):
        return "FORBIDDEN"

    q = db.query(models.Message).filter(models.Message.match_id == match.id)
    if after_id is not None:
        q = q.filter(models.Message.id > after_id)
    return q.order_by(models.Message.id.asc()).limit(200).all()


def create_match_message(db: Session, match_business_id: str, sender, content: str):
    """매치 메시지 작성.

    sender 는 User ORM 객체. 참여자만 작성 가능.
    """
    match = get_match_by_match_id(db, match_business_id)
    if not match:
        return "NOT_FOUND"
    if not _is_match_participant(db, match, sender.nickname):
        return "FORBIDDEN"

    msg = models.Message(
        match_id=match.id,
        sender_user_id=sender.id,
        sender_nickname=sender.nickname,
        content=content,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


def create_notification(db: Session, user_id: int, type_: str, title: str, body: str = "", match_business_id: str = None):
    notif = models.Notification(
        user_id=user_id,
        type=type_,
        title=title,
        body=body,
        match_business_id=match_business_id,
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return notif


def list_user_notifications(db: Session, user_id: int):
    return (
        db.query(models.Notification)
        .filter(models.Notification.user_id == user_id)
        .order_by(models.Notification.created_at.desc(), models.Notification.id.desc())
        .limit(100)
        .all()
    )


def mark_notification_read(db: Session, user_id: int, notif_id: int):
    notif = db.query(models.Notification).filter(
        models.Notification.id == notif_id,
        models.Notification.user_id == user_id,
    ).first()
    if not notif:
        return "NOT_FOUND"
    notif.read = True
    db.commit()
    return notif


def mark_all_notifications_read(db: Session, user_id: int):
    count = (
        db.query(models.Notification)
        .filter(models.Notification.user_id == user_id, models.Notification.read == False)  # noqa: E712
        .update({"read": True}, synchronize_session=False)
    )
    db.commit()
    return count


def get_user_point_history(db: Session, user_id: int):
    """최신순 거래내역."""
    return (
        db.query(models.PointHistory)
        .filter(models.PointHistory.user_id == user_id)
        .order_by(models.PointHistory.created_at.desc(), models.PointHistory.id.desc())
        .all()
    )


def complete_match(
    db: Session,
    match_business_id: str,
    completed_by_host: bool = True,
    completed_by_admin: bool = False,
):
    """Mark a match as successfully completed, and notify participants to evaluate.

    Returns:
        - "NOT_FOUND" / "ALREADY_COMPLETED" / "CANCELLED"
        - dict: success status
    """
    from datetime import datetime, timezone
    match = get_match_by_match_id(db, match_business_id)
    if not match:
        return "NOT_FOUND"
    if match.cancelled:
        return "CANCELLED"
    if match.completed:
        return "ALREADY_COMPLETED"

    match.completed = True
    match.completed_at = datetime.now(timezone.utc).replace(tzinfo=None)
    match.completed_by_host = completed_by_host
    db.flush()

    games_label = ", ".join(match.games or ["자율 선택"])
    if completed_by_host:
        notification_title = "매칭 성공적으로 완료"
        notification_body = f"[{games_label}] 매칭이 완료되었습니다. 지금부터 30분 동안 참여자들과 상호 매너 평가를 진행해주세요!"
    elif completed_by_admin:
        notification_title = "운영진이 매칭을 완료 처리했습니다"
        notification_body = f"[{games_label}] 운영진이 매칭을 완료 처리했습니다. 지금부터 30분 동안 참여자들과 상호 매너 평가를 진행해주세요!"
    else:
        notification_title = "매너 평가 자동 시작"
        notification_body = f"[{games_label}] 방장의 완료 확인 시간이 지나 자동으로 평가가 시작되었습니다. 지금부터 30분 동안 상호 매너 평가를 진행해주세요!"

    # Notify all participants that manner evaluation has started
    for p in match.participants:
        user = get_user_by_nickname(db, p.nickname)
        if user:
            create_notification(
                db, user.id, "manner_evaluation_started",
                notification_title,
                notification_body,
                match_business_id=match.match_id,
            )

    db.commit()
    return {"status": "success"}


def create_suggestion(db: Session, suggestion_in: schemas.SuggestionCreate, user_id: int):
    db_sug = models.Suggestion(
        user_id=user_id,
        category=suggestion_in.category,
        content=suggestion_in.content
    )
    db.add(db_sug)
    db.commit()
    db.refresh(db_sug)
    return db_sug


def reply_to_suggestion(db: Session, suggestion_id: int, reply_text: str):
    sug = db.query(models.Suggestion).filter(models.Suggestion.id == suggestion_id).first()
    if not sug:
        return None

    from datetime import datetime, timezone

    sug.admin_reply = reply_text
    sug.answered_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(sug)
    return sug


def get_suggestions_by_user(db: Session, user_id: int):
    return (
        db.query(models.Suggestion)
        .filter(models.Suggestion.user_id == user_id)
        .order_by(models.Suggestion.created_at.desc())
        .all()
    )


def get_all_suggestions(db: Session):
    return (
        db.query(models.Suggestion)
        .order_by(models.Suggestion.created_at.desc())
        .all()
    )


def create_user_report(
    db: Session,
    report_in: schemas.UserReportCreate,
    reporter_id: int,
    reported_user_id: int,
    match_db_id: int | None,
):
    duplicate_query = db.query(models.UserReport).filter(
        models.UserReport.reporter_id == reporter_id,
        models.UserReport.reported_user_id == reported_user_id,
        models.UserReport.status.in_(["received", "reviewing"]),
    )
    if match_db_id is None:
        duplicate_query = duplicate_query.filter(models.UserReport.match_id.is_(None))
    else:
        duplicate_query = duplicate_query.filter(models.UserReport.match_id == match_db_id)
    if duplicate_query.first():
        return "DUPLICATE"

    report = models.UserReport(
        reporter_id=reporter_id,
        reported_user_id=reported_user_id,
        match_id=match_db_id,
        category=report_in.category,
        content=report_in.content,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


def get_user_reports(db: Session, reporter_id: int):
    return (
        db.query(models.UserReport)
        .filter(models.UserReport.reporter_id == reporter_id)
        .order_by(models.UserReport.created_at.desc())
        .all()
    )


def get_all_user_reports(db: Session, status: str | None = None):
    query = db.query(models.UserReport)
    if status:
        query = query.filter(models.UserReport.status == status)
    return query.order_by(models.UserReport.created_at.desc()).all()


def update_user_report_status(
    db: Session,
    report_id: int,
    status: str,
    admin_note: str,
    handled_by_user_id: int,
):
    report = db.query(models.UserReport).filter(models.UserReport.id == report_id).first()
    if not report:
        return None
    report.status = status
    report.admin_note = admin_note or None
    report.handled_by_user_id = handled_by_user_id
    report.handled_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(report)
    return report


def _friendship_between(db: Session, user_id: int, other_user_id: int):
    return (
        db.query(models.Friendship)
        .filter(
            (
                (models.Friendship.requester_id == user_id)
                & (models.Friendship.addressee_id == other_user_id)
            )
            | (
                (models.Friendship.requester_id == other_user_id)
                & (models.Friendship.addressee_id == user_id)
            )
        )
        .order_by(models.Friendship.id.desc())
        .first()
    )


def are_friends(db: Session, user_id: int, other_user_id: int) -> bool:
    friendship = _friendship_between(db, user_id, other_user_id)
    return bool(friendship and friendship.status == "accepted")


def create_friend_request(db: Session, requester: models.User, target_nickname: str):
    target = get_user_by_nickname(db, target_nickname)
    if not target:
        return "USER_NOT_FOUND"
    if target.id == requester.id:
        return "SELF"

    existing = _friendship_between(db, requester.id, target.id)
    if existing:
        if existing.status == "accepted":
            return "ALREADY_FRIENDS"
        if existing.status == "pending":
            return "ALREADY_PENDING"
        existing.requester_id = requester.id
        existing.addressee_id = target.id
        existing.status = "pending"
        existing.responded_at = None
        db.commit()
        db.refresh(existing)
        create_notification(
            db,
            target.id,
            "friend_request_received",
            "친구 신청 도착",
            f"{requester.nickname}님이 친구 신청을 보냈습니다.",
        )
        return existing

    row = models.Friendship(
        requester_id=requester.id,
        addressee_id=target.id,
        status="pending",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    create_notification(
        db,
        target.id,
        "friend_request_received",
        "친구 신청 도착",
        f"{requester.nickname}님이 친구 신청을 보냈습니다.",
    )
    return row


def list_friendships(db: Session, user_id: int):
    return (
        db.query(models.Friendship)
        .filter(
            models.Friendship.status == "accepted",
            (
                (models.Friendship.requester_id == user_id)
                | (models.Friendship.addressee_id == user_id)
            ),
        )
        .order_by(models.Friendship.responded_at.desc(), models.Friendship.id.desc())
        .all()
    )


def list_friend_requests(db: Session, user_id: int):
    incoming = (
        db.query(models.Friendship)
        .filter(
            models.Friendship.addressee_id == user_id,
            models.Friendship.status == "pending",
        )
        .order_by(models.Friendship.created_at.desc())
        .all()
    )
    outgoing = (
        db.query(models.Friendship)
        .filter(
            models.Friendship.requester_id == user_id,
            models.Friendship.status == "pending",
        )
        .order_by(models.Friendship.created_at.desc())
        .all()
    )
    return incoming, outgoing


def respond_friend_request(db: Session, request_id: int, user: models.User, accept: bool):
    from datetime import datetime, timezone

    row = db.query(models.Friendship).filter(models.Friendship.id == request_id).first()
    if not row:
        return "NOT_FOUND"
    if row.addressee_id != user.id:
        return "FORBIDDEN"
    if row.status != "pending":
        return "ALREADY_HANDLED"

    row.status = "accepted" if accept else "rejected"
    row.responded_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)

    requester = db.query(models.User).filter(models.User.id == row.requester_id).first()
    if requester:
        create_notification(
            db,
            requester.id,
            "friend_request_accepted" if accept else "friend_request_rejected",
            "친구 신청 수락" if accept else "친구 신청 거절",
            f"{user.nickname}님이 친구 신청을 {'수락' if accept else '거절'}했습니다.",
        )
    return row


def remove_friend(db: Session, user_id: int, friend_id: int):
    row = _friendship_between(db, user_id, friend_id)
    if not row or row.status != "accepted":
        return "NOT_FOUND"
    row.status = "rejected"
    db.commit()
    return True


def list_friend_messages(db: Session, user_id: int, friend_id: int):
    if not are_friends(db, user_id, friend_id):
        return "NOT_FRIENDS"
    return (
        db.query(models.FriendMessage)
        .filter(
            (
                (models.FriendMessage.sender_id == user_id)
                & (models.FriendMessage.recipient_id == friend_id)
            )
            | (
                (models.FriendMessage.sender_id == friend_id)
                & (models.FriendMessage.recipient_id == user_id)
            )
        )
        .order_by(models.FriendMessage.created_at.asc(), models.FriendMessage.id.asc())
        .all()
    )


def create_friend_message(db: Session, sender: models.User, friend_id: int, content: str):
    friend = db.query(models.User).filter(models.User.id == friend_id).first()
    if not friend:
        return "USER_NOT_FOUND"
    if not are_friends(db, sender.id, friend_id):
        return "NOT_FRIENDS"
    msg = models.FriendMessage(
        sender_id=sender.id,
        recipient_id=friend_id,
        content=content,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    create_notification(
        db,
        friend_id,
        "friend_message_received",
        "친구 메시지 도착",
        f"{sender.nickname}님이 메시지를 보냈습니다.",
    )
    return msg


def get_friend_matches(db: Session, user_id: int, friend_id: int):
    friend = db.query(models.User).filter(models.User.id == friend_id).first()
    if not friend:
        return "USER_NOT_FOUND"
    if not are_friends(db, user_id, friend_id):
        return "NOT_FRIENDS"
    now = datetime.now()
    upcoming = []
    for match in get_user_matches(db, friend.nickname):
        if match.cancelled:
            continue
        try:
            match_start = datetime.fromisoformat(f"{match.date}T{match.startTime}:00")
        except (TypeError, ValueError):
            continue
        if match_start > now:
            upcoming.append(match)
    return upcoming
