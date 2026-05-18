const BASE = "http://localhost:8000";

export interface KeywordPerf {
  keyword: string;
  media: string;
  ad_group: string;
  campaign: string;
  cost: number;
  impressions: number;
  clicks: number;
  conversions: number;
  installs: number;
  ctr: number;
  cpc: number;
  cpa: number;
}

export interface MediaStat {
  media: string;
  cost: number;
  conversions: number;
  clicks: number;
  impressions: number;
  cpa: number;
  ctr: number;
}

export interface Summary {
  keyword_count: number;
  total_cost: number;
  total_impressions: number;
  total_clicks: number;
  total_conversions: number;
  total_installs: number;
  avg_ctr: number;
  avg_cpc: number;
  avg_cpa: number;
  by_media: MediaStat[];
}

export interface PerformanceResponse {
  period: { start: string; end: string };
  summary: Summary;
  keywords: KeywordPerf[];
}

export interface RecommendedKeyword {
  keyword: string;
  type: "유사" | "신규";
  reason: string;
  suggested_ad_group: string;
  estimated_monthly_searches: number | null;
  media_targets: string[];
}

export interface RecommendResponse {
  period: { start: string; end: string };
  source_keyword_count: number;
  recommendations: RecommendedKeyword[];
  insight_summary: string;
}

export interface InsightResponse {
  period: { start: string; end: string };
  report: string;
  summary: Summary;
}

async function get<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "요청 실패");
  }
  return res.json();
}

async function post<T>(path: string, body: unknown, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "요청 실패");
  }
  return res.json();
}

export const api = {
  getPerformance: (start?: string, end?: string) =>
    get<PerformanceResponse>("/api/performance", start && end ? { start, end } : undefined),

  getConversionKeywords: (start?: string, end?: string, minConv = 1) =>
    get<PerformanceResponse>("/api/keywords/conversion", {
      ...(start && end ? { start, end } : {}),
      min_conversions: String(minConv),
    }),

  recommend: (start?: string, end?: string) =>
    post<RecommendResponse>("/api/keywords/recommend", {}, start && end ? { start, end } : undefined),

  getInsightReport: (start?: string, end?: string) =>
    get<InsightResponse>("/api/report/insight", start && end ? { start, end } : undefined),

  downloadCsv: async (keywords: RecommendedKeyword[], media: string) => {
    const url = new URL(`${BASE}/api/download/csv`);
    url.searchParams.set("media", media);
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(keywords),
    });
    if (!res.ok) throw new Error("CSV 다운로드 실패");
    const blob = await res.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `keywords_${media}.csv`;
    link.click();
  },
};
