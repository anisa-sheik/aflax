import { useMemo } from "react";

type Props = {
  /** Map of ISO date (YYYY-MM-DD) → activity value (e.g. ayāt read that day). */
  data: Record<string, number>;
  days?: number;
  /** Tint family (uses Tailwind primary by default). */
  tint?: "primary" | "accent";
};

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function Heatmap({ data, days = 365, tint = "primary" }: Props) {
  const { weeks, monthMarkers, max, total, activeDays } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // start: end of week containing (today - days + 1), normalized so each column is a full week
    const start = new Date(today);
    start.setDate(today.getDate() - (days - 1));
    // shift back so each column starts on Sunday
    start.setDate(start.getDate() - start.getDay());

    const cols: { date: Date; iso: string; value: number }[][] = [];
    const monthMarks: { col: number; label: string }[] = [];
    let max = 0, total = 0, activeDays = 0;
    let cursor = new Date(start);
    let prevMonth = -1;

    while (cursor <= today) {
      const col: { date: Date; iso: string; value: number }[] = [];
      for (let d = 0; d < 7; d++) {
        const day = new Date(cursor);
        const iso = day.toISOString().slice(0, 10);
        const inRange = day <= today && day >= new Date(today.getTime() - (days - 1) * 86400000);
        const v = inRange ? (data[iso] ?? 0) : -1;
        if (v > 0) { activeDays++; total += v; if (v > max) max = v; }
        col.push({ date: day, iso, value: v });
        cursor.setDate(cursor.getDate() + 1);
      }
      const firstDay = col[0].date;
      const m = firstDay.getMonth();
      if (m !== prevMonth && firstDay.getDate() <= 7) {
        monthMarks.push({ col: cols.length, label: MONTH_LABELS[m] });
        prevMonth = m;
      }
      cols.push(col);
    }
    return { weeks: cols, monthMarkers: monthMarks, max, total, activeDays };
  }, [data, days]);

  const level = (v: number) => {
    if (v < 0) return -1;          // outside range
    if (v === 0) return 0;
    if (max <= 0) return 1;
    const ratio = v / max;
    if (ratio < 0.25) return 1;
    if (ratio < 0.5) return 2;
    if (ratio < 0.75) return 3;
    return 4;
  };

  const colorClass = (lvl: number) => {
    if (lvl < 0) return "bg-transparent";
    if (lvl === 0) return "bg-white/[0.04]";
    if (tint === "accent") {
      return ["", "bg-accent/25", "bg-accent/45", "bg-accent/70", "bg-accent"][lvl];
    }
    return ["", "bg-primary/25", "bg-primary/45", "bg-primary/70", "bg-primary"][lvl];
  };

  const cell = 11;
  const gap = 3;
  const width = weeks.length * (cell + gap);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
        <span>{activeDays} active days</span>
        <span className="tabular-nums">{total.toLocaleString()} total</span>
      </div>

      <div className="overflow-x-auto -mx-1 px-1">
        <div style={{ width }} className="relative">
          {/* month labels */}
          <div className="relative h-3 mb-1">
            {monthMarkers.map((m, i) => (
              <span
                key={i}
                className="absolute text-[9px] uppercase tracking-widest text-muted-foreground"
                style={{ left: m.col * (cell + gap) }}
              >
                {m.label}
              </span>
            ))}
          </div>

          <div className="flex" style={{ gap }}>
            {weeks.map((col, ci) => (
              <div key={ci} className="flex flex-col" style={{ gap }}>
                {col.map((c, ri) => {
                  const lvl = level(c.value);
                  return (
                    <div
                      key={ri}
                      title={lvl < 0 ? "" : `${c.iso} · ${c.value}`}
                      className={`rounded-[2px] ${colorClass(lvl)}`}
                      style={{ width: cell, height: cell }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map(l => (
          <span key={l} className={`rounded-[2px] ${colorClass(l)}`} style={{ width: 10, height: 10 }} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
