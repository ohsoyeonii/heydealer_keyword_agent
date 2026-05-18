"""
Google Sheets RAW 데이터를 파싱해 정형 데이터로 변환.

RAW 시트 컬럼: Year, Month, weeknum, Date, 매체, 디바이스, 캠페인, 광고그룹, 키워드,
               cost, imp, clicks, 전환율, Install, 견적요청
"""
import re
from datetime import date
from sheets_client import get_all_values
from models import KeywordPerformance


RAW_SHEET = "RAW"
SEARCH_QUERY_SHEET = "MO_SELL_APP 검색어 RAW"

# RAW 시트 컬럼 인덱스
COL = {
    "year": 0, "month": 1, "weeknum": 2, "date": 3,
    "media": 4, "device": 5, "campaign": 6, "ad_group": 7, "keyword": 8,
    "cost": 9, "imp": 10, "clicks": 11, "cvr": 12, "install": 13, "purchase": 14,
}

# 검색어 RAW 시트 컬럼 인덱스
SEARCH_COL = {
    "media": 0, "device": 1, "ad_group": 2, "kw_type": 3, "query": 4,
    "cost": 5, "imp": 6, "clicks": 7, "cvr": 8,
}


def _to_float(val: str) -> float:
    if not val:
        return 0.0
    return float(re.sub(r"[,\s]", "", str(val)))


def _to_int(val: str) -> int:
    return int(_to_float(val))


def _parse_date(val: str) -> date | None:
    try:
        return date.fromisoformat(val)
    except (ValueError, TypeError):
        return None


def fetch_raw_data(start: date, end: date) -> list[KeywordPerformance]:
    """RAW 시트에서 기간 내 키워드 성과 데이터 반환."""
    rows = get_all_values(RAW_SHEET)
    if not rows:
        return []

    # 1행은 헤더가 아닌 경우가 있으므로 실제 헤더 행을 찾음
    # 'Year' 또는 'Date' 가 포함된 첫 행이 헤더
    header_idx = next(
        (i for i, r in enumerate(rows) if r and r[0] in ("Year", "year")),
        None
    )
    if header_idx is None:
        return []

    data_rows = rows[header_idx + 1:]
    results: list[KeywordPerformance] = []

    for row in data_rows:
        if len(row) <= COL["purchase"]:
            continue

        row_date = _parse_date(row[COL["date"]])
        if not row_date or not (start <= row_date <= end):
            continue

        keyword = row[COL["keyword"]].strip()
        if not keyword:
            continue

        cost = _to_float(row[COL["cost"]])
        imp = _to_int(row[COL["imp"]])
        clicks = _to_int(row[COL["clicks"]])
        purchase = _to_int(row[COL["purchase"]])
        install = _to_int(row[COL["install"]])

        results.append(KeywordPerformance(
            keyword=keyword,
            media=row[COL["media"]].strip(),
            ad_group=row[COL["ad_group"]].strip(),
            campaign=row[COL["campaign"]].strip(),
            cost=cost,
            impressions=imp,
            clicks=clicks,
            conversions=purchase,
            installs=install,
            ctr=round(clicks / imp * 100, 2) if imp > 0 else 0.0,
            cpc=round(cost / clicks, 0) if clicks > 0 else 0.0,
            cpa=round(cost / purchase, 0) if purchase > 0 else 0.0,
        ))

    return results


def aggregate_by_keyword(rows: list[KeywordPerformance]) -> list[KeywordPerformance]:
    """동일 키워드를 합산해 하나의 행으로 축약."""
    agg: dict[tuple, dict] = {}

    for r in rows:
        key = (r.keyword, r.media, r.campaign, r.ad_group)
        if key not in agg:
            agg[key] = {
                "keyword": r.keyword, "media": r.media, "ad_group": r.ad_group,
                "campaign": r.campaign,
                "cost": 0.0, "impressions": 0, "clicks": 0,
                "conversions": 0, "installs": 0,
            }
        d = agg[key]
        d["cost"] += r.cost
        d["impressions"] += r.impressions
        d["clicks"] += r.clicks
        d["conversions"] += r.conversions
        d["installs"] += r.installs

    result = []
    for d in agg.values():
        imp, clicks, cost, conv = d["impressions"], d["clicks"], d["cost"], d["conversions"]
        result.append(KeywordPerformance(
            **{k: v for k, v in d.items()},
            ctr=round(clicks / imp * 100, 2) if imp > 0 else 0.0,
            cpc=round(cost / clicks, 0) if clicks > 0 else 0.0,
            cpa=round(cost / conv, 0) if conv > 0 else 0.0,
        ))

    return sorted(result, key=lambda x: x.conversions, reverse=True)


def fetch_search_queries(min_conversions: int = 1) -> list[dict]:
    """MO_SELL_APP 검색어 RAW 시트에서 전환이 있는 검색어 반환."""
    try:
        rows = get_all_values(SEARCH_QUERY_SHEET)
    except Exception:
        return []

    if not rows:
        return []

    # 헤더 행 탐색 ('매체' 포함)
    header_idx = next(
        (i for i, r in enumerate(rows) if r and r[0] in ("매체", "media")),
        None
    )
    if header_idx is None:
        return []

    queries = []
    for row in rows[header_idx + 1:]:
        if len(row) <= SEARCH_COL["cvr"]:
            continue
        query = row[SEARCH_COL["query"]].strip()
        if not query:
            continue
        cvr = _to_float(row[SEARCH_COL["cvr"]])
        clicks = _to_int(row[SEARCH_COL["clicks"]])
        # 전환율 * 클릭수로 전환수 추정 (검색어 RAW에는 견적요청 컬럼 없음)
        est_conv = round(cvr * clicks / 100, 1)
        if est_conv < min_conversions:
            continue
        queries.append({
            "query": query,
            "media": row[SEARCH_COL["media"]].strip(),
            "ad_group": row[SEARCH_COL["ad_group"]].strip(),
            "cost": _to_float(row[SEARCH_COL["cost"]]),
            "clicks": clicks,
            "est_conversions": est_conv,
        })

    return sorted(queries, key=lambda x: x["est_conversions"], reverse=True)
