import { Summary } from "../lib/api";
import { fmt } from "../lib/utils";

interface Props { summary: Summary; }

export function KpiCards({ summary }: Props) {
  const cards = [
    { label: "총 광고비",        value: fmt.krw(summary.total_cost) },
    { label: "총 전환(견적요청)", value: fmt.num(summary.total_conversions) + "건" },
    { label: "평균 CPA",         value: fmt.krw(summary.avg_cpa) },
    { label: "총 클릭",          value: fmt.num(summary.total_clicks) + "회" },
    { label: "평균 CTR",         value: fmt.pct(summary.avg_ctr) },
    { label: "총 Install",       value: fmt.num(summary.total_installs) + "건" },
  ];

  return (
    <div className="kpi-grid">
      {cards.map((c) => (
        <div key={c.label} className="kpi-card">
          <div className="kpi-label">{c.label}</div>
          <div className="kpi-value">{c.value}</div>
        </div>
      ))}
    </div>
  );
}
