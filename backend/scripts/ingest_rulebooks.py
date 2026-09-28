"""공식 룰북 PDF를 BoardWay 검색 청크 JSON으로 변환하는 일회성 도구.

사용 예시
  python scripts/ingest_rulebooks.py --input-dir "C:\\Users\\user\\Desktop\\보드게임룰"

원본 PDF는 저장하지 않고, 페이지별 텍스트 및 출처 메타데이터만
backend/rag_data/rulebook_chunks.json에 생성한다.
"""

import argparse
import json
import re
from pathlib import Path

from pypdf import PdfReader


# 도감에 등록된 기본판 게임명이다. 입력 폴더를 모두 순회하되, 이 목록에 없는
# PDF는 실수로 색인되는 일을 막기 위해 건너뛴다.
GAME_NAMES = {
    "스플랜더", "카탄", "루미큐브", "뱅!", "할리갈리", "다빈치 코드",
    "텔레스트레이션", "달무티", "아발론", "딕싯", "윙스팬", "코드네임",
    "테라포밍 마스", "젠가", "부루마불", "아줄", "라스베가스", "스컬킹",
    "클루", "레지스탕스 쿠", "패치워크", "러브레터", "바퀴벌레 포커 로얄",
    "도블", "우노", "노땡스", "사보타지", "익스플로딩 키튼", "스시고",
    "카르카손", "킹오브도쿄", "팬데믹", "블러프", "보난자", "티켓 투 라이드",
    "7원더스", "우봉고",
}

# 저장된 파일명과 도감 표기가 다른 경우만 별도로 맞춘다.
FILENAME_ALIASES = {
    "뱅 영문": "뱅!",
    "다빈치코드": "다빈치 코드",
    "부루마블": "부루마불",
    "팬대믹": "팬데믹",
    "바퀴벌레포커로얄": "바퀴벌레 포커 로얄",
    "쿠": "레지스탕스 쿠",
}

# 일부 룰북은 영문 또는 다국어 파일이다. 검색 모델은 다국어 임베딩을 사용한다.
ENGLISH_RULEBOOKS = {
    "뱅 영문", "딕싯", "윙스팬", "코드네임", "테라포밍 마스", "젠가", "아줄",
    "라스베가스", "스컬킹", "클루", "패치워크", "러브레터", "도블", "우노",
    "노땡스", "사보타지", "익스플로딩 키튼", "스시고", "카르카손", "킹오브도쿄",
    "보난자", "티켓 투 라이드", "우봉고",
}

# 일부 배포본은 이미지로만 구성되어 일반 PDF 텍스트 추출이 불가능하다.
# 이 경우 룰북을 사람이 확인해 작성한 핵심 규칙 요약을 검색 근거로 사용한다.
IMAGE_RULE_SUMMARIES = {
    "할리갈리": (
        "각 플레이어는 카드를 섞어 13장씩 뒷면으로 받고, 중앙에 종을 둔다. "
        "차례가 되면 자기 카드 더미의 맨 위 카드를 앞면으로 뒤집어 자기 버린 카드 더미에 놓는다. "
        "모든 버린 카드 더미의 맨 위 카드만 보고 같은 과일이 정확히 5개가 되면 가장 먼저 종을 친 사람이 "
        "테이블의 모든 버린 카드 더미를 가져가 자기 카드 더미 아래에 넣는다. 과일이 5개가 아닌데 종을 치면 "
        "벌칙으로 모든 플레이어에게 카드 1장씩을 나눠 준다. 카드가 모두 떨어진 플레이어는 탈락하며, 게임 종료 시 "
        "가장 많은 카드를 가진 플레이어가 승리한다."
    ),
    "젠가": (
        "54개의 나무 블록으로 한 층에 3개씩, 층마다 방향을 번갈아 가며 탑을 만든다. "
        "차례에는 한 손만 사용해 가장 높은 완성된 층 아래에서 블록 하나를 빼고, 탑 맨 위에 올린다. "
        "새 층을 시작하기 전에는 그 아래 층을 완성해야 한다. 블록을 올린 뒤 5초 동안 탑이 무너지지 않으면 다음 차례로 넘어가며, "
        "탑을 무너뜨린 플레이어는 탈락한다. 탑을 무너뜨리지 않고 마지막으로 블록 쌓기에 성공한 플레이어가 승리한다."
    ),
}
CHUNK_SIZE = 850
CHUNK_OVERLAP = 140


def clean_text(text: str) -> str:
    text = text.replace("\u00a0", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def split_chunks(text: str) -> list[str]:
    """문단 경계를 우선으로 유지하며 긴 페이지를 겹치는 청크로 나눈다."""
    if len(text) <= CHUNK_SIZE:
        return [text]
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + CHUNK_SIZE, len(text))
        if end < len(text):
            boundary = max(text.rfind("\n", start, end), text.rfind(". ", start, end))
            if boundary > start + CHUNK_SIZE // 2:
                end = boundary + 1
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(text):
            break
        start = max(end - CHUNK_OVERLAP, start + 1)
    return chunks


def rulebook_metadata(source_path: Path) -> dict[str, str] | None:
    """파일명을 도감 게임명으로 연결한다."""
    filename_stem = source_path.stem.strip()
    game_name = FILENAME_ALIASES.get(filename_stem, filename_stem)
    if game_name not in GAME_NAMES:
        return None
    return {
        "game_name": game_name,
        "language": "en" if filename_stem in ENGLISH_RULEBOOKS else "ko",
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", type=Path, required=True)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "rag_data" / "rulebook_chunks.json",
    )
    parser.add_argument(
        "--games",
        nargs="*",
        help="지정한 도감 게임만 변환한다. 긴 변환 작업을 나누어 실행할 때 사용한다.",
    )
    parser.add_argument(
        "--append",
        action="store_true",
        help="기존 출력 JSON에 새 게임 청크를 추가한다.",
    )
    args = parser.parse_args()
    selected_games = set(args.games or GAME_NAMES)
    unknown_games = selected_games - GAME_NAMES
    if unknown_games:
        parser.error(f"도감에 없는 게임명: {', '.join(sorted(unknown_games))}")

    chunks = []
    if args.append and args.output.exists():
        previous_payload = json.loads(args.output.read_text(encoding="utf-8"))
        chunks = [
            chunk
            for chunk in previous_payload.get("chunks", [])
            if chunk.get("game_name") not in selected_games
        ]

    indexed_games = {chunk["game_name"] for chunk in chunks}
    for source_path in sorted(args.input_dir.glob("*.pdf")):
        metadata = rulebook_metadata(source_path)
        if metadata is None:
            print(f"도감 미등록 파일 건너뜀: {source_path.name}")
            continue
        if metadata["game_name"] not in selected_games:
            continue
        try:
            chunk_count_before = len(chunks)
            reader = PdfReader(source_path)
            for page_number, page in enumerate(reader.pages, start=1):
                page_text = clean_text(page.extract_text() or "")
                # 표지·쪽수처럼 검색 근거가 될 수 없는 아주 짧은 텍스트는 제외한다.
                if len(page_text) < 80:
                    print(f"텍스트 없음: {source_path.name} p.{page_number}")
                    continue
                for chunk_index, chunk_text in enumerate(split_chunks(page_text), start=1):
                    chunks.append(
                        {
                            "id": f"{metadata['game_name']}-p{page_number}-{chunk_index}",
                            "game_name": metadata["game_name"],
                            "language": metadata["language"],
                            "source_file": source_path.name,
                            "page": page_number,
                            "section": f"룰북 {page_number}페이지",
                            "text": chunk_text,
                        }
                    )
            if len(chunks) == chunk_count_before and metadata["game_name"] in IMAGE_RULE_SUMMARIES:
                chunks.append(
                    {
                        "id": f"{metadata['game_name']}-image-summary-1",
                        "game_name": metadata["game_name"],
                        "language": "ko",
                        "source_file": source_path.name,
                        "page": 1,
                        "section": "룰북 이미지 요약",
                        "text": IMAGE_RULE_SUMMARIES[metadata["game_name"]],
                    }
                )
            indexed_games.add(metadata["game_name"])
        except Exception as exc:
            print(f"읽기 실패: {source_path.name} ({exc})")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "version": 2,
        "game_count": len(indexed_games),
        "chunk_count": len(chunks),
        "chunks": chunks,
    }
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{len(indexed_games)}개 게임, {len(chunks)}개 청크 저장: {args.output}")


if __name__ == "__main__":
    main()
