import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { MediaStat } from "../lib/api";
import { fmt } from "../lib/utils";

const COLORS: Record<string, string> = {
  네이버: "#03C75A",
  구글: "#4285F4",
  카카오: "#FEE500",
  메타: "#1877F2",
};

interface Props { data: MediaStat[] }

export function MediaChart({ data }: Props) {
  if (!data.length) return null;

  return (
    <div className="chart-wrap">
      <h3>매체별 전환 성과</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <XAxis dataKey="media" tick={{ fontSize: 13 }} />
          <YAxis
            yAxisId="left"
            tickFormatter={(v) => fmt.num(v)}
            tick={{ fontSize: 11 }}
            width={60}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={(v) => `₩${(v / 1000).toFixed(0)}K`}
            tick={{ fontSize: 11 }}
            width={70}
          />
          <Tooltip
            formatter={(value: number, name: string) =>
              name === "전환(견적요청)" ? [fmt.num(value) + "회", name] : [fmt.krw(value), name]
            }
          />
          <Bar yAxisId="left" dataKey="conversions" name="전환(견적요청)" radius={[4, 4, 0, 0]}>
            {data.map((d) => (
              <Cell key={d.media} fill={COLORS[d.media] ?? "#888"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
