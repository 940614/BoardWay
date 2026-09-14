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

import pdfplumber


RULEBOOKS = {
    "루미큐브.pdf": {"game_name": "루미큐브", "language": "ko"},
    "뱅 영문.pdf": {"game_name": "뱅!", "language": "en"},
    "스플랜더.pdf": {"game_name": "스플랜더", "language": "ko"},
    "카탄.pdf": {"game_name": "카탄", "language": "ko"},
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


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", type=Path, required=True)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "rag_data" / "rulebook_chunks.json",
    )
    args = parser.parse_args()
    chunks = []

    for filename, metadata in RULEBOOKS.items():
        source_path = args.input_dir / filename
        if not source_path.exists():
            print(f"건너뜀: {source_path}")
            continue
        with pdfplumber.open(source_path) as pdf:
            for page_number, page in enumerate(pdf.pages, start=1):
                page_text = clean_text(page.extract_text() or "")
                # 표지·쪽수처럼 검색 근거가 될 수 없는 아주 짧은 텍스트는 제외한다.
                if len(page_text) < 80:
                    print(f"텍스트 없음: {filename} p.{page_number}")
                    continue
                for chunk_index, chunk_text in enumerate(split_chunks(page_text), start=1):
                    chunks.append(
                        {
                            "id": f"{metadata['game_name']}-p{page_number}-{chunk_index}",
                            "game_name": metadata["game_name"],
                            "language": metadata["language"],
                            "source_file": filename,
                            "page": page_number,
                            "section": f"룰북 {page_number}페이지",
                            "text": chunk_text,
                        }
                    )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    payload = {"version": 1, "chunk_count": len(chunks), "chunks": chunks}
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{len(chunks)}개 청크 저장: {args.output}")


if __name__ == "__main__":
    main()
