export const fmt = {
  krw: (n: number) => `₩${Math.round(n).toLocaleString("ko-KR")}`,
  num: (n: number) => Math.round(n).toLocaleString("ko-KR"),
  pct: (n: number) => `${n.toFixed(2)}%`,
};

export function getDefaultDates(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 29);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}
