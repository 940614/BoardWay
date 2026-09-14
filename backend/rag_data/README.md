# BoardWay 룰북 RAG 데이터

`rulebook_chunks.json`은 로컬에 보관한 룰북 PDF에서 추출한 검색 청크입니다.
원본 룰북과 추출 청크는 저작권·이용 허가를 확인하기 전까지 Git에 올리지 않습니다.

로컬 데이터 생성:

```powershell
python scripts/ingest_rulebooks.py --input-dir "C:\Users\user\Desktop\보드게임룰"
```

생성 파일에는 게임명, 언어, 원본 파일명, 페이지, 텍스트 청크가 포함됩니다. 공개 배포 시에는
퍼블리셔의 사용 허가를 받거나, 직접 작성해 검수한 규칙 요약 데이터로 교체해야 합니다.
