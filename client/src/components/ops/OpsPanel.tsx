import * as React from 'react';

interface OpsPanelProps {
  title?: string;
  accent?: 'cyan' | 'magenta';
  right?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}

/** Neon panel with clipped corners + corner brackets. */
export function OpsPanel({ title, accent = 'cyan', right, className = '', bodyClassName = '', children }: OpsPanelProps) {
  const accentColor = accent === 'magenta' ? 'var(--ops-magenta)' : 'var(--ops-cyan)';
  return (
    <div className={`ops-panel ${accent === 'magenta' ? 'ops-panel-magenta' : ''} flex flex-col min-h-0 ${className}`}>
      <span className="ops-corner border-t border-l" style={{ top: -1, left: -1, borderColor: accentColor }} />
      <span className="ops-corner border-b border-r" style={{ bottom: -1, right: -1, borderColor: accentColor }} />
      {title && (
        <div
          className="flex items-center justify-between px-3 py-1.5 border-b shrink-0"
          style={{ borderColor: accent === 'magenta' ? 'rgba(255,43,214,0.2)' : 'rgba(0,240,255,0.18)' }}
        >
          <div className="flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rotate-45" style={{ background: accentColor, boxShadow: `0 0 6px ${accentColor}` }} />
            <span className="text-[10px] uppercase tracking-[0.22em]" style={{ color: accentColor }}>
              {title}
            </span>
          </div>
          {right}
        </div>
      )}
      <div className={`flex-1 min-h-0 ${bodyClassName}`}>{children}</div>
    </div>
  );
}

export function StatusDot({ ok, label }: { ok: boolean; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full ${ok ? 'ops-pulse' : ''}`}
        style={{
          background: ok ? 'var(--ops-green)' : 'var(--ops-red)',
          boxShadow: `0 0 6px ${ok ? 'var(--ops-green)' : 'var(--ops-red)'}`,
        }}
      />
      {label && <span className="text-[10px] uppercase tracking-widest" style={{ color: ok ? 'var(--ops-green)' : 'var(--ops-red)' }}>{label}</span>}
    </span>
  );
}
