from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
import os
import hashlib
import bcrypt

# JWT 설정
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY 환경변수가 설정되지 않았습니다. backend/.env 파일을 확인하세요.")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 1주일

# pwd_context 제거 (bcrypt 직접 사용)

def verify_password(plain_password: str, hashed_password: str):
    # 1. SHA-256 전해시(pre-hash) 방식으로 확인 (새로운 방식)
    pre_hashed = hashlib.sha256(plain_password.encode('utf-8')).hexdigest().encode('utf-8')
    try:
        if bcrypt.checkpw(pre_hashed, hashed_password.encode('utf-8')):
            return True
    except Exception:
        pass

    # 2. 기존 방식(전해시 없음)으로 확인 (기존 사용자 호환성 유지)
    pwd_bytes = plain_password.encode('utf-8')
    # bcrypt는 72바이트 초과 시 오류가 발생하므로 수동 절단
    if len(pwd_bytes) > 72:
        pwd_bytes = pwd_bytes[:72]
    try:
        return bcrypt.checkpw(pwd_bytes, hashed_password.encode('utf-8'))
    except Exception:
        return False

def get_password_hash(password: str):
    # bcrypt의 72바이트 제한을 피하기 위해 SHA-256으로 먼저 해싱
    pre_hashed = hashlib.sha256(password.encode('utf-8')).hexdigest().encode('utf-8')
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pre_hashed, salt).decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
