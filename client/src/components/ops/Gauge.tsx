import * as React from 'react';

interface GaugeProps {
  value: number; // 0..100
  label: string;
  sublabel?: string;
  size?: number;
  color?: string;
}

/** SVG radial gauge with neon glow, 270° sweep. */
export function Gauge({ value, label, sublabel, size = 150, color }: GaugeProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const auto = clamped > 90 ? 'var(--ops-red)' : clamped > 70 ? 'var(--ops-yellow)' : 'var(--ops-cyan)';
  const stroke = color ?? auto;
  const r = size / 2 - 12;
  const cx = size / 2;
  const cy = size / 2;
  const startAngle = 135;
  const sweep = 270;
  const circumference = 2 * Math.PI * r;
  const arcLen = (sweep / 360) * circumference;
  const filled = (clamped / 100) * arcLen;

  const ticks = Array.from({ length: 28 }, (_, i) => {
    const angle = ((startAngle + (i / 27) * sweep) * Math.PI) / 180;
    const inner = r - 4;
    const outer = r + 2;
    return {
      x1: cx + inner * Math.cos(angle),
      y1: cy + inner * Math.sin(angle),
      x2: cx + outer * Math.cos(angle),
      y2: cy + outer * Math.sin(angle),
      lit: (i / 27) * 100 <= clamped,
    };
  });

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(0deg)' }}>
          <circle
            cx={cx} cy={cy} r={r} fill="none"
            stroke="rgba(0,240,255,0.10)" strokeWidth={5}
            strokeDasharray={`${arcLen} ${circumference}`}
            transform={`rotate(${startAngle} ${cx} ${cy})`}
            strokeLinecap="round"
          />
          <circle
            cx={cx} cy={cy} r={r} fill="none"
            stroke={stroke} strokeWidth={5}
            strokeDasharray={`${filled} ${circumference}`}
            transform={`rotate(${startAngle} ${cx} ${cy})`}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${stroke})`, transition: 'stroke-dasharray 600ms ease, stroke 400ms' }}
          />
          {ticks.map((t, i) => (
            <line
              key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
              stroke={t.lit ? stroke : 'rgba(74,107,138,0.35)'} strokeWidth={1.4}
              style={t.lit ? { filter: `drop-shadow(0 0 3px ${stroke})` } : undefined}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="ops-display text-2xl font-bold" style={{ color: stroke, textShadow: `0 0 12px ${stroke}` }}>
            {clamped.toFixed(0)}
            <span className="text-xs opacity-70">%</span>
          </span>
          {sublabel && <span className="text-[9px] mt-0.5" style={{ color: 'var(--ops-dim)' }}>{sublabel}</span>}
        </div>
      </div>
      <span className="text-[10px] uppercase tracking-[0.24em] -mt-2" style={{ color: 'var(--ops-dim)' }}>{label}</span>
    </div>
  );
}
