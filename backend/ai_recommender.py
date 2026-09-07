"""사전학습 문장 임베딩 모델을 이용한 BoardWay 개인화 추천 도우미.

규칙 점수만 계산하는 방식과 달리, 이 모듈은 사용자 선호와 매칭 설명을
다국어 문장 임베딩으로 변환한 뒤 코사인 유사도를 계산한다.
"""

import os
from functools import lru_cache
from typing import Iterable


DEFAULT_MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"


@lru_cache(maxsize=1)
def get_embedding_model():
    """모델은 첫 AI 추천 요청 때 한 번만 메모리에 적재한다."""
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError as exc:
        raise RuntimeError(
            "AI 추천 패키지가 설치되지 않았습니다. requirements.txt를 다시 배포해주세요."
        ) from exc

    model_name = os.getenv("AI_RECOMMENDER_MODEL", DEFAULT_MODEL_NAME)
    return SentenceTransformer(model_name, device="cpu")


def _join(values: Iterable[str]) -> str:
    return ", ".join(str(value).strip() for value in values if str(value).strip()) or "미설정"


def build_profile_text(user) -> str:
    """카테고리형 프로필을 임베딩 모델이 이해할 수 있는 한국어 문장으로 만든다."""
    return (
        "보드게임 매칭을 찾는 사용자. "
        f"선호 장르: {_join(user.preferred_genres or [])}. "
        f"선호 지역: {_join(user.preferred_locations or [])}. "
        f"참여 가능 요일: {_join(user.preferred_days or [])}. "
        f"선호 시간대: {_join(user.preferred_time_slots or [])}. "
        f"선호 인원: {_join(user.preferred_player_counts or [])}. "
        f"선호 난이도: {_join(user.preferred_difficulties or [])}."
    )


def build_match_text(match, game_genres: dict[str, str], weekday: str, time_slot: str | None, player_group: str) -> str:
    """매칭 메타데이터를 검색 대상 문장으로 변환한다."""
    game_names = _join(match.games or [])
    genre_text = _join(game_genres.get(game_name, "") for game_name in (match.games or []))
    tags = _join(match.tags or [])
    location = " ".join(value for value in [match.venue, match.branch, match.address] if value)
    return (
        "오프라인 보드게임 매칭. "
        f"게임: {game_names}. 장르 및 태그: {genre_text}, {tags}. "
        f"장소: {location or '미설정'}. "
        f"요일: {weekday or '미설정'}. 시간대: {time_slot or '미설정'}. "
        f"인원: {player_group}. 난이도: {match.difficulty or '미설정'}."
    )


def semantic_similarities(profile_text: str, match_texts: list[str]) -> list[float]:
    """정규화된 문장 임베딩의 내적으로 코사인 유사도를 반환한다."""
    if not match_texts:
        return []

    model = get_embedding_model()
    embeddings = model.encode(
        [profile_text, *match_texts],
        normalize_embeddings=True,
        show_progress_bar=False,
        convert_to_numpy=True,
    )
    profile_embedding = embeddings[0]
    return [max(0.0, min(1.0, float(profile_embedding @ match_embedding))) for match_embedding in embeddings[1:]]
