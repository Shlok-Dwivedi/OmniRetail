import { useState } from 'react';
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
import { COLORS, shortDate, useWorkspace } from '../context';
import {
  axisStyle,
  Empty,
  ErrorState,
  Loading,
  PageTitle,
  Panel,
  tooltipStyle,
} from '../components/UI';
const names: Record<string, string> = {
  RecencyDays: 'Recency',
  Frequency: 'Orders',
  MonetaryGBP: 'Spend',
  TenureDays: 'Tenure',
  AverageOrderValueGBP: 'Avg. order',
};
export default function Explore() {
  const { meta, money } = useWorkspace();
  const [tab, setTab] = useState('distributions');
  const [method, setMethod] = useState('pearson');
  const [smooth, setSmooth] = useState('SMA_7');
  const summary = useResource<CustomerSummary>('/customers/summary', meta.version);
  return (
    <>
      <PageTitle
        eyebrow="LOOK A LITTLE CLOSER"
        title="Explore your business"
        description="Explore the distributions, relationships, and rhythms in your business."
      />
      <div className="tabs" role="tablist" aria-label="Analysis view">
        {[
          ['distributions', 'Customer distributions'],
          ['relationships', 'Relationships'],
          ['trends', 'Sales rhythms'],
        ].map(([id, label]) => (
          <button
            role="tab"
            aria-selected={tab === id}
            key={id}
            className={tab === id ? 'active' : ''}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'trends' ? (
        <Trends smooth={smooth} setSmooth={setSmooth} />
      ) : summary.loading ? (
        <Loading />
      ) : summary.error || !summary.data ? (
        <ErrorState message={summary.error} retry={summary.retry} />
      ) : !summary.data.total ? (
        <Empty
          title="Customer analysis needs identified customers"
          detail="Add customer identifiers to your sales data to explore these patterns."
        />
      ) : tab === 'distributions' ? (
        <>
          <div className="two-columns">
            <Panel
              title="How much do customers spend per order?"
              subtitle="Average order value across typical customers"
            >
              <div className="chart distribution-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.data.histogram}>
                    <CartesianGrid stroke="#29332c" vertical={false} strokeDasharray="3 5" />
                    <XAxis
                      dataKey="value"
                      tickFormatter={(v) => money(v, true)}
                      minTickGap={50}
                      tick={axisStyle}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={45} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelFormatter={(v) => `Average order: ${money(Number(v))}`}
                      formatter={(v) => [v, 'Customers']}
                    />
                    <Bar dataKey="count" fill="#e0bd82" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="panel-footnote">
                Extreme monetary outliers are excluded from this distribution for readability.
              </div>
            </Panel>
            <Panel
              title="Spending varies by market"
              subtitle="Median and interquartile range of total customer spend"
            >
              <div className="box-chart">
                {summary.data.boxes.map((b, i) => {
                  const max = Math.max(...summary.data!.boxes.map((v) => v.max), 1);
                  return (
                    <div className="box-row" key={b.country}>
                      <span>{b.country}</span>
                      <svg
                        viewBox="0 0 400 44"
                        role="img"
                        aria-label={`${b.country}: median ${money(b.median)}, middle half ${money(b.q1)} to ${money(b.q3)}`}
                      >
                        <line
                          x1={(b.min / max) * 380 + 5}
                          x2={(b.max / max) * 380 + 5}
                          y1="22"
                          y2="22"
                          stroke={COLORS[i]}
                        />
                        <line
                          x1={(b.max / max) * 380 + 5}
                          x2={(b.max / max) * 380 + 5}
                          y1="14"
                          y2="30"
                          stroke={COLORS[i]}
                        />
                        <rect
                          x={(b.q1 / max) * 380 + 5}
                          y="9"
                          width={Math.max(2, ((b.q3 - b.q1) / max) * 380)}
                          height="26"
                          fill={COLORS[i]}
                          fillOpacity=".25"
                          stroke={COLORS[i]}
                          rx="2"
                        />
                        <line
                          x1={(b.median / max) * 380 + 5}
                          x2={(b.median / max) * 380 + 5}
                          y1="9"
                          y2="35"
                          stroke={COLORS[i]}
                          strokeWidth="2"
                        />
                      </svg>
                      <b>{money(b.median)}</b>
                    </div>
                  );
                })}
              </div>
              <div className="panel-footnote">
                Boxes show the middle 50%; the line is the median. Whiskers stop at the last value
                within 1.5 × IQR.
              </div>
            </Panel>
          </div>
          <div className="info-banner">
            <div>
              <strong>
                {summary.data.outliers.toLocaleString()} customers have unusually high or low total
                spending.
              </strong>
              <p>
                These customers remain in revenue totals and exports. This helps preserve wholesale
                buyers while keeping everyday patterns legible.
              </p>
            </div>
          </div>
        </>
      ) : (
        <Panel
          title="Which behaviors move together?"
          subtitle="Correlation describes relationships; it does not establish cause."
          action={
            <select
              aria-label="Correlation method"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              <option value="pearson">Pearson</option>
              <option value="spearman">Spearman</option>
            </select>
          }
        >
          <div className="heatmap-scroll">
            <div className="heatmap">
              <div />
              {Object.values(names).map((n) => (
                <span key={n} className="heatmap-label">
                  {n}
                </span>
              ))}
              {summary.data.correlations[method].map((row) => (
                <HeatRow key={String(row.feature)} row={row} />
              ))}
            </div>
          </div>
          <div className="panel-footnote">
            Pearson measures linear association; Spearman compares ranks. Average order value is
            calculated from total spend and order count, so those relationships are partly
            mathematical.
          </div>
        </Panel>
      )}
    </>
  );
}
function HeatRow({ row }: { row: Record<string, string | number | null> }) {
  return (
    <>
      <span className="heatmap-label">{names[String(row.feature)]}</span>
      {Object.keys(names).map((key) => {
        const v = typeof row[key] === 'number' ? Number(row[key]) : null;
        return (
          <span
            className="heat-cell"
            key={key}
            style={{
              background:
                v === null
                  ? '#27312b'
                  : v >= 0
                    ? `rgba(167,217,180,${0.08 + v * 0.6})`
                    : `rgba(195,141,129,${0.08 + Math.abs(v) * 0.6})`,
            }}
          >
            {v === null ? '—' : v.toFixed(2)}
          </span>
        );
      })}
    </>
  );
}
function Trends({ smooth, setSmooth }: { smooth: string; setSmooth: (s: string) => void }) {
  const { meta, money } = useWorkspace();
  const r = useResource<Forecast>('/forecast?horizon=30', meta.version);
  return r.loading ? (
    <Loading label="Finding the rhythms in your sales…" />
  ) : r.error || !r.data ? (
    <ErrorState message={r.error} retry={r.retry} />
  ) : (
    <>
      <Panel
        title="See the trend through the noise"
        subtitle="Recent daily sales with your choice of smoothing"
        action={
          <select
            aria-label="Smoothing method"
            value={smooth}
            onChange={(e) => setSmooth(e.target.value)}
          >
            <option value="SMA_7">7-day average</option>
            <option value="SMA_30">30-day average</option>
            <option value="EMA_14">14-day exponential</option>
          </select>
        }
      >
        <div className="chart revenue-chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={r.data.history}>
              <CartesianGrid stroke="#29332c" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={shortDate}
                tick={axisStyle}
                minTickGap={60}
                axisLine={false}
              />
              <YAxis
                tickFormatter={(v) => money(v, true)}
                tick={axisStyle}
                width={70}
                axisLine={false}
              />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => money(Number(v))} />
              <Line dataKey="RevenueGBP" name="Sales" stroke="#65796b" dot={false} />
              <Line
                dataKey={smooth}
                name="Smoothed sales"
                stroke="#88b9ed"
                strokeWidth={2.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>
      <div className="three-columns">
        {[
          ['trend', 'Underlying trend'],
          ['seasonal', 'Weekly rhythm'],
          ['resid', 'Unexplained variation'],
        ].map(([key, label], index) => (
          <Panel key={key} title={label} subtitle="Additive seasonal decomposition">
            <div className="chart mini-chart">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={r.data!.decomposition}>
                  <XAxis
                    dataKey="date"
                    tickFormatter={shortDate}
                    tick={axisStyle}
                    minTickGap={75}
                    axisLine={false}
                  />
                  <YAxis hide />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => money(Number(v))} />
                  <Area
                    dataKey={key}
                    name={label}
                    stroke={[COLORS[0], COLORS[3], COLORS[2]][index]}
                    fill={[COLORS[0], COLORS[3], COLORS[2]][index]}
                    fillOpacity={0.08}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
}
