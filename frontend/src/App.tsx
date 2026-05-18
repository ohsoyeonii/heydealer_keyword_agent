import { useState, useEffect, useMemo } from "react";
import { api, PerformanceResponse, RecommendResponse, InsightResponse, KeywordPerf, Summary } from "./lib/api";
import { getDefaultDates } from "./lib/utils";
import { KpiCards } from "./components/KpiCards";
import { PerformanceTable } from "./components/PerformanceTable";
import { MediaChart } from "./components/MediaChart";
import { RecommendationTable } from "./components/RecommendationTable";

type Tab = "performance" | "conversion" | "recommend" | "insight";

const MEDIA_FILTERS = ["전체", "네이버", "구글", "카카오"] as const;
type MediaFilter = (typeof MEDIA_FILTERS)[number];

function calcSummary(keywords: KeywordPerf[]): Summary {
  const totalCost = keywords.reduce((s, k) => s + k.cost, 0);
  const totalImp = keywords.reduce((s, k) => s + k.impressions, 0);
  const totalClicks = keywords.reduce((s, k) => s + k.clicks, 0);
  const totalConv  = keywords.reduce((s, k) => s + k.conversions, 0);
  const totalInst  = keywords.reduce((s, k) => s + k.installs, 0);

  const mediaMap: Record<string, { media: string; cost: number; conversions: number; clicks: number; impressions: number }> = {};
  for (const k of keywords) {
    if (!mediaMap[k.media]) mediaMap[k.media] = { media: k.media, cost: 0, conversions: 0, clicks: 0, impressions: 0 };
    mediaMap[k.media].cost += k.cost;
    mediaMap[k.media].conversions += k.conversions;
    mediaMap[k.media].clicks += k.clicks;
    mediaMap[k.media].impressions += k.impressions;
  }
  const byMedia = Object.values(mediaMap)
    .map((m) => ({
      ...m,
      cpa: m.conversions > 0 ? Math.round(m.cost / m.conversions) : 0,
      ctr: m.impressions > 0 ? Math.round((m.clicks / m.impressions) * 10000) / 100 : 0,
    }))
    .sort((a, b) => b.conversions - a.conversions);

  return {
    keyword_count: keywords.length,
    total_cost: Math.round(totalCost),
    total_impressions: totalImp,
    total_clicks: totalClicks,
    total_conversions: totalConv,
    total_installs: totalInst,
    avg_ctr: totalImp > 0 ? Math.round((totalClicks / totalImp) * 10000) / 100 : 0,
    avg_cpc: totalClicks > 0 ? Math.round(totalCost / totalClicks) : 0,
    avg_cpa: totalConv > 0 ? Math.round(totalCost / totalConv) : 0,
    by_media: byMedia,
  };
}

function applyFilters(
  keywords: KeywordPerf[],
  media: MediaFilter,
  campaign: string,
  adGroups: string[],
): KeywordPerf[] {
  return keywords.filter((k) => {
    if (media !== "전체" && k.media !== media) return false;
    if (campaign !== "" && k.campaign !== campaign) return false;
    if (adGroups.length > 0 && !adGroups.includes(k.ad_group)) return false;
    return true;
  });
}

export default function App() {
  const defaults = getDefaultDates();
  const [start, setStart] = useState(defaults.start);
  const [end, setEnd] = useState(defaults.end);
  const [tab, setTab] = useState<Tab>("performance");
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("전체");
  const [campaignFilter, setCampaignFilter] = useState("");
  const [adGroupFilter, setAdGroupFilter] = useState<string[]>([]);

  const [perfData, setPerfData] = useState<PerformanceResponse | null>(null);
  const [convData, setConvData] = useState<PerformanceResponse | null>(null);
  const [recData, setRecData] = useState<RecommendResponse | null>(null);
  const [insightData, setInsightData] = useState<InsightResponse | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(t: Tab) {
    setLoading(true);
    setError(null);
    try {
      if (t === "performance") {
        setPerfData(await api.getPerformance(start, end));
      } else if (t === "conversion") {
        setConvData(await api.getConversionKeywords(start, end));
      } else if (t === "recommend") {
        setRecData(await api.recommend(start, end));
      } else if (t === "insight") {
        setInsightData(await api.getInsightReport(start, end));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(tab); }, [tab]);

  // 탭 변경 → 전체 필터 초기화
  useEffect(() => {
    setMediaFilter("전체");
    setCampaignFilter("");
    setAdGroupFilter([]);
  }, [tab]);

  // 매체 변경 → 캠페인·광고그룹 초기화
  useEffect(() => {
    setCampaignFilter("");
    setAdGroupFilter([]);
  }, [mediaFilter]);

  // 캠페인 변경 → 광고그룹 초기화
  useEffect(() => { setAdGroupFilter([]); }, [campaignFilter]);

  function handleSearch() { load(tab); }

  const baseKeywords = useMemo(() => {
    const src = tab === "performance" ? perfData?.keywords : convData?.keywords;
    if (!src) return [];
    return mediaFilter === "전체" ? src : src.filter((k) => k.media === mediaFilter);
  }, [tab, perfData, convData, mediaFilter]);

  // 캠페인 옵션: 매체 필터 적용 후
  const campaignOptions = useMemo(() =>
    [...new Set(baseKeywords.map((k) => k.campaign).filter(Boolean))].sort(),
  [baseKeywords]);

  // 광고그룹 옵션: 매체 + 캠페인 필터 적용 후
  const adGroupOptions = useMemo(() => {
    const filtered = campaignFilter
      ? baseKeywords.filter((k) => k.campaign === campaignFilter)
      : baseKeywords;
    return [...new Set(filtered.map((k) => k.ad_group).filter(Boolean))].sort();
  }, [baseKeywords, campaignFilter]);

  function toggleAdGroup(ag: string) {
    setAdGroupFilter((prev) =>
      prev.includes(ag) ? prev.filter((g) => g !== ag) : [...prev, ag]
    );
  }

  const filteredPerf = useMemo(() => {
    if (!perfData) return null;
    const keywords = applyFilters(perfData.keywords, mediaFilter, campaignFilter, adGroupFilter);
    return { ...perfData, keywords, summary: calcSummary(keywords) };
  }, [perfData, mediaFilter, campaignFilter, adGroupFilter]);

  const filteredConv = useMemo(() => {
    if (!convData) return null;
    const keywords = applyFilters(convData.keywords, mediaFilter, campaignFilter, adGroupFilter);
    return { ...convData, keywords, summary: calcSummary(keywords) };
  }, [convData, mediaFilter, campaignFilter, adGroupFilter]);

  const isFiltered = mediaFilter !== "전체" || campaignFilter !== "" || adGroupFilter.length > 0;
  const activeAdGroupLabel = adGroupFilter.length > 0
    ? adGroupFilter.length === 1 ? adGroupFilter[0] : `${adGroupFilter[0]} 외 ${adGroupFilter.length - 1}개`
    : null;
  const filterLabel = [
    mediaFilter !== "전체" ? mediaFilter : null,
    campaignFilter || null,
    activeAdGroupLabel,
  ].filter(Boolean).join(" · ");

  function FilterArea() {
    return (
      <div className="filter-area">
        {/* 매체 */}
        <div className="media-filter-bar">
          {MEDIA_FILTERS.map((m) => (
            <button
              key={m}
              className={`media-filter-btn media-filter-${m} ${mediaFilter === m ? "active" : ""}`}
              onClick={() => setMediaFilter(m)}
            >
              {m}
            </button>
          ))}
        </div>

        {/* 캠페인 셀렉트 */}
        {campaignOptions.length > 0 && (
          <div className="campaign-filter-row">
            <label className="filter-label" htmlFor="campaign-select">캠페인</label>
            <select
              id="campaign-select"
              className="campaign-select"
              value={campaignFilter}
              onChange={(e) => setCampaignFilter(e.target.value)}
            >
              <option value="">전체</option>
              {campaignOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        )}

        {/* 광고그룹 버튼 */}
        {adGroupOptions.length > 0 && (
          <div className="adgroup-filter-wrap">
            <span className="adgroup-filter-label">광고그룹</span>
            <div className="adgroup-filter-bar">
              <button
                className={`adgroup-filter-btn ${adGroupFilter.length === 0 ? "active" : ""}`}
                onClick={() => setAdGroupFilter([])}
              >
                전체
              </button>
              {adGroupOptions.map((ag) => (
                <button
                  key={ag}
                  className={`adgroup-filter-btn ${adGroupFilter.includes(ag) ? "active" : ""}`}
                  onClick={() => toggleAdGroup(ag)}
                >
                  {ag}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>헤이딜러 키워드 에이전트</h1>
        <div className="date-picker">
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          <span>~</span>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          <button className="btn-primary" onClick={handleSearch} disabled={loading}>
            {loading ? "조회 중..." : "조회"}
          </button>
        </div>
      </header>

      <nav className="tab-nav">
        {([
          { key: "performance", label: "전체 성과" },
          { key: "conversion", label: "전환 키워드" },
          { key: "recommend", label: "키워드 추천" },
          { key: "insight", label: "인사이트 리포트" },
        ] as { key: Tab; label: string }[]).map((t) => (
          <button
            key={t.key}
            className={`nav-tab ${tab === t.key ? "active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="app-main">
        {error && <div className="error-box">오류: {error}</div>}
        {loading && <div className="loading">데이터를 불러오는 중입니다...</div>}

        {!loading && !error && (
          <>
            {tab === "performance" && filteredPerf && (
              <>
                <FilterArea />
                <KpiCards summary={filteredPerf.summary} />
                {!isFiltered && <MediaChart data={filteredPerf.summary.by_media} />}
                <PerformanceTable
                  keywords={filteredPerf.keywords}
                  title={filterLabel ? `키워드 성과 · ${filterLabel}` : "키워드 성과"}
                />
              </>
            )}

            {tab === "conversion" && filteredConv && (
              <>
                <FilterArea />
                <div className="section-desc">
                  견적요청 1건 이상 발생한
                  <strong> 전환 키워드 {filteredConv.summary.keyword_count}개</strong>
                  {isFiltered && <strong> ({filterLabel})</strong>}
                </div>
                <KpiCards summary={filteredConv.summary} />
                {!isFiltered && <MediaChart data={filteredConv.summary.by_media} />}
                <PerformanceTable
                  keywords={filteredConv.keywords}
                  title={filterLabel ? `전환 키워드 (견적요청 기준) · ${filterLabel}` : "전환 키워드 목록 (견적요청 기준)"}
                />
              </>
            )}

            {tab === "recommend" && (
              <>
                {!recData && !loading && (
                  <div className="recommend-prompt">
                    <p>전환 키워드 데이터를 분석하여 유사·신규 키워드를 추천합니다.</p>
                    <p>Claude AI가 데이터 기반으로 추천하므로 약 20~40초 소요됩니다.</p>
                    <button className="btn-primary btn-large" onClick={handleSearch}>
                      키워드 추천 생성
                    </button>
                  </div>
                )}
                {recData && (
                  <>
                    <div className="section-desc">
                      기간 내 전환 키워드 <strong>{recData.source_keyword_count}개</strong> 분석 결과
                    </div>
                    <RecommendationTable
                      keywords={recData.recommendations}
                      insightSummary={recData.insight_summary}
                    />
                  </>
                )}
              </>
            )}

            {tab === "insight" && insightData && (
              <div className="insight-report">
                <div className="insight-meta">
                  분석 기간: {insightData.period.start} ~ {insightData.period.end}
                </div>
                <KpiCards summary={insightData.summary} />
                <div
                  className="report-body"
                  dangerouslySetInnerHTML={{
                    __html: insightData.report
                      .replace(/\n/g, "<br/>")
                      .replace(/## (.+)/g, "<h2>$1</h2>")
                      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"),
                  }}
                />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
