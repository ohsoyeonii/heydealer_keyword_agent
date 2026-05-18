import { useState } from "react";
import { RecommendedKeyword, api } from "../lib/api";

interface Props {
  keywords: RecommendedKeyword[];
  insightSummary: string;
}

export function RecommendationTable({ keywords, insightSummary }: Props) {
  const [filter, setFilter] = useState<"전체" | "유사" | "신규">("전체");
  const [downloading, setDownloading] = useState<string | null>(null);

  const filtered = filter === "전체" ? keywords : keywords.filter((k) => k.type === filter);

  async function handleDownload(media: string) {
    setDownloading(media);
    try {
      await api.downloadCsv(filtered, media);
    } catch (e) {
      alert("다운로드 실패: " + (e as Error).message);
    } finally {
      setDownloading(null);
    }
  }

  if (!keywords.length) return null;

  return (
    <div className="rec-section">
      {insightSummary && (
        <div className="insight-box">
          <strong>전략 인사이트</strong>
          <p>{insightSummary}</p>
        </div>
      )}

      <div className="rec-toolbar">
        <div className="filter-tabs">
          {(["전체", "유사", "신규"] as const).map((t) => (
            <button
              key={t}
              className={`tab ${filter === t ? "active" : ""}`}
              onClick={() => setFilter(t)}
            >
              {t} {t === "전체" ? `(${keywords.length})` : `(${keywords.filter((k) => k.type === t).length})`}
            </button>
          ))}
        </div>
        <div className="download-btns">
          <span>CSV 다운로드:</span>
          {["naver", "google", "meta"].map((m) => (
            <button
              key={m}
              className="dl-btn"
              onClick={() => handleDownload(m)}
              disabled={downloading === m}
            >
              {downloading === m ? "..." : m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>키워드</th>
              <th>유형</th>
              <th>추천 이유</th>
              <th>적합 광고그룹</th>
              <th>타겟 매체</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((k, i) => (
              <tr key={i}>
                <td className="kw-cell"><strong>{k.keyword}</strong></td>
                <td>
                  <span className={`badge badge-type-${k.type === "유사" ? "similar" : "new"}`}>
                    {k.type}
                  </span>
                </td>
                <td className="reason-cell">{k.reason}</td>
                <td className="ag-cell">{k.suggested_ad_group}</td>
                <td>
                  <div className="media-tags">
                    {k.media_targets.map((m) => (
                      <span key={m} className={`badge badge-${m}`}>{m}</span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
