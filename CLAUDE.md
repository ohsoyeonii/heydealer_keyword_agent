# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

헤이딜러 SA 키워드 에이전트 — Google Sheets의 광고 RAW 데이터를 읽어 전환 키워드를 추출하고, Claude API로 유사/신규 키워드를 추천하는 웹 대시보드.

- **백엔드**: FastAPI (Python 3.14, `backend/`)
- **프론트엔드**: React + TypeScript + Vite (포트 3000, `frontend/`)
- **데이터 소스**: Google Sheets (`RAW` 시트, `MO_SELL_APP 검색어 RAW` 시트)

---

## 실행 명령어

### 전체 실행 (PowerShell)
```powershell
.\dev.ps1
```
백엔드(8000)와 프론트엔드(3000)를 별도 창에서 동시 실행.

### 백엔드 단독
```powershell
cd backend
.venv\Scripts\Activate.ps1
uvicorn main:app --reload --port 8000
```

### 프론트엔드 단독
```powershell
cd frontend
npm run dev
```

### 타입 체크 (프론트엔드)
```powershell
cd frontend
npx tsc --noEmit
```

### 의존성 설치 주의 (Python 3.14)
Python 3.14 환경에서는 Rust/C 빌드 도구 없이 소스 빌드가 불가능한 패키지가 있으므로 **반드시** `--only-binary=:all:` 사용:
```powershell
.venv\Scripts\pip.exe install --only-binary=:all: <패키지명>
```

---

## 환경 설정

`backend/.env` 파일 필수 (`.env.example` 참고):
```
GOOGLE_CREDENTIALS_PATH=<서비스 계정 JSON 키 절대 경로>
SPREADSHEET_ID=<Google Sheets ID>
ANTHROPIC_API_KEY=<Anthropic API 키>
```

설정 데이터(브랜드 컨텍스트, 네거티브 키워드, 등록 키워드)는 `backend/config_data/`에 JSON/텍스트 파일로 저장됨. 이 디렉토리는 런타임에 자동 생성된다.

---

## 아키텍처 및 데이터 흐름

```
Google Sheets (RAW 시트)
  → sheets_client.get_all_values()       # gspread로 읽기
  → report_parser.fetch_raw_data()       # 날짜 범위 필터 + 숫자 파싱
  → report_parser.aggregate_by_keyword() # (keyword, media, campaign, ad_group) 키로 합산
  → FastAPI 응답 → React 프론트엔드 (필터링/집계는 프론트에서 처리)
```

`extract_conversion_keywords()`는 키워드 추천(`/api/keywords/recommend`) 전처리에서만 사용됨. 전환 키워드 탭의 필터링은 백엔드에서 `conversions >= 1` 단순 조건으로 처리.

### 핵심 파일 역할

| 파일 | 역할 |
|---|---|
| `sheets_client.py` | Google Sheets 연결. `get_client()`는 `lru_cache`로 연결 재사용 |
| `report_parser.py` | RAW 시트 파싱. 헤더 행 동적 탐색 (`Year` 컬럼 위치 검색). 쉼표 포함 숫자(`1,234`) 처리 |
| `keyword_extractor.py` | 전환 키워드 필터링 (추천용). 네거티브는 부분 문자열 매칭, 등록 키워드는 정확 매칭 |
| `recommender.py` | Claude API 추천. 응답은 항상 JSON으로 받아 파싱. 할루시네이션 방지를 위해 JSON 스키마 엄격 준수 |
| `csv_exporter.py` | 매체별 CSV 포맷 변환. `FORMAT_MAP` dict로 포맷 전략 선택 |
| `config.py` | 브랜드 컨텍스트·네거티브·등록 키워드 파일 읽기/쓰기 |

### Google Sheets 시트 구조

**RAW 시트** (주 데이터):
- 컬럼 인덱스: `0=Year, 1=Month, 2=weeknum, 3=Date, 4=매체, 5=디바이스, 6=캠페인, 7=광고그룹, 8=키워드, 9=cost, 10=imp, 11=clicks, 12=노출순위, 13=Install, 14=견적요청`
- 컬럼 12는 `전환율`이 **아니라** `노출순위`(광고 노출 순위). 코드 내 변수명 `cvr`로 표기되어 있으나 실제로는 순위 값이며 집계 계산에 사용되지 않음.
- 전환 기준: 인덱스 14 `견적요청` 컬럼
- 비용 포맷: 쉼표 포함 문자열 (`202,027`) → `re.sub(r"[,\s]", "", val)` 로 파싱

**MO_SELL_APP 검색어 RAW 시트**:
- 컬럼 순서: `매체, 디바이스, 광고그룹, 키워드분류, 검색어, cost, imp, clicks, 전환율`
- 전환 수 직접 없음 → `cvr * clicks / 100` 으로 추정

### aggregate_by_keyword 집계 키

```python
key = (r.keyword, r.media, r.campaign, r.ad_group)
```

캠페인을 키에 포함해야 함. 같은 매체 내 MO_SELL_APP_KAKAO / MO_SELL_APP_NEW 캠페인이 동일한 광고그룹·키워드를 공유하므로, campaign을 빼면 두 캠페인 데이터가 잘못 합산된다.

### API 엔드포인트

| 엔드포인트 | 역할 |
|---|---|
| `GET /api/performance` | 전체 키워드 성과 (전 기간 전체, 제한 없음) |
| `GET /api/keywords/conversion` | 견적요청 ≥ 1인 키워드만 반환 |
| `POST /api/keywords/recommend` | Claude API 키워드 추천 (20~40초 소요) |
| `GET /api/report/insight` | AI 인사이트 리포트 (마크다운) |
| `POST /api/download/csv?media=naver\|google\|meta` | 매체별 CSV 다운로드 |
| `GET /api/search-queries` | 검색어 RAW 데이터 |
| `GET/POST /api/config/*` | 브랜드/네거티브/등록 키워드 설정 |

날짜 파라미터 미입력 시 최근 30일(오늘 기준 `today - 29`)이 기본값.

---

## 프론트엔드 필터 구조

`App.tsx`에 매체 → 캠페인 → 광고그룹 3단계 계층 필터가 구현되어 있음.

- **매체 필터**: `전체 / 네이버 / 구글 / 카카오` 버튼 (단일 선택)
- **캠페인 필터**: 셀렉트박스, 매체 변경 시 초기화
- **광고그룹 필터**: 버튼 다중 선택, 캠페인 변경 시 초기화

필터 적용은 프론트에서만 (`applyFilters()` + `calcSummary()` 재계산). 백엔드 재호출 없음.

KPI 카드는 6개 고정: `총 광고비 / 총 전환(견적요청) / 평균 CPA / 총 클릭 / 평균 CTR / 총 Install`

키워드 성과 표 컬럼 순서: `키워드 / 매체 / 광고그룹 / 노출 / 클릭 / CPC / CTR / 광고비 / Install / 견적요청 / CPA`

모든 숫자 컬럼 헤더 클릭 시 오름/내림 정렬 토글. 기본 정렬: 견적요청 내림차순.

---

## 주요 설계 결정 및 제약

- **Claude 추천 응답 파싱**: `raw.find("{")` ~ `raw.rfind("}")` 로 JSON 블록 추출. 응답 형식이 바뀌면 이 부분 수정 필요.
- **CORS**: `http://localhost:3000` 고정. 다른 오리진에서 접근하려면 `main.py`의 `allow_origins` 수정.
- **프론트 마크다운 렌더링**: 라이브러리 없이 `## heading` → `<h2>`, `**bold**` → `<strong>` 치환. 복잡한 마크다운은 렌더링 안 됨.
- **설정 파일 동시성**: `config_data/` 파일 기반 설정은 단일 사용자 환경 전제. 다중 사용자 시 DB로 교체 필요.
- **검색량 데이터**: 네이버 검색광고 API 미연동 상태. `estimated_monthly_searches` 필드는 현재 항상 `null`.

---

## 기능 명세 변경 규칙

기능 추가/수정 시 이 파일도 같은 커밋에 갱신한다.
