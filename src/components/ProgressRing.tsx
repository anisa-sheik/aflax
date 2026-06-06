type Props = {
  value: number;          // 0..100
  size?: number;
  stroke?: number;
  trackClassName?: string;
  ringClassName?: string;
  children?: React.ReactNode;
};

export function ProgressRing({
  value,
  size = 64,
  stroke = 6,
  trackClassName = "stroke-white/10",
  ringClassName = "stroke-primary",
  children,
}: Props) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const dash = (pct / 100) * c;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className={trackClassName} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          className={`${ringClassName} transition-[stroke-dasharray] duration-700 ease-out`}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}
