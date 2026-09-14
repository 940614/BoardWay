"""BoardWay 룰북 도우미의 검색 및 근거 기반 답변 기능.

원본 PDF는 배포물에 포함하지 않는다. ``rag_data/rulebook_chunks.json``에
게임명·페이지·언어가 기록된 텍스트 청크만 보관하고, 질문마다 관련 청크를
검색한다. OPENAI_API_KEY가 설정되면 검색 근거를 Responses API에 전달해
한국어 답변을 생성한다. 키가 없을 때도 검색 결과를 그대로 돌려주므로,
개발 환경에서 RAG 검색 품질을 먼저 확인할 수 있다.
"""

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

from ai_recommender import get_embedding_model


DATA_PATH = Path(__file__).resolve().parent / "rag_data" / "rulebook_chunks.json"
MAX_QUESTION_LENGTH = 400
TOP_K = 4


def _normalise(value: str) -> str:
    return "".join(char for char in (value or "").lower() if char.isalnum())


@lru_cache(maxsize=1)
def load_chunks() -> tuple[dict[str, Any], ...]:
    """배포된 검색 청크를 한 번만 읽는다."""
    if not DATA_PATH.exists():
        return tuple()
    with DATA_PATH.open("r", encoding="utf-8") as file:
        payload = json.load(file)
    return tuple(payload.get("chunks", []))


def has_rulebook(game_name: str) -> bool:
    target = _normalise(game_name)
    return any(_normalise(chunk.get("game_name", "")) == target for chunk in load_chunks())


@lru_cache(maxsize=1)
def _chunk_embeddings():
    """청크 임베딩은 첫 룰북 질문 때만 계산해 메모리에 보관한다."""
    chunks = load_chunks()
    if not chunks:
        return None
    model = get_embedding_model()
    texts = [chunk["text"] for chunk in chunks]
    return model.encode(
        texts,
        normalize_embeddings=True,
        show_progress_bar=False,
        convert_to_numpy=True,
    )


def retrieve(game_name: str, question: str, top_k: int = TOP_K) -> list[dict[str, Any]]:
    """해당 게임 룰북에서 질문과 의미상 가까운 페이지 단락을 찾는다."""
    chunks = load_chunks()
    target = _normalise(game_name)
    candidate_indexes = [
        index for index, chunk in enumerate(chunks)
        if _normalise(chunk.get("game_name", "")) == target
    ]
    if not candidate_indexes:
        return []

    embeddings = _chunk_embeddings()
    if embeddings is None:
        return []

    model = get_embedding_model()
    question_embedding = model.encode(
        [question], normalize_embeddings=True, show_progress_bar=False, convert_to_numpy=True
    )[0]
    scored = [
        (float(question_embedding @ embeddings[index]), index)
        for index in candidate_indexes
    ]
    scored.sort(reverse=True)

    results = []
    for score, index in scored[:top_k]:
        chunk = chunks[index]
        results.append({
            "game_name": chunk["game_name"],
            "page": chunk["page"],
            "section": chunk.get("section", "룰북"),
            "source_file": chunk["source_file"],
            "language": chunk.get("language", "unknown"),
            "text": chunk["text"],
            "similarity": round(max(0.0, min(1.0, score)), 3),
        })
    return results


def _extract_output_text(payload: dict[str, Any]) -> str:
    """Responses API 응답에서 출력 텍스트를 안전하게 꺼낸다."""
    if payload.get("output_text"):
        return str(payload["output_text"]).strip()
    fragments: list[str] = []
    for item in payload.get("output", []):
        for content in item.get("content", []):
            if content.get("type") == "output_text" and content.get("text"):
                fragments.append(str(content["text"]))
    return "\n".join(fragments).strip()


def _generate_with_openai(game_name: str, question: str, sources: list[dict[str, Any]]) -> str | None:
    """검색된 문단 밖의 내용을 만들지 않도록 LLM 생성 범위를 제한한다."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None
    try:
        import requests
    except ImportError:
        print("룰북 도우미 LLM 생성 패키지(requests)가 설치되지 않았습니다.")
        return None

    context = "\n\n".join(
        f"[출처 {index + 1}: {item['source_file']} p.{item['page']}, {item['section']}]\n{item['text']}"
        for index, item in enumerate(sources)
    )
    instructions = (
        "당신은 BoardWay의 보드게임 룰북 도우미입니다. 반드시 제공된 룰북 발췌문만 "
        "근거로 사용해 한국어로 간결하게 답하세요. 발췌문에 답이 없거나 불확실하면 "
        "'등록된 룰북 근거에서 확인하지 못했습니다.'라고 답하세요. 추측, 일반 상식, "
        "외부 정보는 사용하지 마세요. 답변 뒤에 [출처 1]처럼 근거 번호를 붙이세요."
    )
    body = {
        "model": os.getenv("RAG_LLM_MODEL", "gpt-4.1-mini"),
        "instructions": instructions,
        "input": f"게임: {game_name}\n질문: {question}\n\n룰북 발췌문:\n{context}",
        "store": False,
        "max_output_tokens": 450,
    }
    try:
        response = requests.post(
            "https://api.openai.com/v1/responses",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=body,
            timeout=25,
        )
        response.raise_for_status()
        return _extract_output_text(response.json()) or None
    except requests.RequestException as exc:
        # 서비스가 룰북 검색 자체를 멈추지 않도록 생성 실패 시 추출형 응답으로 전환한다.
        print(f"룰북 도우미 LLM 생성 실패: {exc}")
        return None


def answer_question(game_name: str, question: str) -> dict[str, Any]:
    question = (question or "").strip()
    if not question:
        raise ValueError("질문을 입력해주세요.")
    if len(question) > MAX_QUESTION_LENGTH:
        raise ValueError(f"질문은 {MAX_QUESTION_LENGTH}자 이하로 입력해주세요.")

    sources = retrieve(game_name, question)
    if not sources:
        return {
            "answer": "등록된 룰북에서 이 질문과 관련된 근거를 찾지 못했습니다. 질문을 더 구체적으로 입력해 주세요.",
            "sources": [],
            "generation": "retrieval",
        }

    generated_answer = _generate_with_openai(game_name, question, sources)
    if generated_answer:
        return {"answer": generated_answer, "sources": sources, "generation": "llm"}

    # API 키가 없는 개발 환경에서도 실제 검색 결과를 확인할 수 있는 안전한 폴백이다.
    excerpts = "\n\n".join(
        f"{item['text'][:700]}\n[출처 {index + 1}]"
        for index, item in enumerate(sources[:2])
    )
    return {
        "answer": "AI 답변 API가 설정되지 않아, 검색된 룰북 근거를 보여드립니다.\n\n" + excerpts,
        "sources": sources,
        "generation": "retrieval",
    }
