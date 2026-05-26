import uuid
from sqlalchemy.orm import Session
import models, schemas
from auth_utils import get_password_hash

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def get_user_by_nickname(db: Session, nickname: str):
    return db.query(models.User).filter(models.User.nickname == nickname).first()

def create_user(db: Session, user: schemas.UserCreate):
    db_user = models.User(
        email=user.email,
        password=get_password_hash(user.password),
        nickname=user.nickname,
        mannerScore=5  # 항상 5로 고정 (클라이언트 조작 방지)
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

def create_match(db: Session, match: schemas.MatchCreate):
    """
    Admin or System creates matches based on venue availability.
    """
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
        maxPlayers=match.maxPlayers
    )
    db.add(db_match)
    db.commit()
    db.refresh(db_match)
    return db_match

def join_match(db: Session, match_id: str, participant_nickname: str):
    db_match = get_match_by_match_id(db, match_id)
    if not db_match:
        return None

    # 중복 참여 검사
    for p in db_match.participants:
        if p.nickname == participant_nickname:
            return "ALREADY_JOINED"

    if len(db_match.participants) >= db_match.maxPlayers:
        return "FULL"

    user = get_user_by_nickname(db, participant_nickname)
    db_participant = models.MatchParticipant(
        match_id=db_match.id,
        nickname=participant_nickname,
        mannerScore=user.mannerScore if user else 5
    )
    db.add(db_participant)
    db.flush()  # DB에 쓰되 커밋은 보류

    # flush 후 실제 인원 재확인 (동시 요청으로 인한 초과 방지)
    db.refresh(db_match)
    if len(db_match.participants) > db_match.maxPlayers:
        db.rollback()
        return "FULL"

    db.commit()
    db.refresh(db_match)
    return db_match

def leave_match(db: Session, match_id: str, nickname: str):
    db_match = get_match_by_match_id(db, match_id)
    if not db_match:
        return "MATCH_NOT_FOUND"
    
    participant = db.query(models.MatchParticipant).filter(
        models.MatchParticipant.match_id == db_match.id,
        models.MatchParticipant.nickname == nickname
    ).first()
    
    if not participant:
        return "NOT_PARTICIPATING"
    
    db.delete(participant)
    db.commit()
    return "SUCCESS"

def get_user_matches(db: Session, nickname: str):
    # Matches user is participating in
    participating_match_ids = db.query(models.MatchParticipant.match_id).filter(
        models.MatchParticipant.nickname == nickname
    ).all()
    participating_match_ids = [m[0] for m in participating_match_ids]
    
    participating_matches = db.query(models.Match).filter(models.Match.id.in_(participating_match_ids)).all()
    return participating_matches
