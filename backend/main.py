from datetime import date, timedelta
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import io

import os
from models import RecommendedKeyword
from report_parser import fetch_raw_data, aggregate_by_keyword, fetch_search_queries
from keyword_extractor import extract_conversion_keywords, get_summary_stats
from recommender import recommend_keywords, generate_insight_report
from csv_exporter import export as export_csv
import config

app = FastAPI(title="헤이딜러 키워드 에이전트 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _default_period() -> tuple[date, date]:
    end = date.today()
    start = end - timedelta(days=29)
    return start, end


# ─── 성과 데이터 ────────────────────────────────────────────────────────────────

@app.get("/api/performance")
def get_performance(
    start: str = Query(default=None, description="YYYY-MM-DD"),
    end: str = Query(default=None, description="YYYY-MM-DD"),
):
    """기간 내 키워드별 성과 반환 (집계)."""
    try:
        s = date.fromisoformat(start) if start else _default_period()[0]
        e = date.fromisoformat(end) if end else _default_period()[1]
    except ValueError:
        raise HTTPException(400, "날짜 형식 오류. YYYY-MM-DD 형식을 사용하세요.")

    rows = fetch_raw_data(s, e)
    aggregated = aggregate_by_keyword(rows)
    summary = get_summary_stats(aggregated)

    return {
        "period": {"start": s.isoformat(), "end": e.isoformat()},
        "summary": summary,
        "keywords": [r.model_dump() for r in aggregated],
    }


@app.get("/api/keywords/conversion")
def get_conversion_keywords(
    start: str = Query(default=None),
    end: str = Query(default=None),
    min_conversions: int = Query(default=1),
):
    """전환 발생 키워드만 필터링해서 반환."""
    try:
        s = date.fromisoformat(start) if start else _default_period()[0]
        e = date.fromisoformat(end) if end else _default_period()[1]
    except ValueError:
        raise HTTPException(400, "날짜 형식 오류.")

    rows = fetch_raw_data(s, e)
    aggregated = aggregate_by_keyword(rows)

    conversion_kws = [k for k in aggregated if k.conversions >= min_conversions]
    summary = get_summary_stats(conversion_kws)

    return {
        "period": {"start": s.isoformat(), "end": e.isoformat()},
        "summary": summary,
        "keywords": [r.model_dump() for r in conversion_kws],
    }


# ─── 키워드 추천 ─────────────────────────────────────────────────────────────────

@app.post("/api/keywords/recommend")
def recommend(
    start: str = Query(default=None),
    end: str = Query(default=None),
    min_conversions: int = Query(default=1),
    top_n: int = Query(default=30, le=100),
):
    """전환 키워드 기반 유사/신규 키워드 추천 (Claude API 호출)."""
    try:
        s = date.fromisoformat(start) if start else _default_period()[0]
        e = date.fromisoformat(end) if end else _default_period()[1]
    except ValueError:
        raise HTTPException(400, "날짜 형식 오류.")

    rows = fetch_raw_data(s, e)
    if not rows:
        raise HTTPException(404, f"{s} ~ {e} 기간 데이터가 없습니다.")

    aggregated = aggregate_by_keyword(rows)
    negatives = config.get_negative_keywords()
    registered = config.get_registered_keywords()
    brand_ctx = config.get_brand_context()

    conversion_kws = extract_conversion_keywords(
        aggregated,
        negative_keywords=negatives,
        registered_keywords=registered,
        min_conversions=min_conversions,
    )

    if not conversion_kws:
        return {
            "recommendations": [],
            "insight_summary": "해당 기간에 전환 키워드가 없습니다.",
        }

    kw_dicts = [r.model_dump() for r in conversion_kws]
    if not os.getenv("ANTHROPIC_API_KEY"):
        raise HTTPException(503, "ANTHROPIC_API_KEY가 설정되지 않았습니다. backend/.env 파일에 키를 입력하세요.")

    recs, insight = recommend_keywords(
        conversion_keywords=kw_dicts,
        brand_context=brand_ctx,
        negative_keywords=negatives,
        registered_keywords=registered,
        top_n=top_n,
    )

    return {
        "period": {"start": s.isoformat(), "end": e.isoformat()},
        "source_keyword_count": len(conversion_kws),
        "recommendations": [r.model_dump() for r in recs],
        "insight_summary": insight,
    }


# ─── 인사이트 리포트 ──────────────────────────────────────────────────────────────

@app.get("/api/report/insight")
def get_insight_report(
    start: str = Query(default=None),
    end: str = Query(default=None),
):
    """매체별 성과 AI 인사이트 리포트."""
    try:
        s = date.fromisoformat(start) if start else _default_period()[0]
        e = date.fromisoformat(end) if end else _default_period()[1]
    except ValueError:
        raise HTTPException(400, "날짜 형식 오류.")

    rows = fetch_raw_data(s, e)
    if not rows:
        raise HTTPException(404, f"{s} ~ {e} 기간 데이터가 없습니다.")

    aggregated = aggregate_by_keyword(rows)
    summary = get_summary_stats(aggregated)
    top_kws = [r.model_dump() for r in aggregated[:20]]

    if not os.getenv("ANTHROPIC_API_KEY"):
        raise HTTPException(503, "ANTHROPIC_API_KEY가 설정되지 않았습니다. backend/.env 파일에 키를 입력하세요.")

    report = generate_insight_report(
        summary=summary,
        top_keywords=top_kws,
        period=f"{s.isoformat()} ~ {e.isoformat()}",
    )

    return {
        "period": {"start": s.isoformat(), "end": e.isoformat()},
        "report": report,
        "summary": summary,
    }


# ─── CSV 다운로드 ─────────────────────────────────────────────────────────────────

@app.post("/api/download/csv")
def download_csv(
    keywords: list[RecommendedKeyword],
    media: str = Query(..., description="naver | google | meta"),
):
    """추천 키워드를 매체 포맷 CSV로 다운로드."""
    try:
        csv_content = export_csv(keywords, media)
    except ValueError as e:
        raise HTTPException(400, str(e))

    filename = f"keywords_{media}.csv"
    return StreamingResponse(
        io.StringIO(csv_content),
        media_type="text/csv; charset=utf-8-sig",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ─── 설정 관리 ──────────────────────────────────────────────────────────────────

@app.get("/api/config")
def get_config():
    return {
        "brand_context": config.get_brand_context(),
        "negative_keywords": config.get_negative_keywords(),
        "registered_keywords": config.get_registered_keywords(),
    }


@app.post("/api/config/brand")
def update_brand(body: dict):
    text = body.get("text", "").strip()
    if not text:
        raise HTTPException(400, "브랜드 컨텍스트가 비어 있습니다.")
    config.save_brand_context(text)
    return {"ok": True}


@app.post("/api/config/negatives")
def update_negatives(body: dict):
    keywords = body.get("keywords", [])
    config.save_negative_keywords(keywords)
    return {"ok": True, "count": len(keywords)}


@app.post("/api/config/registered")
def update_registered(body: dict):
    keywords = body.get("keywords", [])
    config.save_registered_keywords(keywords)
    return {"ok": True, "count": len(keywords)}


# ─── 검색어 RAW ──────────────────────────────────────────────────────────────────

@app.get("/api/search-queries")
def get_search_queries(min_conversions: float = Query(default=1.0)):
    """MO_SELL_APP 검색어 RAW에서 전환 추정 검색어 반환."""
    queries = fetch_search_queries(min_conversions=int(min_conversions))
    return {"count": len(queries), "queries": queries[:300]}


@app.get("/api/health")
def health():
    return {"status": "ok"}
