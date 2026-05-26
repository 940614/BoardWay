# BoardWay 코드 점검 및 수정 내역

> **브랜치:** `fix/issues-and-bugs`  
> **작업자:** jihopark02  
> **작업 일자:** 2026-05-26

---

## 📋 목차

1. [팀원 필수 액션 (지금 당장)](#-팀원-필수-액션-지금-당장)
2. [수정 내역 상세](#-수정-내역-상세)
3. [이후 해야 할 것들](#-이후-해야-할-것들)

---

## ⚡ 팀원 필수 액션 (지금 당장)

브랜치를 pull 받은 후 아래 두 가지를 **반드시** 실행해야 서버가 정상 동작합니다.

### 1. `backend/.env` 파일 생성
`.env` 파일은 보안상 GitHub에 올라가지 않습니다. 직접 만들어야 해요.

```
backend/ 폴더 안에 .env 파일 생성 후 아래 내용 입력:

SECRET_KEY=your-secret-key-for-development
```

> `.env.example` 파일을 참고하세요.

### 2. DB 리셋 (이미지 URL 수정 때문)
기존 DB에 로컬 IP가 박혀있어서 이미지가 깨져 보입니다. 아래 명령어로 초기화하세요.

```bash
cd backend
python seed.py
```

---

## 🔧 수정 내역 상세

### Fix 1 — 서버 내부 정보 노출 제거
**커밋:** `19874bbb`  
**파일:** `backend/main.py`

**문제**  
서버에서 에러가 발생하면 에러 응답에 서버의 폴더 구조, 코드 내용, DB 쿼리 등이 그대로 담겨서 클라이언트(앱)로 전송되고 있었습니다.
```json
// 기존 — 위험
{ "message": "...", "detail": "...", "traceback": "File /Users/... line 42 ..." }

// 수정 후 — 안전
{ "message": "Internal Server Error" }
```
서버 로그에는 여전히 출력되므로 디버깅에는 지장 없습니다.

---

### Fix 2 — 매치 생성/삭제 API 인증 추가
**커밋:** `2d741396`  
**파일:** `backend/main.py`

**문제**  
로그인하지 않은 사람도 API를 직접 호출하면 매치를 마음대로 만들거나 삭제할 수 있었습니다.

**수정**  
`POST /matches`, `DELETE /matches/{id}` 두 엔드포인트에 로그인 검증을 추가했습니다. 토큰 없이 호출하면 401 에러가 반환됩니다.

> 앱 화면에는 매치 직접 생성 UI가 없으므로 기존 사용자 경험에 영향 없음.

---

### Fix 3 — 비밀 키 환경변수 분리
**커밋:** `2cb2f74f`  
**파일:** `backend/auth_utils.py`, `backend/.env.example`

**문제**  
JWT 토큰 서명에 사용하는 비밀 키가 코드에 `"your-secret-key-for-development"` 라고 하드코딩되어 있었습니다. 이 키를 알면 누구나 가짜 로그인 토큰을 만들 수 있습니다.

**수정**  
- 키를 `backend/.env` 파일에서 읽어오도록 변경
- `.env` 파일이 없으면 서버 실행 시 바로 에러를 발생시켜 알 수 있게 함
- `.env.example` 파일로 설정 방법 안내

> **팀원 액션:** 위 [필수 액션 1번](#1-backendenv-파일-생성) 참고

---

### Fix 4 — 룰 영상 없을 때 앱 크래시 수정
**커밋:** `dfe2936f`  
**파일:** `frontend/src/screens/MatchDetailScreen.js`

**문제**  
대부분의 매치에 룰 영상 URL이 등록되지 않은 상태였는데(`"ruleVideoUrls": []`), 매치 상세 화면 진입 시 영상 플레이어가 `undefined`를 받아 앱이 강제 종료됐습니다.

**수정**  
룰 영상이 없을 경우 "등록된 룰 영상이 없습니다." 안내 메시지를 표시하도록 처리했습니다.

---

### Fix 5 — 매너 점수 서버에서 고정
**커밋:** `25300f44`  
**파일:** `backend/schemas.py`, `backend/crud.py`

**문제**  
회원가입 API를 직접 호출할 때 `mannerScore` 값을 임의로 넣으면(`9999` 등) 그대로 DB에 저장됐습니다.

**수정**  
- 회원가입 요청에서 `mannerScore` 필드 제거 (클라이언트가 보내도 무시)
- 서버에서 항상 초기값 `5`로 고정하여 저장

---

### Fix 6 — CORS 설정 오류 수정
**커밋:** `3b997863`  
**파일:** `backend/main.py`

**문제**  
`allow_origins=["*"]`(모든 도메인 허용)과 `allow_credentials=True`(쿠키/인증 허용)를 동시에 쓰면 브라우저 보안 정책에 의해 차단됩니다. 웹 프론트엔드(`web-frontend/`)에서 API 호출이 막힐 수 있는 상태였습니다.

**수정**  
JWT 인증은 `Authorization` 헤더 방식을 사용하므로 `allow_credentials`가 불필요합니다. 해당 옵션을 제거했습니다.

---

### Fix 7 — 결제 후 참여 실패 시 포인트 사라지는 문제 수정
**커밋:** `72b6a2ae`  
**파일:** `frontend/src/screens/MatchDetailScreen.js`

**문제**  
결제 흐름이 아래 순서였습니다.
```
1. 포인트 차감 ← 이미 빠짐
2. 서버에 참여 요청 → 실패 (네트워크 오류, 만석 등)
= 포인트는 빠졌는데 참여는 안 된 상태
```

**수정**  
순서를 바꿔 서버 참여가 성공한 이후에만 포인트를 차감합니다.
```
1. 서버에 참여 요청 → 실패 시 여기서 중단 (포인트 유지)
2. 참여 성공 후 포인트 차감
```

---

### Fix 8 — 이미지 URL 하드코딩 제거
**커밋:** `92ce85ec`  
**파일:** `backend/seed.py`, `frontend/src/screens/GameSearchScreen.js`

**문제**  
DB에 저장된 게임 이미지 URL이 `http://192.168.0.55:8000/images/g1.png` 형태로 특정 PC의 로컬 IP가 박혀있었습니다. 다른 팀원 환경이나 배포 환경에서는 이미지가 전부 깨져 보였습니다.

**수정**  
- `seed.py`: 이미지 경로를 `/images/g1.png` 형태의 상대 경로로 변경
- `GameSearchScreen.js`: 이미지 표시 시 `API_URL`을 앞에 붙여 완전한 URL로 조합

> **팀원 액션:** 위 [필수 액션 2번](#2-db-리셋-이미지-url-수정-때문) 참고

---

### Fix 9 — 에러 로그 필드명 오타 수정
**커밋:** `eed6c2a3`  
**파일:** `backend/main.py`

**문제**  
매치 데이터 포맷 중 에러 발생 시 로그에 `m.id`를 출력했는데, 실제 필드명은 `m.match_id`였습니다. 에러 로그에 항상 `None`이 찍히는 문제였습니다.

**수정**  
`m.id` → `m.match_id`로 수정했습니다.

---

### Fix 10 — 회원가입/매치 입력값 검증 추가
**커밋:** `cb67fcc8`  
**파일:** `backend/schemas.py`, `backend/requirements.txt`

**문제**  
API로 아무 값이나 넣어도 그대로 DB에 저장됐습니다.
- 이메일: 형식 검사 없음 (`"abc"` 같은 값도 통과)
- 비밀번호: 길이 제한 없음 (`"1"` 한 글자도 통과)
- 닉네임: 길이 제한 없음
- 최대 인원: 범위 제한 없음 (`0`이나 `-1`도 통과)

또한 `database.py`에서 `python-dotenv`를 사용하는데 `requirements.txt`에 누락되어 있어 다른 환경에서 서버가 아예 뜨지 않는 문제도 있었습니다.

**수정**

| 필드 | 검증 조건 |
|------|-----------|
| email | 이메일 형식 (`@` 포함 등) |
| password | 최소 8자 이상 |
| nickname | 최소 2자, 최대 20자 |
| maxPlayers | 최소 2명, 최대 10명 |

`requirements.txt`에 `python-dotenv`, `pydantic[email]` 패키지 추가.

---

### Fix 11 — 동시 참여 요청 초과 방지
**커밋:** `ccd94124`  
**파일:** `backend/crud.py`

**문제**  
두 명이 거의 동시에 마지막 자리에 참여 요청을 보내면, 둘 다 "아직 자리 있음"으로 통과해서 최대 인원을 초과할 수 있었습니다.

**수정**  
DB에 쓴 직후 실제 인원 수를 다시 확인하고, 초과된 경우 자동 롤백하도록 처리했습니다.

---

### Fix 12 — 매치 목록 페이지네이션 추가
**커밋:** `20548d6f`  
**파일:** `backend/crud.py`, `backend/main.py`

**문제**  
`GET /matches` 요청 시 DB에 있는 매치를 전부 한 번에 내려보내고 있었습니다. 매치가 수백 개가 되면 속도가 느려지고 서버 부하가 커집니다.

**수정**  
`skip`, `limit` 파라미터를 추가했습니다. 기본값은 `limit=100`으로 기존 동작과 차이 없습니다.
```
GET /matches          → 처음 100개
GET /matches?limit=20 → 처음 20개
GET /matches?skip=20&limit=20 → 21번째~40번째
```

---

## 🗺 이후 해야 할 것들

### 🔴 우선순위 높음

#### 1. 포인트 시스템 백엔드 이전
현재 포인트는 앱 내부 저장소(AsyncStorage)에만 존재합니다.
- 앱 삭제하면 포인트 전부 사라짐
- 기기를 바꾸면 포인트 0에서 시작
- 서버에서 포인트 검증이 불가능함

**해야 할 것:**
- `User` 모델에 `points` 컬럼 추가
- `POST /points/charge`, `POST /points/use` API 구현
- 프론트엔드 포인트 로직을 AsyncStorage 대신 API 호출로 교체

#### 2. 채팅 백엔드 연동
현재 채팅은 UI만 있고 실제로 메시지가 전송되지 않습니다.
- 보내는 메시지가 내 화면에만 보임
- 화면 이동 시 메시지 전부 사라짐
- 하드코딩된 "보드왕" 메시지가 모든 채팅방에 동일하게 보임

**해야 할 것:**
- `ChatMessage` 모델 추가 (match_id, sender, text, created_at)
- `GET /matches/{id}/messages`, `POST /matches/{id}/messages` API 구현
- 프론트엔드 채팅 화면을 API 연동으로 교체
- (선택) WebSocket으로 실시간 메시지 수신

#### 3. 리뷰 백엔드 연동
현재 리뷰 제출이 아무것도 하지 않습니다.
- 리뷰를 남겨도 DB에 저장되지 않음
- 매너 점수가 리뷰에 따라 변하지 않음

**해야 할 것:**
- `Review` 모델 추가 (reviewer, target_nickname, match_id, score)
- `POST /matches/{id}/reviews` API 구현
- 리뷰 집계 후 `User.mannerScore` 업데이트 로직

#### 4. 방장(Host) 서버 관리
현재 방장 정보는 앱 메모리에만 존재합니다.
- 앱 재시작 시 방장 정보 사라짐
- 두 명이 동시에 방장 신청 가능

**해야 할 것:**
- `Match` 모델에 `host_nickname` 컬럼 추가
- `POST /matches/{id}/join` 에서 role 파라미터 처리
- 프론트엔드 hostMap을 서버 응답 기반으로 교체

---

### 🟡 우선순위 보통

#### 5. 비밀번호 검증 방식 통일
현재 `auth_utils.py`에 SHA-256 전처리 방식과 구버전 bcrypt 방식이 공존합니다. 초기 사용자 DB를 리셋(`seed.py` 재실행)하면 구버전 코드를 제거해도 됩니다.

#### 6. 이메일 중복 검사 응답 보안
현재 이미 가입된 이메일로 가입 시도 시 `"이미 가입된 이메일입니다."` 라고 정확히 알려줍니다. 악의적인 사용자가 특정 이메일이 가입되어 있는지 확인하는 데 악용될 수 있습니다. `"이메일 또는 닉네임을 확인해주세요."` 처럼 모호하게 바꾸는 것을 고려하세요.

#### 7. 백업 데이터 날짜 업데이트
`MatchContext.js`의 BACKUP_DATA(서버 연결 실패 시 표시)에 과거 날짜가 하드코딩되어 있습니다. 서버가 안 될 때 이미 지난 매치들이 보이는 현상이 있어요.

---

### 🟢 배포 준비 시

#### 8. SECRET_KEY 실제 랜덤 키로 교체
현재 `.env`의 `SECRET_KEY` 값이 `your-secret-key-for-development`입니다. 배포 전에 반드시 추측 불가능한 랜덤 값으로 교체하세요.

```bash
# 랜덤 키 생성 방법 (터미널)
python -c "import secrets; print(secrets.token_hex(32))"
```

#### 9. CORS 도메인 제한
현재 `allow_origins=["*"]`로 모든 도메인에서 API 호출이 가능합니다. 배포 시 실제 서비스 도메인만 허용하도록 변경하세요.

#### 10. DB를 PostgreSQL로 전환
현재 SQLite는 로컬 개발용입니다. `backend/.env`에 `POSTGRES_URL`을 설정하면 자동으로 전환되도록 코드가 이미 준비되어 있습니다.
