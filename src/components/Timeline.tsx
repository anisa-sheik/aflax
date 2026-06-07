export type TimelineItem = {
  date: string;           // ISO
  title: string;
  description?: string;
  icon: any;
  tint?: "primary" | "accent" | "amber";
};

const TINT: Record<string, string> = {
  primary: "bg-primary/15 text-primary ring-primary/30",
  accent:  "bg-accent/15 text-accent ring-accent/30",
  amber:   "bg-amber-500/15 text-amber-400 ring-amber-500/30",
};

function fmt(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" })
      .format(new Date(iso));
  } catch { return iso; }
}

export function Timeline({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-center text-xs text-muted-foreground py-6">
        Your journey begins now. Start praying and reading to build your timeline.
      </p>
    );
  }
  return (
    <ol className="relative pl-6">
      <span aria-hidden className="absolute left-[15px] top-2 bottom-2 w-px bg-border/60" />
      {items.map((it, i) => {
        const Icon = it.icon;
        const tint = TINT[it.tint ?? "primary"];
        return (
          <li key={i} className="relative pb-5 last:pb-0">
            <span className={`absolute -left-6 grid h-7 w-7 place-items-center rounded-full ring-2 ${tint}`}>
              <Icon className="h-3.5 w-3.5" />
            </span>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{fmt(it.date)}</p>
            <p className="text-sm font-semibold leading-tight">{it.title}</p>
            {it.description && (
              <p className="text-xs text-muted-foreground mt-0.5">{it.description}</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
