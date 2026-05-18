"""
전환 키워드 추출 및 필터링.

필터링 기준:
1. 견적요청(conversions) > 0
2. 네거티브 키워드 제외
3. 이미 등록된 키워드 제외 (registered_keywords)
4. 검색량 0 키워드 제외 → 네이버 API 연동 전까지는 클릭수 0 키워드 제외
"""
from models import KeywordPerformance


def extract_conversion_keywords(
    rows: list[KeywordPerformance],
    negative_keywords: list[str] | None = None,
    registered_keywords: list[str] | None = None,
    min_conversions: int = 1,
) -> list[KeywordPerformance]:
    negatives = {k.strip().lower() for k in (negative_keywords or [])}
    registered = {k.strip().lower() for k in (registered_keywords or [])}

    filtered = []
    for r in rows:
        kw_lower = r.keyword.lower()

        if r.conversions < min_conversions:
            continue
        if any(neg in kw_lower for neg in negatives):
            continue
        if kw_lower in registered:
            continue
        # 클릭수 0 = 실질적으로 검색량 없음으로 간주
        if r.clicks == 0:
            continue

        filtered.append(r)

    return filtered


def get_summary_stats(rows: list[KeywordPerformance]) -> dict:
    if not rows:
        return {}
    total_cost = sum(r.cost for r in rows)
    total_imp = sum(r.impressions for r in rows)
    total_clicks = sum(r.clicks for r in rows)
    total_conv = sum(r.conversions for r in rows)

    total_inst = sum(r.installs for r in rows)

    return {
        "keyword_count": len(rows),
        "total_cost": round(total_cost),
        "total_impressions": total_imp,
        "total_clicks": total_clicks,
        "total_conversions": total_conv,
        "total_installs": total_inst,
        "avg_ctr": round(total_clicks / total_imp * 100, 2) if total_imp > 0 else 0,
        "avg_cpc": round(total_cost / total_clicks) if total_clicks > 0 else 0,
        "avg_cpa": round(total_cost / total_conv) if total_conv > 0 else 0,
        "by_media": _group_by_media(rows),
    }


def _group_by_media(rows: list[KeywordPerformance]) -> list[dict]:
    media_map: dict[str, dict] = {}
    for r in rows:
        m = r.media
        if m not in media_map:
            media_map[m] = {"media": m, "cost": 0.0, "conversions": 0, "clicks": 0, "impressions": 0}
        media_map[m]["cost"] += r.cost
        media_map[m]["conversions"] += r.conversions
        media_map[m]["clicks"] += r.clicks
        media_map[m]["impressions"] += r.impressions

    result = []
    for d in media_map.values():
        d["cpa"] = round(d["cost"] / d["conversions"]) if d["conversions"] > 0 else 0
        d["ctr"] = round(d["clicks"] / d["impressions"] * 100, 2) if d["impressions"] > 0 else 0
        result.append(d)

    return sorted(result, key=lambda x: x["conversions"], reverse=True)
