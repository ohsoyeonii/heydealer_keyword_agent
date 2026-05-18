"""
매체별 키워드 등록용 CSV 포맷 변환.
- 네이버: 광고그룹, 키워드, 최대노출입찰가, 품질지수 (네이버 광고관리시스템 형식)
- 구글: Campaign, Ad group, Keyword, Match type (구글 Ads Editor 형식)
- 메타: Ad Set Name, Keyword (메타 광고 형식)
"""
import csv
import io
from models import RecommendedKeyword


def to_naver_csv(keywords: list[RecommendedKeyword]) -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["광고그룹명", "키워드", "최대노출입찰가", "매체"])
    for k in keywords:
        if "네이버" in k.media_targets:
            writer.writerow([k.suggested_ad_group, k.keyword, "", "네이버"])
    return output.getvalue()


def to_google_csv(keywords: list[RecommendedKeyword]) -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Campaign", "Ad group", "Keyword", "Match type"])
    for k in keywords:
        if "구글" in k.media_targets:
            writer.writerow(["", k.suggested_ad_group, k.keyword, "Broad"])
    return output.getvalue()


def to_meta_csv(keywords: list[RecommendedKeyword]) -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Ad Set Name", "Keyword", "추천 이유"])
    for k in keywords:
        if "메타" in k.media_targets:
            writer.writerow([k.suggested_ad_group, k.keyword, k.reason])
    return output.getvalue()


FORMAT_MAP = {
    "naver": to_naver_csv,
    "google": to_google_csv,
    "meta": to_meta_csv,
}


def export(keywords: list[RecommendedKeyword], media: str) -> str:
    fn = FORMAT_MAP.get(media)
    if not fn:
        raise ValueError(f"지원하지 않는 매체: {media}. naver / google / meta 중 선택하세요.")
    return fn(keywords)
