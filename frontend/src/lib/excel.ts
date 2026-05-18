import * as XLSX from "xlsx";
import { KeywordPerf, RecommendedKeyword, InsightResponse } from "./api";

type Period = { start: string; end: string };

function autoWidth(ws: XLSX.WorkSheet, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  ws["!cols"] = cols.map((col) => {
    const max = Math.max(
      col.length,
      ...rows.map((r) => String(r[col] ?? "").length),
    );
    return { wch: Math.min(max + 2, 60) };
  });
}

export function exportPerformanceExcel(
  keywords: KeywordPerf[],
  title: string,
  period?: Period,
) {
  const rows = keywords.map((k) => ({
    "키워드": k.keyword,
    "매체": k.media,
    "캠페인": k.campaign,
    "광고그룹": k.ad_group,
    "노출": k.impressions,
    "클릭": k.clicks,
    "CPC(원)": k.cpc,
    "CTR(%)": k.ctr,
    "광고비(원)": k.cost,
    "Install": k.installs,
    "견적요청": k.conversions,
    "CPA(원)": k.cpa > 0 ? k.cpa : 0,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  autoWidth(ws, rows as Record<string, unknown>[]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31));

  const suffix = period ? `${period.start}_${period.end}` : today();
  XLSX.writeFile(wb, `${title}_${suffix}.xlsx`);
}

export function exportRecommendExcel(
  keywords: RecommendedKeyword[],
  period?: Period,
) {
  const rows = keywords.map((k) => ({
    "키워드": k.keyword,
    "유형": k.type,
    "추천 이유": k.reason,
    "적합 광고그룹": k.suggested_ad_group,
    "타겟 매체": k.media_targets.join(", "),
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  autoWidth(ws, rows as Record<string, unknown>[]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "키워드 추천");

  const suffix = period ? `${period.start}_${period.end}` : today();
  XLSX.writeFile(wb, `키워드_추천_${suffix}.xlsx`);
}

export function exportInsightExcel(data: InsightResponse) {
  const wb = XLSX.utils.book_new();

  // KPI 요약
  const kpiRows = [
    { "항목": "총 광고비(원)", "값": data.summary.total_cost },
    { "항목": "총 전환(견적요청)", "값": data.summary.total_conversions },
    { "항목": "평균 CPA(원)", "값": data.summary.avg_cpa },
    { "항목": "총 클릭", "값": data.summary.total_clicks },
    { "항목": "평균 CTR(%)", "값": data.summary.avg_ctr },
    { "항목": "총 Install", "값": data.summary.total_installs },
  ];
  const wsKpi = XLSX.utils.json_to_sheet(kpiRows);
  autoWidth(wsKpi, kpiRows as Record<string, unknown>[]);
  XLSX.utils.book_append_sheet(wb, wsKpi, "KPI 요약");

  // 매체별 성과
  const mediaRows = data.summary.by_media.map((m) => ({
    "매체": m.media,
    "광고비(원)": m.cost,
    "클릭": m.clicks,
    "노출": m.impressions,
    "견적요청": m.conversions,
    "CPA(원)": m.cpa,
    "CTR(%)": m.ctr,
  }));
  const wsMedia = XLSX.utils.json_to_sheet(mediaRows);
  autoWidth(wsMedia, mediaRows as Record<string, unknown>[]);
  XLSX.utils.book_append_sheet(wb, wsMedia, "매체별 성과");

  // 리포트 텍스트
  const reportRows = data.report
    .split("\n")
    .map((line) => ({ "AI 인사이트 리포트": line }));
  const wsReport = XLSX.utils.json_to_sheet(reportRows);
  wsReport["!cols"] = [{ wch: 100 }];
  XLSX.utils.book_append_sheet(wb, wsReport, "AI 인사이트");

  XLSX.writeFile(
    wb,
    `인사이트_리포트_${data.period.start}_${data.period.end}.xlsx`,
  );
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
