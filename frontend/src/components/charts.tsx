import type { CSSProperties, ReactNode } from 'react';
import { useEffect } from 'react';
import { useActiveTooltipLabel, useIsTooltipActive } from 'recharts';
import type { Palette } from '../theme';

export const axisProps = (palette: Palette) => ({
  tick: { fontSize: 12, fill: palette.axis },
  axisLine: false,
  tickLine: false,
});

// Round axis steps (1, 2, 2.5 or 5 × 10ⁿ) so ticks read 0 / 500 / 1,000 rather than 0 / 450 / 900.
export function niceTicks(max: number, target = 4, min = 0) {
  if (!(max > min)) return [min, min + 1];
  const raw = (max - min) / target;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? 10 * power;
  const first = Math.floor(min / step) * step;
  return Array.from({ length: Math.ceil((max - first) / step) + 1 }, (_, i) => first + i * step);
}

// Reports the point under the pointer (or keyboard focus) so a card can rewrite its headline.
export function ScrubReporter({ onChange }: { onChange: (label: string | null) => void }) {
  const active = useIsTooltipActive();
  const label = useActiveTooltipLabel();
  useEffect(() => {
    onChange(active && label != null ? String(label) : null);
  }, [active, label, onChange]);
  return null;
}

// Hover layer for charts without a headline: the value leads, the series name follows.
export function TooltipCard({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: string; color?: string }[];
}) {
  return (
    <div className="chart-tooltip">
      <span className="chart-tooltip-title">{title}</span>
      {rows.map((row) => (
        <span className="chart-tooltip-row" key={row.label}>
          {row.color && <i style={{ background: row.color }} />}
          <b>{row.value}</b>
          {row.label}
        </span>
      ))}
    </div>
  );
}

export function Legend({
  items,
}: {
  items: { label: string; color: string; kind?: 'bar' | 'line' | 'dash' | 'band' | 'dot' }[];
}) {
  return (
    <ul className="legend">
      {items.map((item) => (
        <li key={item.label}>
          <span
            className={`legend-key legend-${item.kind ?? 'bar'}`}
            style={{ '--key': item.color } as CSSProperties}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

export function TableView({
  summary,
  head,
  rows,
}: {
  summary: string;
  head: string[];
  rows: ReactNode[][];
}) {
  return (
    <details className="table-view">
      <summary>{summary}</summary>
      <div className="table-scroll" tabIndex={0} role="region" aria-label={summary}>
        <table>
          <thead>
            <tr>
              {head.map((h, i) => (
                <th key={h} className={i ? 'num' : ''}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, i) => (
                  <td key={i} className={i ? 'num' : ''}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
