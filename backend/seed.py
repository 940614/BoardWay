from datetime import date, timedelta

import models
from auth_utils import get_password_hash
from database import SessionLocal

# 테이블은 Alembic 으로 관리합니다. 시드 전 `alembic upgrade head` 가 선행되어 있어야 합니다.

# MATCHES_DATA 의 하드코딩 날짜를 "오늘 기준 offset" 으로 재해석.
# 매번 시드할 때 매치들이 오늘 기준 -5~+1 일에 자동 분포 → 데모 시점이 어디든
# "지난 매치 / 진행 중 / 미래 매치" 가 항상 섞여 있어 검증 막힘 없음.
_DATE_OFFSETS = {
    "2026-05-11": -5,
    "2026-05-12": -4,
    "2026-05-13": -3,
    "2026-05-14": -2,
    "2026-05-15": -1,
    "2026-05-16": 0,
    "2026-05-17": 1,
}

def _resolve_date(hardcoded: str) -> str:
    today = date.today()
    offset = _DATE_OFFSETS.get(hardcoded)
    if offset is None:
        return hardcoded  # 매핑에 없으면 원본 그대로 (방어)
    return (today + timedelta(days=offset)).isoformat()

GAMES_DATA = [
    # ── 기존 15종 (장르 추가) ──────────────────────────────────────
    {"id": "g1",  "name": "스플랜더",      "players": "2-4인",  "difficulty": "보통",      "genre": "전략 / 엔진 빌딩",       "description": "보석을 모아 카드를 사고 점수를 획득하는 최고의 입문용 전략 게임",              "ruleUrl": "https://www.youtube.com/embed/3Y-VZ3pCSlw",              "image": "/images/g1.png"},
    {"id": "g2",  "name": "카탄",          "players": "3-4인",  "difficulty": "어려움",    "genre": "전략 / 협상",             "description": "무인도에서 자원을 채집하고 거래하며 마을을 건설하는 고전 명작",                "ruleUrl": "https://www.youtube.com/embed/37V2ajpMEic",              "image": "/images/g2.png"},
    {"id": "g3",  "name": "루미큐브",      "players": "2-4인",  "difficulty": "쉬움",      "genre": "숫자 / 타일",             "description": "숫자 조합을 통해 손에 든 타일을 가장 먼저 털어내는 지능형 게임",              "ruleUrl": "https://www.youtube.com/embed/uHuYRzgzbL8",              "image": "/images/g3.png"},
    {"id": "g4",  "name": "뱅!",           "players": "4-7인",  "difficulty": "보통",      "genre": "마피아 / 심리전 / 다인용 게임",         "description": "보안관과 무법자의 치열한 대결! 서부 시대를 배경으로 한 마피아 카드 게임",   "ruleUrl": "https://youtu.be/DcI7tsUoCnM?si=oNPztzs8SBf26Mft",      "image": "/images/g4.png"},
    {"id": "g5",  "name": "할리갈리",      "players": "2-6인",  "difficulty": "쉬움",      "genre": "파티 / 순발력",           "description": "과일 5개가 모이면 종을 쳐라! 순발력 게임의 대명사",                        "ruleUrl": "https://youtu.be/Ge0EiEiKOmQ?si=QvhVGsFxjeRH8FN_",     "image": "/images/g5.png"},
    {"id": "g6",  "name": "다빈치 코드",   "players": "2-4인",  "difficulty": "쉬움",      "genre": "추리 / 숫자",             "description": "상대방의 숫자를 추리해서 모두 맞혀라! 간단하지만 심오한 숫자 추리 게임",   "ruleUrl": "https://youtu.be/ElNpDx2oKpQ?si=hCyiRS54SjlejuLj",     "image": "/images/g6.png"},
    {"id": "g7",  "name": "텔레스트레이션","players": "4-8인",  "difficulty": "쉬움",      "genre": "파티 / 드로잉 / 다인용 게임",           "description": "그림으로 말해요! 웃음이 끊이지 않는 최고의 파티 드로잉 게임",              "ruleUrl": "https://youtu.be/Puc_1XyP-30?si=I8tvfkWKil4jzjK-",    "image": "/images/g7.png"},
    {"id": "g8",  "name": "달무티",        "players": "4-8인",  "difficulty": "쉬움",      "genre": "파티 / 카드 / 다인용 게임",             "description": "인생은 불공평합니다! 계급 사회를 풍자한 중독성 강한 카드 게임",              "ruleUrl": "https://youtu.be/9M6v7IDu9mk?si=EUGmq-jOCX4kUpz_",    "image": "/images/g8.png"},
    {"id": "g9",  "name": "아발론",        "players": "5-10인", "difficulty": "보통",      "genre": "마피아 / 심리전 / 다인용 게임",         "description": "아서 왕의 충신과 모드레드의 하수인! 마피아 게임의 정점",                    "ruleUrl": "https://youtu.be/5_FNTcIRJAY?si=ZozcaKXUkTrgfOCk",    "image": "/images/g9.png"},
    {"id": "g10", "name": "딕싯",          "players": "3-6인",  "difficulty": "쉬움",      "genre": "파티 / 스토리텔링",       "description": "한 편의 시 같은 그림 카드로 소통하는 감성적인 스토리텔링 게임",            "ruleUrl": "https://youtu.be/SWvzmI2jts8?si=MEMFb0NIdjCufK8_",    "image": "/images/g10.png"},
    {"id": "g11", "name": "윙스팬",        "players": "1-5인",  "difficulty": "보통",      "genre": "전략 / 엔진 빌딩",       "description": "아름다운 새들을 내 서식지로 불러모으는 힐링 전략 게임",                    "ruleUrl": "https://youtu.be/det7k20KOis?si=BFsQfWV2E1zVDX-8",    "image": "/images/g11.png"},
    {"id": "g12", "name": "코드네임",      "players": "2-8인",  "difficulty": "쉬움",      "genre": "단어 / 팀 대항 / 다인용 게임",         "description": "단어 하나로 팀원에게 정답을 알려라! 팀 대항 단어 연상 게임",              "ruleUrl": "https://youtu.be/pPYGAV8MtSM?si=RGgpELdu_JNSi7t5",    "image": "/images/g12.png"},
    {"id": "g13", "name": "테라포밍 마스", "players": "1-5인",  "difficulty": "매우 어려움","genre": "전략 / 헤비게임",        "description": "화성을 인간이 살 수 있는 곳으로! 보드게이머들이 가장 사랑하는 전략 게임",  "ruleUrl": "https://youtu.be/a52Pq1-JCiw?si=us__3Cj056SFsP0D",    "image": "/images/g13.png"},
    {"id": "g14", "name": "젠가",          "players": "1-10인", "difficulty": "쉬움",      "genre": "파티 / 균형 / 다인용 게임",             "description": "블록을 하나씩 빼서 위로 쌓아라! 아슬아슬한 긴장감의 파티 게임",            "ruleUrl": "https://youtu.be/l6ls_o2F-HU?si=nnbHoS6BZAQO0oWd",    "image": "/images/g14.png"},
    {"id": "g15", "name": "부루마불",      "players": "2-4인",  "difficulty": "쉬움",      "genre": "고전 / 경제",             "description": "전 세계를 누비며 땅을 사고 건물을 짓는 추억의 국민 보드게임",              "ruleUrl": "https://youtu.be/lnFnWRAfWUY?si=JUZ6dLK9b5ylRxEj",    "image": "/images/g15.png"},
    # ── 신규 7종 (엑셀 추가) ──────────────────────────────────────
    {"id": "g16", "name": "아줄",          "players": "2-4인",  "difficulty": "보통",      "genre": "추상 전략 / 타일 배치",   "description": "모로코 타일 예술에서 영감받은 아름다운 타일 배치 전략 게임. 직관적이지만 치열하다", "ruleUrl": "https://youtu.be/PLCU5GlgQC4?si=Oevja0OJrXTL51S9", "image": "/images/g16.png"},
    {"id": "g17", "name": "라스베가스",    "players": "2-5인",  "difficulty": "쉬움",      "genre": "파티 / 주사위",           "description": "주사위를 굴려 카지노를 점령하라! 단순하지만 짜릿한 배팅 주사위 게임",      "ruleUrl": "https://youtu.be/Bt2escpWj8Q?si=eNi2GByZIfiU9XjS",    "image": "/images/g17.png"},
    {"id": "g18", "name": "스컬킹",        "players": "2-6인",  "difficulty": "보통",      "genre": "카드 / 트릭 테이킹",     "description": "해적이 되어 트릭을 먹어라! 심리전이 가득한 트릭 테이킹 카드 게임",          "ruleUrl": "https://youtu.be/cYB1h4xOonI?si=bSufr76FqM-yVRjv",    "image": "/images/g18.png"},
    {"id": "g19", "name": "클루",          "players": "2-6인",  "difficulty": "보통",      "genre": "추리 / 블러핑",           "description": "누가, 어디서, 어떻게 살인했나? 고전 추리 보드게임의 대명사",                "ruleUrl": "https://youtu.be/7Ium0jpht0g?si=bIxmqJcGL3L6dygf",    "image": "/images/g19.png"},
    {"id": "g20", "name": "레지스탕스 쿠", "players": "2-6인",  "difficulty": "쉬움",      "genre": "마피아 / 블러핑",         "description": "쿠데타를 일으켜 다른 플레이어를 제거하라! 블러핑의 정점",                  "ruleUrl": "https://youtu.be/7j7zkNsPiPQ?si=jt4T5cBmvILqs1NG",    "image": "/images/g20.png"},
    {"id": "g21", "name": "패치워크",      "players": "2인 전용","difficulty": "쉬움",      "genre": "타일 배치 / 2인 전용",   "description": "퀼트 조각을 맞춰 이불을 완성하라! 2인 최강 타일 배치 퍼즐 게임",            "ruleUrl": "https://youtu.be/PJ0BydwalAY?si=0UASKaBlu6CDc9ov",    "image": "/images/g21.png"},
    {"id": "g22", "name": "러브레터",      "players": "2-4인",  "difficulty": "쉬움",      "genre": "카드 / 심리전",           "description": "단 16장의 카드로 공주에게 편지를 전달하라! 단순하지만 깊이 있는 심리 게임",  "ruleUrl": "https://youtu.be/QJh1rQortrc?si=UyEwgLJYViNHTtdW",    "image": "/images/g22.png"},
    # ── 프랜차이즈 분석 15종 (레드버튼·히어로·체크메이트 등 공통 인기작) ──
    {"id": "g23", "name": "바퀴벌레 포커 로얄", "players": "2-6인",  "difficulty": "쉬움",  "genre": "마피아 / 블러핑",         "description": "카드를 내밀며 거짓말을 해라! 누가 가장 많이 속을까? 블러핑 파티 게임의 고전",  "ruleUrl": "https://youtu.be/zTiUHEsK8Vk?si=wGvLysw1sIyC2ozW", "image": "/images/g23.png"},
    {"id": "g24", "name": "도블",              "players": "2-8인",  "difficulty": "쉬움",  "genre": "파티 / 스피드 / 다인용 게임",           "description": "두 카드 사이의 공통 그림을 가장 빨리 외쳐라! 모든 연령대가 즐기는 스피드 게임", "ruleUrl": "https://youtu.be/pTXOiirhCv4?si=bqfF0SVaKzjy8_Qz", "image": "/images/g24.png"},
    {"id": "g25", "name": "우노",              "players": "2-10인", "difficulty": "쉬움",  "genre": "카드 / 파티 / 다인용 게임",             "description": "손에 쥔 카드를 먼저 다 내면 UNO! 전 세계가 사랑하는 국민 카드 게임",       "ruleUrl": "https://youtu.be/bbtMloNezvM?si=txVVOWbDsMtRg-f8", "image": "/images/g25.png"},
    {"id": "g26", "name": "노땡스",            "players": "3-7인",  "difficulty": "쉬움",  "genre": "카드 / 심리전 / 다인용 게임",           "description": "숫자 카드를 거부하면 칩을 받는다. 카드를 가장 적게 모아라! 간단하지만 깊은 심리전", "ruleUrl": "https://youtu.be/aGfk4Y8uWy0?si=koRTHtKCSKlt4gA_", "image": "/images/g26.png"},
    {"id": "g27", "name": "사보타지",          "players": "3-10인", "difficulty": "보통",  "genre": "마피아 / 협력 / 다인용 게임",           "description": "광부들이 금을 캐는 동안 방해꾼이 몰래 훼방을 놓는다! 내 편과 적을 찾아라",   "ruleUrl": "https://youtu.be/JC7SxhaOXjU?si=boQSRUvBNdKxCQ5y", "image": "/images/g27.png"},
    {"id": "g28", "name": "익스플로딩 키튼",   "players": "2-5인",  "difficulty": "쉬움",  "genre": "카드 / 파티",             "description": "폭발하는 고양이 카드를 피하라! 전략과 운이 어우러진 초간단 카드 생존 게임",   "ruleUrl": "https://youtu.be/j0W0qH_ZCxs?si=v-2lfs5hb2zSBDfm", "image": "/images/g28.png"},
    {"id": "g29", "name": "스시고",            "players": "2-5인",  "difficulty": "쉬움",  "genre": "카드 / 전략",             "description": "회전 초밥처럼 카드를 돌리며 최고의 메뉴를 완성하라! 빠르고 귀여운 드래프팅 게임", "ruleUrl": "https://youtu.be/eTHyJNSQxrA?si=3aZOkeYcsvqWRvoz", "image": "/images/g29.png"},
    {"id": "g30", "name": "카르카손",          "players": "2-5인",  "difficulty": "보통",  "genre": "전략 / 타일 배치",        "description": "타일을 하나씩 놓아 중세 도시를 만들어라! 초보자도 쉽게 배우는 전략 타일 게임", "ruleUrl": "https://youtu.be/BPXDhcYqngE?si=4FP7zxsgk29EH98x", "image": "/images/g30.png"},
    {"id": "g31", "name": "킹오브도쿄",        "players": "2-6인",  "difficulty": "보통",  "genre": "전략 / 주사위",           "description": "도쿄를 차지한 괴물 왕이 돼라! 주사위를 굴려 공격하고 에너지를 모으는 전략 게임", "ruleUrl": "https://youtu.be/4otuFUHNbQY?si=pXgDoHiZCn55mZMB", "image": "/images/g31.png"},
    {"id": "g32", "name": "팬데믹",            "players": "2-4인",  "difficulty": "보통",  "genre": "전략 / 협력",             "description": "전 세계에 퍼진 바이러스를 막아라! 팀원과 함께하는 협력 전략 게임의 명작",      "ruleUrl": "https://youtu.be/urllnrCU_G0?si=vC-jqTBKY-yZMVhJ", "image": "/images/g32.png"},
    {"id": "g33", "name": "블러프",            "players": "2-6인",  "difficulty": "쉬움",  "genre": "마피아 / 주사위",         "description": "주사위를 굴리고 눈 수를 선언하라! 상대방의 거짓말을 잡아내는 블러핑 게임",     "ruleUrl": "https://youtu.be/t_EoZNb_pxU?si=Z5Qn2FXBEAywGsvv", "image": "/images/g33.png"},
    {"id": "g34", "name": "보난자",            "players": "2-7인",  "difficulty": "쉬움",  "genre": "카드 / 협상 / 다인용 게임",             "description": "콩 농사꾼이 돼서 거래로 부자가 돼라! 협상과 전략이 넘치는 콩 카드 게임",       "ruleUrl": "https://youtu.be/OwgKvBQ7bqs?si=cArVe3KWtxROn_ik", "image": "/images/g34.png"},
    {"id": "g35", "name": "티켓 투 라이드",    "players": "2-5인",  "difficulty": "보통",  "genre": "전략 / 노선",             "description": "기차 노선을 연결하라! 지도 위에서 펼치는 스마트한 전략 보드게임",              "ruleUrl": "https://youtu.be/_bDJg7wQ3Fg?si=yTAJeGqVx0tZfcGA", "image": "/images/g35.png"},
    {"id": "g36", "name": "7원더스",           "players": "3-7인",  "difficulty": "보통",  "genre": "전략 / 드래프팅 / 다인용 게임",         "description": "고대 7대 불가사의 중 하나를 이끌어라! 카드 드래프팅으로 문명을 발전시키는 전략 게임", "ruleUrl": "https://youtu.be/HBUMGsAP4Gc?si=1I-MScb1eD8dTh8I", "image": "/images/g36.png"},
    {"id": "g37", "name": "우봉고",            "players": "2-4인",  "difficulty": "쉬움",  "genre": "파티 / 퍼즐",             "description": "주어진 퍼즐 조각을 가장 빨리 맞춰라! 머리를 쓰는 스피드 퍼즐 게임",            "ruleUrl": "https://youtu.be/40bfM1oaBTI?si=MF6MGZl8E-SvY50e", "image": "/images/g37.png"},
]

MATCHES_DATA = [
    # 월요일
    {"id": "m1", "games": ["스플랜더", "카탄"], "difficulty": "보통", "tags": ["입문", "전략"], "date": "2026-05-11", "startTime": "19:00", "ruleVideoUrls": [], "location": {"venue": "레드버튼", "branch": "강남점", "address": "서울 강남구 강남대로 442"}, "participants": [{"nickname": "보드왕", "mannerScore": 6}], "maxPlayers": 4},
    {"id": "m2", "games": ["할리갈리", "젠가"], "difficulty": "쉬움", "tags": ["파티", "순발력"], "date": "2026-05-11", "startTime": "18:30", "ruleVideoUrls": [], "location": {"venue": "홈즈앤루팡", "branch": "홍대점", "address": "서울 마포구 홍익로3길 20"}, "participants": [], "maxPlayers": 6},
    # 화요일
    {"id": "m3", "games": ["루미큐브", "다빈치 코드"], "difficulty": "쉬움", "tags": ["추리", "두뇌"], "date": "2026-05-12", "startTime": "20:00", "ruleVideoUrls": [], "location": {"venue": "포퀸스", "branch": "건대점", "address": "서울 광진구 아차산로 224"}, "participants": [{"nickname": "추리천재", "mannerScore": 5}], "maxPlayers": 4},
    {"id": "m4", "games": ["아발론", "뱅!"], "difficulty": "보통", "tags": ["마피아", "심리전"], "date": "2026-05-12", "startTime": "19:00", "ruleVideoUrls": [], "location": {"venue": "레드버튼", "branch": "신촌점", "address": "서울 서대문구 연세로 8"}, "participants": [], "maxPlayers": 8},
    # 수요일
    {"id": "m5", "games": ["테라포밍 마스"], "difficulty": "매우 어려움", "tags": ["전략", "헤비"], "date": "2026-05-13", "startTime": "18:00", "ruleVideoUrls": [], "location": {"venue": "홈즈앤루팡", "branch": "잠실점", "address": "서울 송파구 백제고분로7길 22"}, "participants": [{"nickname": "화성인", "mannerScore": 6}], "maxPlayers": 4},
    {"id": "m6", "games": ["딕싯", "텔레스트레이션"], "difficulty": "쉬움", "tags": ["감성", "웃음"], "date": "2026-05-13", "startTime": "19:30", "ruleVideoUrls": [], "location": {"venue": "포퀸스", "branch": "수유점", "address": "서울 강북구 도봉로87길 14"}, "participants": [], "maxPlayers": 6},
    # 목요일
    {"id": "m7", "games": ["윙스팬", "코드네임"], "difficulty": "보통", "tags": ["힐링", "단어"], "date": "2026-05-14", "startTime": "19:00", "ruleVideoUrls": [], "location": {"venue": "레드버튼", "branch": "노원점", "address": "서울 노원구 상계로 74"}, "participants": [{"nickname": "조류박사", "mannerScore": 5}], "maxPlayers": 4},
    {"id": "m8", "games": ["부루마불", "달무티"], "difficulty": "쉬움", "tags": ["고전", "계급"], "date": "2026-05-14", "startTime": "18:00", "ruleVideoUrls": [], "location": {"venue": "홈즈앤루팡", "branch": "인천구월점", "address": "인천 남동구 인하로507번길 18"}, "participants": [], "maxPlayers": 5},
    # 금요일
    {"id": "m9", "games": ["카탄", "아발론"], "difficulty": "보통", "tags": ["협상", "마피아"], "date": "2026-05-15", "startTime": "20:00", "ruleVideoUrls": [], "location": {"venue": "포퀸스", "branch": "부평점", "address": "인천 부평구 시장로 24"}, "participants": [{"nickname": "협상의달인", "mannerScore": 6}], "maxPlayers": 6},
    {"id": "m10", "games": ["스플랜더", "루미큐브"], "difficulty": "보통", "tags": ["입문", "스테디셀러"], "date": "2026-05-15", "startTime": "19:00", "ruleVideoUrls": [], "location": {"venue": "레드버튼", "branch": "일산점", "address": "경기 고양시 일산동구 중앙로1261번길 57"}, "participants": [], "maxPlayers": 4},
    # 토요일
    {"id": "m11", "games": ["테라포밍 마스", "윙스팬"], "difficulty": "어려움", "tags": ["전략", "장기전"], "date": "2026-05-16", "startTime": "14:00", "ruleVideoUrls": [], "location": {"venue": "홈즈앤루팡", "branch": "수원역점", "address": "경기 수원시 팔달구 향교로 3"}, "participants": [{"nickname": "보드마니아", "mannerScore": 5}], "maxPlayers": 4},
    {"id": "m12", "games": ["텔레스트레이션", "할리갈리", "딕싯"], "difficulty": "쉬움", "tags": ["파티", "폭소"], "date": "2026-05-16", "startTime": "15:00", "ruleVideoUrls": [], "location": {"venue": "포퀸스", "branch": "의정부점", "address": "경기 의정부시 시민로121번길 34-1"}, "participants": [], "maxPlayers": 8},
    # 일요일
    {"id": "m13", "games": ["다빈치 코드", "뱅!"], "difficulty": "보통", "tags": ["추리", "심리전"], "date": "2026-05-17", "startTime": "14:00", "ruleVideoUrls": [], "location": {"venue": "레드버튼", "branch": "안양점", "address": "경기 안양시 만안구 만안로 222"}, "participants": [{"nickname": "주일보드", "mannerScore": 6}], "maxPlayers": 6},
    {"id": "m14", "games": ["스플랜더", "카탄", "루미큐브"], "difficulty": "보통", "tags": ["정석", "베스트"], "date": "2026-05-17", "startTime": "16:00", "ruleVideoUrls": [], "location": {"venue": "홈즈앤루팡", "branch": "분당점", "address": "경기 성남시 분당구 서현로 210"}, "participants": [], "maxPlayers": 4},
    {"id": "test_waiting", "games": ["아발론", "카탄"], "difficulty": "보통", "tags": ["테스트", "정산대기"], "date": "2026-05-13", "startTime": "13:35", "ruleVideoUrls": [], "location": {"venue": "테스트카페", "branch": "강남점", "address": "서울 강남구 강남대로 442"}, "participants": [{"nickname": "테스트유저1", "mannerScore": 5}], "maxPlayers": 5},
    {"id": "test_ready", "games": ["윙스팬", "카르카손"], "difficulty": "보통", "tags": ["테스트", "정산가능"], "date": "2026-05-13", "startTime": "13:10", "ruleVideoUrls": [], "location": {"venue": "테스트카페", "branch": "홍대점", "address": "서울 마포구 홍익로3길 20"}, "participants": [{"nickname": "테스트유저2", "mannerScore": 5}], "maxPlayers": 4},
    {"id": "m15", "games": ["다빈치 코드", "할리갈리", "젠가"], "difficulty": "쉬움", "tags": ["파티", "추리"], "date": "2026-05-13", "startTime": "21:00", "ruleVideoUrls": ["https://www.youtube.com/watch?v=6_rW_iK-mAI", "https://www.youtube.com/watch?v=_9J8W1_m89Y", "https://www.youtube.com/watch?v=f84E6hJ2-V0"], "location": {"venue": "레드버튼", "branch": "강남점", "address": "서울 강남구 강남대로 442"}, "participants": [], "maxPlayers": 4},
    {"id": "m16", "games": ["윙스팬", "코드네임", "딕싯"], "difficulty": "보통", "tags": ["힐링", "연상"], "date": "2026-05-14", "startTime": "18:00", "ruleVideoUrls": ["https://www.youtube.com/watch?v=vVEnrG8rI_s", "https://www.youtube.com/watch?v=fGfG16T7Zic", "https://www.youtube.com/watch?v=uHuYRzgzbL8"], "location": {"venue": "홈즈앤루팡", "branch": "홍대점", "address": "서울 마포구 홍익로3길 20"}, "participants": [], "maxPlayers": 6},
    {"id": "m17", "games": ["아컴호러 카드게임"], "difficulty": "매우 어려움", "tags": ["크툴루", "협력"], "date": "2026-05-15", "startTime": "19:00", "ruleVideoUrls": ["https://www.youtube.com/watch?v=vW-p3Q0_D2Y"], "location": {"venue": "보드게임카페 미플", "branch": "신촌점", "address": "서울 서대문구 신촌로 109"}, "participants": [], "maxPlayers": 4},
    {"id": "m18", "games": ["뱅!", "러브레터"], "difficulty": "쉬움", "tags": ["파티", "심리전"], "date": "2026-05-15", "startTime": "20:30", "ruleVideoUrls": [], "location": {"venue": "레드버튼", "branch": "수원역점", "address": "경기 수원시 팔달구 갓매산로 51"}, "participants": [], "maxPlayers": 7},
    {"id": "m19", "games": ["스플랜더 마블", "7 원더스 대결"], "difficulty": "보통", "tags": ["2인추천", "전략"], "date": "2026-05-16", "startTime": "14:00", "ruleVideoUrls": [], "location": {"venue": "홈즈앤루팡", "branch": "서현점", "address": "경기 성남시 분당구 황새울로360번길 12"}, "participants": [], "maxPlayers": 2},
    {"id": "m20", "games": ["카르카손", "티켓 투 라이드"], "difficulty": "보통", "tags": ["클래식", "가족"], "date": "2026-05-16", "startTime": "16:00", "ruleVideoUrls": [], "location": {"venue": "레드버튼", "branch": "범계점", "address": "경기 안양시 동안구 평촌대로223번길 52"}, "participants": [], "maxPlayers": 4},
    {"id": "m21", "games": ["팬데믹"], "difficulty": "보통", "tags": ["협력", "재난"], "date": "2026-05-17", "startTime": "13:00", "ruleVideoUrls": [], "location": {"venue": "히어로보드게임카페", "branch": "홍대점", "address": "서울 마포구 와우산로21길 31-10"}, "participants": [], "maxPlayers": 4},
    {"id": "m22", "games": ["잭스님트", "달무티"], "difficulty": "매우 쉬움", "tags": ["파티", "왁자지껄"], "date": "2026-05-17", "startTime": "15:00", "ruleVideoUrls": [], "location": {"venue": "레드버튼", "branch": "강남2호점", "address": "서울 강남구 강남대로96길 9"}, "participants": [], "maxPlayers": 8},
]

def seed_db(force_reset=False):
    db = SessionLocal()

    if force_reset:
        print("기존 데이터를 초기화합니다...")
        db.query(models.Message).delete()
        db.query(models.Review).delete()
        db.query(models.PointHistory).delete()
        db.query(models.MatchParticipant).delete()
        db.query(models.Match).delete()
        db.query(models.Game).delete()
        db.query(models.User).delete()
        db.commit()
        print("초기화 완료.")

    # 운영진 계정은 항상 보장 (게임 시드 스킵해도 별도로 체크).
    admin_email = "admin@boardway.io"
    admin = db.query(models.User).filter(models.User.email == admin_email).first()
    if not admin:
        db.add(models.User(
            email=admin_email,
            password=get_password_hash("admin123"),
            nickname="보드웨이운영",
            mannerScore=6,
            is_admin=True,
        ))
        db.commit()
        print(f"운영진 계정 생성: {admin_email} / admin123")

    # 게임은 upsert — 기존 row가 있으면 image·genre 등을 현재 GAMES_DATA로 업데이트,
    # 없으면 새로 삽입. 매치·유저 데이터는 건드리지 않음.
    print("게임 데이터 upsert 중...")
    existing_game_ids = {g.game_id for g in db.query(models.Game.game_id).all()}
    upsert_count = 0
    for g in GAMES_DATA:
        existing = db.query(models.Game).filter(models.Game.game_id == g["id"]).first()
        if existing:
            existing.name = g["name"]
            existing.players = g["players"]
            existing.difficulty = g["difficulty"]
            existing.genre = g.get("genre")
            existing.description = g["description"]
            existing.ruleUrl = g["ruleUrl"]
            existing.image = g["image"]
        else:
            db.add(models.Game(
                game_id=g["id"], name=g["name"], players=g["players"],
                difficulty=g["difficulty"], genre=g.get("genre"),
                description=g["description"], ruleUrl=g["ruleUrl"], image=g["image"]
            ))
        upsert_count += 1
    db.commit()
    print(f"게임 upsert 완료: {upsert_count}개")

    if db.query(models.Match).first():
        print("매치/유저 데이터가 이미 존재합니다. 매치 시딩을 건너뜁니다.")
        db.close()
        return

    print("매치·유저 초기 데이터 시딩을 시작합니다...")

    for m in MATCHES_DATA:
        resolved_date = _resolve_date(m["date"])
        db_match = models.Match(
            match_id=m["id"], games=m["games"], difficulty=m["difficulty"],
            tags=m["tags"], date=resolved_date, startTime=m["startTime"], ruleVideoUrls=m["ruleVideoUrls"],
            venue=m["location"]["venue"], branch=m["location"]["branch"],
            address=m["location"]["address"], maxPlayers=m["maxPlayers"]
        )
        db.add(db_match)
        db.commit()

        db.refresh(db_match)
        for p in m["participants"]:
            db.add(models.MatchParticipant(
                match_id=db_match.id, nickname=p["nickname"], mannerScore=p["mannerScore"]
            ))

    db.commit()
    print(f"시딩 완료! 게임 {len(GAMES_DATA)}개, 매칭 {len(MATCHES_DATA)}개 추가됨.")
    db.close()

if __name__ == "__main__":
    import sys
    force_reset = "--reset" in sys.argv
    if force_reset:
        confirm = input(
            "⚠️  --reset 플래그가 지정되었습니다. "
            "모든 데이터(사용자/매치/참가자)가 삭제됩니다. 계속하시겠습니까? (yes/no): "
        )
        if confirm.strip().lower() != "yes":
            print("취소되었습니다.")
            sys.exit(0)
    seed_db(force_reset=force_reset)
