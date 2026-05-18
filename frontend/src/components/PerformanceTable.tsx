import { useState } from "react";
import { KeywordPerf } from "../lib/api";
import { fmt } from "../lib/utils";
import { exportPerformanceExcel } from "../lib/excel";

type SortKey = keyof Pick<KeywordPerf, "impressions" | "clicks" | "cpc" | "ctr" | "cost" | "installs" | "conversions" | "cpa">;
type SortDir = "asc" | "desc";

interface Props {
  keywords: KeywordPerf[];
  title?: string;
  period?: { start: string; end: string };
}

const COLUMNS: { label: string; key: SortKey | null; className?: string }[] = [
  { label: "키워드",   key: null },
  { label: "매체",     key: null },
  { label: "광고그룹", key: null },
  { label: "노출",     key: "impressions", className: "num" },
  { label: "클릭",     key: "clicks",      className: "num" },
  { label: "CPC",      key: "cpc",         className: "num" },
  { label: "CTR",      key: "ctr",         className: "num" },
  { label: "광고비",   key: "cost",        className: "num" },
  { label: "Install",  key: "installs",    className: "num" },
  { label: "견적요청", key: "conversions", className: "num" },
  { label: "CPA",      key: "cpa",         className: "num" },
];

export function PerformanceTable({ keywords, title = "키워드별 성과", period }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("conversions");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  if (!keywords.length) return <p className="empty">데이터가 없습니다.</p>;

  function handleSort(key: SortKey | null) {
    if (!key) return;
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = [...keywords].sort((a, b) => {
    const diff = a[sortKey] - b[sortKey];
    return sortDir === "desc" ? -diff : diff;
  });

  function indicator(key: SortKey | null) {
    if (!key || key !== sortKey) return <span className="sort-icon inactive">↕</span>;
    return <span className="sort-icon active">{sortDir === "desc" ? "↓" : "↑"}</span>;
  }

  return (
    <div className="table-wrap">
      <div className="table-header-row">
        <h3>{title}</h3>
        <button
          className="excel-btn"
          onClick={() => exportPerformanceExcel(sorted, title, period)}
        >
          엑셀 다운로드
        </button>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.label}
                  className={[col.className, col.key ? "sortable" : "", col.key === sortKey ? "sorted" : ""].filter(Boolean).join(" ")}
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}{indicator(col.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((k, i) => (
              <tr key={i} className={k.conversions > 0 ? "has-conv" : ""}>
                <td className="kw-cell">{k.keyword}</td>
                <td><span className={`badge badge-${k.media}`}>{k.media}</span></td>
                <td className="ag-cell">{k.ad_group}</td>
                <td className="num">{fmt.num(k.impressions)}</td>
                <td className="num">{fmt.num(k.clicks)}</td>
                <td className="num">{k.cpc > 0 ? fmt.krw(k.cpc) : "—"}</td>
                <td className="num">{fmt.pct(k.ctr)}</td>
                <td className="num">{fmt.krw(k.cost)}</td>
                <td className="num">{fmt.num(k.installs)}</td>
                <td className="num conv-num">{fmt.num(k.conversions)}</td>
                <td className={`num ${k.cpa > 110000 ? "cpa-over" : k.cpa > 0 ? "cpa-num" : ""}`}>{k.cpa > 0 ? fmt.krw(k.cpa) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
