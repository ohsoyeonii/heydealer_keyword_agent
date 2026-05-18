from pydantic import BaseModel
from typing import Optional


class KeywordPerformance(BaseModel):
    keyword: str
    media: str
    ad_group: str
    campaign: str
    cost: float
    impressions: int
    clicks: int
    conversions: int          # 견적요청
    installs: int
    ctr: float                # clicks / impressions
    cpc: float                # cost / clicks
    cpa: float                # cost / conversions (0 if no conversions)


class PerformanceSummary(BaseModel):
    total_cost: float
    total_impressions: int
    total_clicks: int
    total_conversions: int
    ctr: float
    cpc: float
    cpa: float
    by_media: list[dict]


class RecommendedKeyword(BaseModel):
    keyword: str
    type: str                 # "유사" | "신규"
    reason: str
    suggested_ad_group: str
    estimated_monthly_searches: Optional[int] = None  # 네이버 API 연동 시 채워짐
    media_targets: list[str]  # ["네이버", "구글", "카카오"]


class RecommendationResult(BaseModel):
    source_keywords: list[str]
    recommendations: list[RecommendedKeyword]
    insight_summary: str


class InsightReport(BaseModel):
    period: str
    top_keywords: list[dict]
    media_breakdown: list[dict]
    recommendations_summary: str
    generated_at: str


class DownloadRequest(BaseModel):
    keywords: list[RecommendedKeyword]
    media: str   # "naver" | "google" | "meta"
