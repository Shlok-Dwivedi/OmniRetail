import { useMemo, useState } from 'react';
import { ChevronsUpDown } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useResource } from '../api';
import type { CustomerSummary, Forecast } from '../types';
import { dayDate, number, shortDate, useWorkspace } from '../context';
import { usePalette, useReducedMotion } from '../theme';
import type { Palette } from '../theme';
import { Empty, ErrorState, Loading, Notice, PageTitle, Panel } from '../components/UI';
import Segmented from '../components/Segmented';
import {
  axisProps,
  Legend,
  niceTicks,
  ScrubReporter,
  TableView,
  TooltipCard,
} from '../components/charts';
const names: Record<string, string> = {
  RecencyDays: 'Recency',
  Frequency: 'Orders',
  MonetaryGBP: 'Spend',
  TenureDays: 'Tenure',
  AverageOrderValueGBP: 'Avg. order',
};
const views = [
  { value: 'distributions', label: 'Customer distributions' },
  { value: 'relationships', label: 'Relationships' },
  { value: 'trends', label: 'Sales rhythms' },
];
const smoothing: Record<string, string> = {
  SMA_7: '7-day average',
  SMA_30: '30-day average',
  EMA_14: '14-day exponential',
};
export default function Explore() {
  const { meta } = useWorkspace();
  const [tab, setTab] = useState('distributions');
  const [method, setMethod] = useState('pearson');
  const [smooth, setSmooth] = useState('SMA_7');
  const summary = useResource<CustomerSummary>('/customers/summary', meta.version);
  return (
    <>
      <PageTitle
        title="Explore your business"
        caption="How customers spend, which behaviors move together, and the rhythm of daily sales"
      />
      <Segmented tabs label="Analysis view" value={tab} onChange={setTab} options={views} />
      <div role="tabpanel" aria-label={views.find((v) => v.value === tab)?.label}>
        {tab === 'trends' ? (
          <Trends smooth={smooth} setSmooth={setSmooth} />
        ) : summary.error ? (
          <ErrorState message={summary.error} retry={summary.retry} />
        ) : !summary.data ? (
          <Loading />
        ) : !summary.data.total ? (
          <Empty
            title="Customer analysis needs customer IDs"
            detail="Add a CustomerID column to your sales data to explore these patterns."
          />
        ) : tab === 'distributions' ? (
          <Distributions summary={summary.data} />
        ) : (
          <Panel
            title="Which behaviors move together?"
            subtitle="Correlation describes relationships; it does not establish cause."
            action={
              <label className="popup">
                <select
                  aria-label="Correlation method"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                >
                  <option value="pearson">Pearson</option>
                  <option value="spearman">Spearman</option>
                </select>
                <ChevronsUpDown size={14} className="popup-chevron" />
              </label>
            }
          >
            <Heatmap rows={summary.data.correlations[method]} />
            <p className="panel-footnote">
              Pearson measures linear association; Spearman compares ranks. Average order value is
              calculated from total spend and order count, so those relationships are partly
              mathematical.
            </p>
          </Panel>
        )}
      </div>
    </>
  );
}
function Distributions({ summary }: { summary: CustomerSummary }) {
  const { money } = useWorkspace();
  const palette = usePalette();
  const still = useReducedMotion();
  const max = Math.max(1, ...summary.boxes.map((b) => b.max));
  const x = (v: number) => (v / max) * 380 + 10;
  const countTicks = niceTicks(Math.max(...summary.histogram.map((b) => b.count)));
  return (
    <>
      <div className="two-columns">
        <Panel
          title="How much do customers spend per order?"
          subtitle="Average order value per customer"
        >
          <div className="chart distribution-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={summary.histogram}
                margin={{ top: 8, right: 0, bottom: 0, left: 0 }}
                barCategoryGap={2}
                title="Customers by average order value"
              >
                <CartesianGrid stroke={palette.grid} vertical={false} />
                <XAxis
                  dataKey="value"
                  tickFormatter={(v) => (v >= 1000 ? money(v, true) : money(v))}
                  minTickGap={44}
                  dy={8}
                  {...axisProps(palette)}
                />
                <YAxis
                  orientation="right"
                  width={44}
                  domain={[0, countTicks[countTicks.length - 1]]}
                  ticks={countTicks}
                  tickFormatter={(v) => number(v)}
                  {...axisProps(palette)}
                />
                <Tooltip
                  cursor={{ fill: palette.grid, fillOpacity: 0.5 }}
                  isAnimationActive={false}
                  content={({ active, payload }) => {
                    const bin = payload?.[0]?.payload as
                      { value: number; count: number } | undefined;
                    return active && bin ? (
                      <TooltipCard
                        title={`Around ${money(bin.value)} per order`}
                        rows={[{ label: 'customers', value: number(bin.count) }]}
                      />
                    ) : null;
                  }}
                />
                <Bar
                  dataKey="count"
                  fill={palette.blue}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={24}
                  isAnimationActive={!still}
                  animationDuration={500}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <TableView
            summary="Show as table"
            head={['Average order (bin centre)', 'Customers']}
            rows={summary.histogram.map((b) => [money(b.value), number(b.count)])}
          />
          <p className="panel-footnote">
            Extreme monetary outliers are excluded from this distribution for readability.
          </p>
        </Panel>
        <Panel
          title="How does spending vary by market?"
          subtitle="Total spend per customer: median and middle 50%"
        >
          <div className="box-chart">
            {summary.boxes.map((b) => (
              <div className="box-row" key={b.country}>
                <span>{b.country}</span>
                <svg
                  viewBox="0 0 400 36"
                  preserveAspectRatio="none"
                  role="img"
                  aria-label={`${b.country}: median ${money(b.median)}, middle half ${money(b.q1)} to ${money(b.q3)}`}
                >
                  <line
                    x1={x(b.min)}
                    x2={x(b.max)}
                    y1="18"
                    y2="18"
                    stroke={palette.axis}
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                  />
                  <line
                    x1={x(b.min)}
                    x2={x(b.min)}
                    y1="12"
                    y2="24"
                    stroke={palette.axis}
                    vectorEffect="non-scaling-stroke"
                  />
                  <line
                    x1={x(b.max)}
                    x2={x(b.max)}
                    y1="12"
                    y2="24"
                    stroke={palette.axis}
                    vectorEffect="non-scaling-stroke"
                  />
                  <rect
                    x={x(b.q1)}
                    y="7"
                    width={Math.max(2, x(b.q3) - x(b.q1))}
                    height="22"
                    rx="3"
                    fill={palette.blue}
                    fillOpacity=".18"
                    stroke={palette.blue}
                    strokeWidth="1.5"
                    vectorEffect="non-scaling-stroke"
                  />
                  <line
                    x1={x(b.median)}
                    x2={x(b.median)}
                    y1="7"
                    y2="29"
                    stroke={palette.blue}
                    strokeWidth="2.5"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
                <b>{money(b.median)}</b>
              </div>
            ))}
          </div>
          <p className="panel-footnote">
            Boxes show the middle 50% and the line marks the median. Whiskers stop at the last value
            within 1.5 × IQR.
          </p>
        </Panel>
      </div>
      <Notice
        title={`${number(summary.outliers)} customers have unusually high or low total spending.`}
      >
        They stay in revenue totals and exports. Excluding them from these two charts keeps everyday
        patterns legible while preserving wholesale buyers in the data.
      </Notice>
    </>
  );
}
function cellColor(palette: Palette, v: number | null) {
  // Near-zero cells keep a neutral fill so the matrix holds its shape without implying a direction.
  if (v === null || Math.abs(v) < 0.05) return '#76768014';
  const hex = v >= 0 ? palette.blue : palette.orange;
  const alpha = Math.round(Math.max(0.12, Math.min(0.72, Math.abs(v) * 0.7)) * 255)
    .toString(16)
    .padStart(2, '0');
  return hex + alpha;
}
function Heatmap({ rows }: { rows: Record<string, string | number | null>[] }) {
  const palette = usePalette();
  return (
    <div className="heatmap-scroll" tabIndex={0} role="region" aria-label="Correlation matrix">
      <div className="heatmap" role="table" aria-label="Correlation coefficients">
        <div role="row" className="heatmap-row">
          <span role="columnheader" className="heatmap-corner" />
          {Object.values(names).map((n) => (
            <span key={n} role="columnheader" className="heatmap-label">
              {n}
            </span>
          ))}
        </div>
        {rows.map((row) => (
          <div role="row" className="heatmap-row" key={String(row.feature)}>
            <span role="rowheader" className="heatmap-label heatmap-rowlabel">
              {names[String(row.feature)]}
            </span>
            {Object.keys(names).map((key) => {
              const v = typeof row[key] === 'number' ? Number(row[key]) : null;
              return (
                <span
                  role="cell"
                  className="heat-cell"
                  key={key}
                  style={{ background: cellColor(palette, v) }}
                >
                  {v === null ? '—' : v.toFixed(2)}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <Legend
        items={[
          { label: 'Move together', color: palette.blue, kind: 'dot' },
          { label: 'Move apart', color: palette.orange, kind: 'dot' },
        ]}
      />
    </div>
  );
}
function Trends({ smooth, setSmooth }: { smooth: string; setSmooth: (s: string) => void }) {
  const { meta, money } = useWorkspace();
  const palette = usePalette();
  const still = useReducedMotion();
  const r = useResource<Forecast>('/forecast?horizon=30', meta.version);
  const [active, setActive] = useState<string | null>(null);
  const history = r.data?.history;
  const chart = useMemo(
    () =>
      history && (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={history}
            margin={{ top: 8, right: 0, bottom: 0, left: 0 }}
            title="Daily sales with smoothing"
          >
            <CartesianGrid stroke={palette.grid} vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={shortDate}
              minTickGap={60}
              dy={8}
              {...axisProps(palette)}
            />
            <YAxis
              orientation="right"
              tickFormatter={(v) => money(v, true)}
              width={64}
              {...axisProps(palette)}
            />
            <Tooltip
              content={() => null}
              cursor={{ stroke: palette.label, strokeOpacity: 0.28 }}
              isAnimationActive={false}
            />
            <Line
              dataKey="RevenueGBP"
              stroke={palette.blue}
              strokeOpacity={0.45}
              strokeWidth={1.25}
              dot={false}
              activeDot={false}
              isAnimationActive={!still}
            />
            <Line
              dataKey={smooth}
              stroke={palette.blue}
              strokeWidth={2}
              strokeLinecap="round"
              dot={false}
              activeDot={{ r: 5, fill: palette.blue, stroke: palette.surface, strokeWidth: 2 }}
              isAnimationActive={!still}
            />
            <ScrubReporter onChange={setActive} />
          </LineChart>
        </ResponsiveContainer>
      ),
    [history, money, palette, smooth, still],
  );
  if (r.error || (!r.data && !r.loading)) return <ErrorState message={r.error} retry={r.retry} />;
  if (!r.data) return <Loading label="Loading daily sales…" />;
  const day = active ? r.data.history.find((d) => d.date === active) : undefined;
  return (
    <>
      <Panel
        title="Daily sales, smoothed"
        subtitle={
          day
            ? `${dayDate(day.date)} · ${money(day.RevenueGBP)} sales · ${money(Number(day[smooth as keyof typeof day]))} ${smoothing[smooth].toLowerCase()}`
            : `Last ${r.data.history.length} days with a ${smoothing[smooth].toLowerCase()}`
        }
        action={
          <label className="popup">
            <select
              aria-label="Smoothing method"
              value={smooth}
              onChange={(e) => setSmooth(e.target.value)}
            >
              {Object.entries(smoothing).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <ChevronsUpDown size={14} className="popup-chevron" />
          </label>
        }
      >
        <Legend
          items={[
            { label: 'Daily sales', color: `${palette.blue}80`, kind: 'line' },
            { label: smoothing[smooth], color: palette.blue, kind: 'line' },
          ]}
        />
        <div className="chart revenue-chart trend-chart">{chart}</div>
      </Panel>
      <div className="three-columns">
        <Decomposition
          field="trend"
          label="Underlying trend"
          color={palette.blue}
          data={r.data.decomposition}
        />
        <WeeklyRhythm data={r.data.decomposition} />
        <Decomposition
          field="resid"
          label="Unexplained variation"
          color={palette.gray}
          data={r.data.decomposition}
        />
      </div>
    </>
  );
}
function Decomposition({
  field,
  label,
  color,
  data,
}: {
  field: string;
  label: string;
  color: string;
  data: Forecast['decomposition'];
}) {
  const { money } = useWorkspace();
  const palette = usePalette();
  const still = useReducedMotion();
  const [active, setActive] = useState<string | null>(null);
  const point = active ? data.find((d) => d.date === active) : undefined;
  const value = point?.[field as keyof typeof point];
  const ticks = useMemo(() => {
    const values = data
      .map((d) => d[field as keyof typeof d])
      .filter((v): v is number => typeof v === 'number');
    return niceTicks(Math.max(...values), 2, Math.min(0, ...values));
  }, [data, field]);
  const chart = useMemo(
    () => (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 0, bottom: 0, left: 0 }} title={label}>
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            minTickGap={72}
            dy={6}
            {...axisProps(palette)}
          />
          <YAxis
            orientation="right"
            width={52}
            domain={[ticks[0], ticks[ticks.length - 1]]}
            ticks={ticks}
            tickFormatter={(v) => money(v, true)}
            {...axisProps(palette)}
          />
          <Tooltip
            content={() => null}
            cursor={{ stroke: palette.label, strokeOpacity: 0.28 }}
            isAnimationActive={false}
          />
          <Area
            dataKey={field}
            stroke={color}
            strokeWidth={1.5}
            fill={color}
            fillOpacity={0.1}
            activeDot={{ r: 4, fill: color, stroke: palette.surface, strokeWidth: 2 }}
            isAnimationActive={!still}
          />
          <ScrubReporter onChange={setActive} />
        </AreaChart>
      </ResponsiveContainer>
    ),
    [color, data, field, label, money, palette, still, ticks],
  );
  return (
    <Panel
      title={label}
      subtitle={
        point && typeof value === 'number'
          ? `${dayDate(point.date)} · ${money(value)}`
          : 'Additive seasonal decomposition'
      }
    >
      <div className="chart mini-chart">{chart}</div>
    </Panel>
  );
}
const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
// The weekly seasonal component repeats every seven days, so one bar per weekday shows all of it.
function WeeklyRhythm({ data }: { data: Forecast['decomposition'] }) {
  const { money } = useWorkspace();
  const palette = usePalette();
  const [active, setActive] = useState<string | null>(null);
  const days = useMemo(() => {
    const sums = Array<number>(7).fill(0);
    const counts = Array<number>(7).fill(0);
    for (const d of data) {
      const day = (new Date(d.date.slice(0, 10) + 'T12:00:00').getDay() + 6) % 7;
      sums[day] += d.seasonal;
      counts[day] += 1;
    }
    return weekdays.map((name, i) => ({ name, value: counts[i] ? sums[i] / counts[i] : 0 }));
  }, [data]);
  const extent = Math.max(1, ...days.map((d) => Math.abs(d.value)));
  const signed = (v: number) => `${v >= 0 ? '+' : '−'}${money(Math.abs(v))}`;
  const day = days.find((d) => d.name === active);
  return (
    <Panel
      title="Weekly rhythm"
      subtitle={
        day
          ? `${day.name} · ${signed(day.value)} against the trend`
          : 'Typical effect of each weekday on sales'
      }
    >
      <div className="weekdays" onMouseLeave={() => setActive(null)}>
        {days.map((d) => (
          <div
            key={d.name}
            className={`weekday ${active === d.name ? 'active' : ''}`}
            role="img"
            aria-label={`${d.name}: ${signed(d.value)} against the trend`}
            onMouseEnter={() => setActive(d.name)}
          >
            <span className="weekday-plot">
              <i
                className={d.value >= 0 ? 'up' : 'down'}
                style={{
                  height: `${(Math.abs(d.value) / extent) * 36}%`,
                  background: palette.blue,
                }}
              />
              <b
                className="weekday-value"
                style={
                  d.value >= 0
                    ? { bottom: `calc(50% + ${(Math.abs(d.value) / extent) * 36}% + 3px)` }
                    : { top: `calc(50% + ${(Math.abs(d.value) / extent) * 36}% + 3px)` }
                }
              >
                {d.value >= 0 ? '+' : '−'}
                {money(Math.abs(d.value), true)}
              </b>
            </span>
            <span className="weekday-label">{d.name.slice(0, 3)}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
