import models
from database import engine, SessionLocal, Base

# DB 테이블 생성
Base.metadata.create_all(bind=engine)

GAMES_DATA = [
    {"id": "g1", "name": "스플랜더", "players": "2-4인", "difficulty": "보통", "description": "보석을 모아 카드를 사고 점수를 획득하는 최고의 입문용 전략 게임", "ruleUrl": "https://www.youtube.com/embed/3Y-VZ3pCSlw", "image": "/images/g1.png"},
    {"id": "g2", "name": "카탄", "players": "3-4인", "difficulty": "어려움", "description": "무인도에서 자원을 채집하고 거래하며 마을을 건설하는 고전 명작", "ruleUrl": "https://www.youtube.com/embed/37V2ajpMEic", "image": "/images/g2.png"},
    {"id": "g3", "name": "루미큐브", "players": "2-4인", "difficulty": "쉬움", "description": "숫자 조합을 통해 손에 든 타일을 가장 먼저 털어내는 지능형 게임", "ruleUrl": "https://www.youtube.com/embed/uHuYRzgzbL8", "image": "/images/g3.png"},
    {"id": "g4", "name": "뱅!", "players": "4-7인", "difficulty": "보통", "description": "보안관과 무법자의 치열한 대결! 서부 시대를 배경으로 한 마피아 카드 게임", "ruleUrl": "https://www.youtube.com/embed/7-VvKjF_f00", "image": "/images/g4.png"},
    {"id": "g5", "name": "할리갈리", "players": "2-6인", "difficulty": "쉬움", "description": "과일 5개가 모이면 종을 쳐라! 순발력 게임의 대명사", "ruleUrl": "https://www.youtube.com/embed/_9J8W1_m89Y", "image": "/images/g5.png"},
    {"id": "g6", "name": "다빈치 코드", "players": "2-4인", "difficulty": "쉬움", "description": "상대방의 숫자를 추리해서 모두 맞혀라! 간단하지만 심오한 숫자 추리 게임", "ruleUrl": "https://www.youtube.com/embed/6_rW_iK-mAI", "image": "/images/g6.png"},
    {"id": "g7", "name": "텔레스트레이션", "players": "4-8인", "difficulty": "쉬움", "description": "그림으로 말해요! 웃음이 끊이지 않는 최고의 파티 드로잉 게임", "ruleUrl": "https://www.youtube.com/embed/VhN-fT3wLTo", "image": "/images/g7.png"},
    {"id": "g8", "name": "달무티", "players": "4-8인", "difficulty": "쉬움", "description": "인생은 불공평합니다! 계급 사회를 풍자한 중독성 강한 카드 게임", "ruleUrl": "https://www.youtube.com/embed/G68eS9-F5iM", "image": "/images/g8.png"},
    {"id": "g9", "name": "아발론", "players": "5-10인", "difficulty": "보통", "description": "아서 왕의 충신과 모드레드의 하수인! 마피아 게임의 정점", "ruleUrl": "https://www.youtube.com/embed/3-M-Q8v8_1Y", "image": "/images/g9.png"},
    {"id": "g10", "name": "딕싯", "players": "3-6인", "difficulty": "쉬움", "description": "한 편의 시 같은 그림 카드로 소통하는 감성적인 스토리텔링 게임", "ruleUrl": "https://www.youtube.com/embed/uHuYRzgzbL8", "image": "/images/g10.png"},
    {"id": "g11", "name": "윙스팬", "players": "1-5인", "difficulty": "보통", "description": "아름다운 새들을 내 서식지로 불러모으는 힐링 전략 게임", "ruleUrl": "https://www.youtube.com/embed/vVEnrG8rI_s", "image": "/images/g11.png"},
    {"id": "g12", "name": "코드네임", "players": "2-8인", "difficulty": "쉬움", "description": "단어 하나로 팀원에게 정답을 알려라! 팀 대항 단어 연상 게임", "ruleUrl": "https://www.youtube.com/embed/fGfG16T7Zic", "image": "/images/g12.png"},
    {"id": "g13", "name": "테라포밍 마스", "players": "1-5인", "difficulty": "매우 어려움", "description": "화성을 인간이 살 수 있는 곳으로! 보드게이머들이 가장 사랑하는 전략 게임", "ruleUrl": "https://www.youtube.com/embed/8-z3yBPlr_E", "image": "/images/g13.png"},
    {"id": "g14", "name": "젠가", "players": "1-10인", "difficulty": "쉬움", "description": "블록을 하나씩 빼서 위로 쌓아라! 아슬아슬한 긴장감의 파티 게임", "ruleUrl": "https://www.youtube.com/embed/f84E6hJ2-V0", "image": "/images/g14.png"},
    {"id": "g15", "name": "부루마불", "players": "2-4인", "difficulty": "쉬움", "description": "전 세계를 누비며 땅을 사고 건물을 짓는 추억의 국민 보드게임", "ruleUrl": "https://www.youtube.com/embed/f84E6hJ2-V0", "image": "/images/g15.png"},
]

MATCHES_DATA = [
    # 월요일
    {"id": "m1", "games": ["스플랜더", "카탄"], "difficulty": "보통", "tags": ["입문", "전략"], "date": "2026-05-11", "startTime": "19:00", "ruleVideoUrls": [], "location": {"venue": "레드버튼", "branch": "강남점", "address": "서울 강남구"}, "participants": [{"nickname": "보드왕", "mannerScore": 6}], "maxPlayers": 4},
    {"id": "m2", "games": ["할리갈리", "젠가"], "difficulty": "쉬움", "tags": ["파티", "순발력"], "date": "2026-05-11", "startTime": "18:30", "ruleVideoUrls": [], "location": {"venue": "홈즈앤루팡", "branch": "홍대점", "address": "서울 마포구"}, "participants": [], "maxPlayers": 6},
    # 화요일
    {"id": "m3", "games": ["루미큐브", "다빈치 코드"], "difficulty": "쉬움", "tags": ["추리", "두뇌"], "date": "2026-05-12", "startTime": "20:00", "ruleVideoUrls": [], "location": {"venue": "포퀸스", "branch": "건대점", "address": "서울 광진구"}, "participants": [{"nickname": "추리천재", "mannerScore": 5}], "maxPlayers": 4},
    {"id": "m4", "games": ["아발론", "뱅!"], "difficulty": "보통", "tags": ["마피아", "심리전"], "date": "2026-05-12", "startTime": "19:00", "ruleVideoUrls": [], "location": {"venue": "레드버튼", "branch": "신촌점", "address": "서울 서대문구"}, "participants": [], "maxPlayers": 8},
    # 수요일
    {"id": "m5", "games": ["테라포밍 마스"], "difficulty": "매우 어려움", "tags": ["전략", "헤비"], "date": "2026-05-13", "startTime": "18:00", "ruleVideoUrls": [], "location": {"venue": "홈즈앤루팡", "branch": "잠실점", "address": "서울 송파구"}, "participants": [{"nickname": "화성인", "mannerScore": 6}], "maxPlayers": 4},
    {"id": "m6", "games": ["딕싯", "텔레스트레이션"], "difficulty": "쉬움", "tags": ["감성", "웃음"], "date": "2026-05-13", "startTime": "19:30", "ruleVideoUrls": [], "location": {"venue": "포퀸스", "branch": "수유점", "address": "서울 강북구"}, "participants": [], "maxPlayers": 6},
    # 목요일
    {"id": "m7", "games": ["윙스팬", "코드네임"], "difficulty": "보통", "tags": ["힐링", "단어"], "date": "2026-05-14", "startTime": "19:00", "ruleVideoUrls": [], "location": {"venue": "레드버튼", "branch": "노원점", "address": "서울 노원구"}, "participants": [{"nickname": "조류박사", "mannerScore": 5}], "maxPlayers": 4},
    {"id": "m8", "games": ["부루마불", "달무티"], "difficulty": "쉬움", "tags": ["고전", "계급"], "date": "2026-05-14", "startTime": "18:00", "ruleVideoUrls": [], "location": {"venue": "홈즈앤루팡", "branch": "인천구월점", "address": "인천 남동구"}, "participants": [], "maxPlayers": 5},
    # 금요일
    {"id": "m9", "games": ["카탄", "아발론"], "difficulty": "보통", "tags": ["협상", "마피아"], "date": "2026-05-15", "startTime": "20:00", "ruleVideoUrls": [], "location": {"venue": "포퀸스", "branch": "부평점", "address": "인천 부평구"}, "participants": [{"nickname": "협상의달인", "mannerScore": 6}], "maxPlayers": 6},
    {"id": "m10", "games": ["스플랜더", "루미큐브"], "difficulty": "보통", "tags": ["입문", "스테디셀러"], "date": "2026-05-15", "startTime": "19:00", "ruleVideoUrls": [], "location": {"venue": "레드버튼", "branch": "일산점", "address": "경기 고양시"}, "participants": [], "maxPlayers": 4},
    # 토요일
    {"id": "m11", "games": ["테라포밍 마스", "윙스팬"], "difficulty": "어려움", "tags": ["전략", "장기전"], "date": "2026-05-16", "startTime": "14:00", "ruleVideoUrls": [], "location": {"venue": "홈즈앤루팡", "branch": "수원역점", "address": "경기 수원시"}, "participants": [{"nickname": "보드마니아", "mannerScore": 5}], "maxPlayers": 4},
    {"id": "m12", "games": ["텔레스트레이션", "할리갈리", "딕싯"], "difficulty": "쉬움", "tags": ["파티", "폭소"], "date": "2026-05-16", "startTime": "15:00", "ruleVideoUrls": [], "location": {"venue": "포퀸스", "branch": "의정부점", "address": "경기 의정부시"}, "participants": [], "maxPlayers": 8},
    # 일요일
    {"id": "m13", "games": ["다빈치 코드", "뱅!"], "difficulty": "보통", "tags": ["추리", "심리전"], "date": "2026-05-17", "startTime": "14:00", "ruleVideoUrls": [], "location": {"venue": "레드버튼", "branch": "안양점", "address": "경기 안양시"}, "participants": [{"nickname": "주일보드", "mannerScore": 6}], "maxPlayers": 6},
    {"id": "m14", "games": ["스플랜더", "카탄", "루미큐브"], "difficulty": "보통", "tags": ["정석", "베스트"], "date": "2026-05-17", "startTime": "16:00", "ruleVideoUrls": [], "location": {"venue": "홈즈앤루팡", "branch": "분당점", "address": "경기 성남시"}, "participants": [], "maxPlayers": 4},
    {"id": "m15", "games": ["다빈치 코드", "할리갈리", "젠가"], "difficulty": "쉬움", "tags": ["파티", "추리"], "date": "2026-05-11", "startTime": "21:00", "ruleVideoUrls": ["https://www.youtube.com/watch?v=6_rW_iK-mAI", "https://www.youtube.com/watch?v=_9J8W1_m89Y", "https://www.youtube.com/watch?v=f84E6hJ2-V0"], "location": {"venue": "레드버튼", "branch": "강남점", "address": "서울 강남구"}, "participants": [], "maxPlayers": 4},
    {"id": "m16", "games": ["윙스팬", "코드네임", "딕싯"], "difficulty": "보통", "tags": ["힐링", "연상"], "date": "2026-05-12", "startTime": "18:00", "ruleVideoUrls": ["https://www.youtube.com/watch?v=vVEnrG8rI_s", "https://www.youtube.com/watch?v=fGfG16T7Zic", "https://www.youtube.com/watch?v=uHuYRzgzbL8"], "location": {"venue": "홈즈앤루팡", "branch": "홍대점", "address": "서울 마포구"}, "participants": [], "maxPlayers": 6},
]

def seed_db(force_reset=False):
    db = SessionLocal()

    if force_reset:
        print("기존 데이터를 초기화합니다...")
        db.query(models.MatchParticipant).delete()
        db.query(models.Match).delete()
        db.query(models.Game).delete()
        db.query(models.User).delete()
        db.commit()
        print("초기화 완료.")

    if db.query(models.Game).first():
        print("데이터베이스에 이미 데이터가 존재합니다. 시딩을 건너뜁니다.")
        db.close()
        return

    print("초기 데이터 시딩을 시작합니다...")

    for g in GAMES_DATA:
        db.add(models.Game(
            game_id=g["id"], name=g["name"], players=g["players"],
            difficulty=g["difficulty"], description=g["description"],
            ruleUrl=g["ruleUrl"], image=g["image"]
        ))

    for m in MATCHES_DATA:
        db_match = models.Match(
            match_id=m["id"], games=m["games"], difficulty=m["difficulty"],
            tags=m["tags"], date=m["date"], startTime=m["startTime"], ruleVideoUrls=m["ruleVideoUrls"],
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
    seed_db(force_reset=True)
