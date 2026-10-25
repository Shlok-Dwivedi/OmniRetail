import { useMemo, useState } from 'react';
import { ChartSpline, ChevronLeft, ChevronRight, ChevronsUpDown, Search } from 'lucide-react';
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { request, useDebounce, useResource } from '../api';
import { fullDate, number, percent, useWorkspace } from '../context';
import type { Customer, CustomerSummary, Models, Prediction } from '../types';
import { bySegment, segmentColor, useMedia, usePalette, useReducedMotion } from '../theme';
import {
  Empty,
  ErrorState,
  ExportButton,
  Loading,
  PageTitle,
  Panel,
  Spinner,
} from '../components/UI';
import Segmented from '../components/Segmented';
import { axisProps, niceTicks, TooltipCard } from '../components/charts';
const views = [
  { value: 'directory', label: 'Customer directory' },
  { value: 'behavior', label: 'Buying behavior' },
  { value: 'estimate', label: 'Spend estimator' },
];
const daysAgo = (days: number) =>
  days === 0 ? 'Final day' : `${number(days)} ${days === 1 ? 'day' : 'days'} ago`;
export default function Customers() {
  const { meta, money, notify } = useWorkspace();
  const palette = usePalette();
  const compact = useMedia('(max-width: 640px)');
  const [tab, setTab] = useState('directory');
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('spend');
  const term = useDebounce(search);
  const summary = useResource<CustomerSummary>('/customers/summary', meta.version);
  const directory = useResource<{ items: Customer[]; total: number; pages: number }>(
    `/customers?${new URLSearchParams({ search: term, segment, page: String(page), sort })}`,
    meta.version,
  );
  const [inputs, setInputs] = useState({
    recency: 30,
    frequency: 5,
    tenure: 180,
    average_order_value: 100,
  });
  const [result, setResult] = useState<Prediction | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  async function predict() {
    setBusy(true);
    setFormError('');
    try {
      setResult(
        await request<Prediction>('/predict', { method: 'POST', body: JSON.stringify(inputs) }),
      );
    } catch (e) {
      setFormError((e as Error).message);
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        title="Customer intelligence"
        caption={
          summary.data
            ? `${number(summary.data.total)} identified customers, grouped by how recently and how often they buy`
            : 'Identified customers, grouped by how recently and how often they buy'
        }
        action={
          <ExportButton path="/export/customers" filename="OmniRetail-customers.csv">
            Export customers
          </ExportButton>
        }
      />
      {summary.error ? (
        <ErrorState message={summary.error} retry={summary.retry} />
      ) : !summary.data ? (
        <Loading rows={1} />
      ) : (
        summary.data.segments.length > 0 && (
          <Segments
            summary={summary.data}
            selected={segment}
            onSelect={(next) => {
              setSegment(segment === next ? '' : next);
              setPage(1);
              setTab('directory');
            }}
          />
        )
      )}
      <Segmented tabs label="Customer view" value={tab} onChange={setTab} options={views} />
      <div role="tabpanel" aria-label={views.find((v) => v.value === tab)?.label}>
        {tab === 'directory' && (
          <Panel className="directory">
            <div className="directory-toolbar">
              <label className="search-field">
                <Search size={16} />
                <input
                  type="search"
                  placeholder="Customer number or market"
                  aria-label="Search customers"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </label>
              <label className="popup">
                <select
                  aria-label="Customer segment"
                  value={segment}
                  onChange={(e) => {
                    setSegment(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All segments</option>
                  {bySegment(summary.data?.segments ?? []).map((s) => (
                    <option key={s.segment}>{s.segment}</option>
                  ))}
                </select>
                <ChevronsUpDown size={14} className="popup-chevron" />
              </label>
              <label className="popup">
                <select
                  aria-label="Sort customers"
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="spend">Highest spend</option>
                  <option value="recent">Most recent</option>
                  <option value="orders">Most orders</option>
                </select>
                <ChevronsUpDown size={14} className="popup-chevron" />
              </label>
            </div>
            {directory.error ? (
              <ErrorState message={directory.error} retry={directory.retry} />
            ) : !directory.data ? (
              <Loading rows={6} />
            ) : !directory.data.items.length ? (
              <Empty
                title="No customers match"
                detail="Try another customer number, market or segment."
              />
            ) : (
              <div className={directory.loading ? 'refreshing' : ''}>
                {compact ? (
                  <ul className="customer-list" aria-label="Customer directory">
                    {directory.data.items.map((c) => (
                      <li key={c.CustomerID}>
                        <div>
                          <strong className="customer-id">
                            {c.CustomerID.replace('CUST_', '#')}
                          </strong>
                          <span>{c.Country}</span>
                          <span className="segment-tag">
                            <i style={{ background: segmentColor(palette, c.CustomerSegment) }} />
                            {c.CustomerSegment}
                          </span>
                        </div>
                        <div className="customer-trailing">
                          <strong>{money(c.MonetaryGBP)}</strong>
                          <span>
                            {number(c.Frequency)} {c.Frequency === 1 ? 'order' : 'orders'}
                          </span>
                          <span>{daysAgo(c.RecencyDays)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div
                    className="table-scroll"
                    tabIndex={0}
                    role="region"
                    aria-label="Customer directory"
                  >
                    <table>
                      <thead>
                        <tr>
                          <th>Customer</th>
                          <th>Market</th>
                          <th>Segment</th>
                          <th className="num">Orders</th>
                          <th className="num">Total spend</th>
                          <th className="num">Last purchase</th>
                        </tr>
                      </thead>
                      <tbody>
                        {directory.data.items.map((c) => (
                          <tr key={c.CustomerID}>
                            <td className="customer-id">{c.CustomerID.replace('CUST_', '#')}</td>
                            <td>{c.Country}</td>
                            <td>
                              <span className="segment-tag">
                                <i
                                  style={{ background: segmentColor(palette, c.CustomerSegment) }}
                                />
                                {c.CustomerSegment}
                              </span>
                            </td>
                            <td className="num">{number(c.Frequency)}</td>
                            <td className="num strong">{money(c.MonetaryGBP)}</td>
                            <td className="num">{daysAgo(c.RecencyDays)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="pagination">
                  <span>
                    {number(directory.data.total)} customers
                    <span className="muted">
                      {' '}
                      · last purchase counted back from {fullDate(meta.audit.end)}
                    </span>
                  </span>
                  <div>
                    <button
                      className="icon-button"
                      aria-label="Previous page"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <span>
                      {page} / {directory.data.pages}
                    </span>
                    <button
                      className="icon-button"
                      aria-label="Next page"
                      disabled={page >= directory.data.pages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </Panel>
        )}
        {tab === 'behavior' && summary.data && <Behavior summary={summary.data} />}
        {tab === 'estimate' && (
          <>
            <div className="estimator">
              <Panel
                title="Estimate 90-day spend"
                subtitle="Describe a customer’s buying behavior so far."
              >
                <form
                  className="estimator-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void predict();
                  }}
                >
                  <div className="form-group">
                    {[
                      {
                        key: 'recency',
                        label: 'Days since last purchase',
                        max: 3650,
                        min: 0,
                        unit: 'days',
                      },
                      {
                        key: 'frequency',
                        label: 'Completed orders',
                        max: 10000,
                        min: 1,
                        unit: 'orders',
                      },
                      {
                        key: 'tenure',
                        label: 'Days as a customer',
                        max: 36500,
                        min: 1,
                        unit: 'days',
                      },
                      {
                        key: 'average_order_value',
                        label: 'Average order value',
                        max: 1000000,
                        min: 0.01,
                        unit: 'GBP',
                      },
                    ].map((f) => (
                      <label key={f.key} className="form-row">
                        <span>{f.label}</span>
                        <span className="number-field">
                          <input
                            required
                            type="number"
                            min={f.min}
                            max={f.max}
                            step={f.key === 'average_order_value' ? '.01' : '1'}
                            value={inputs[f.key as keyof typeof inputs]}
                            onChange={(e) => {
                              setInputs({ ...inputs, [f.key]: Number(e.target.value) });
                              setResult(null);
                            }}
                          />
                          <span>{f.unit}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  {formError && (
                    <p role="alert" className="form-error">
                      {formError}
                    </p>
                  )}
                  <button
                    className="button button-primary button-large"
                    disabled={busy}
                    type="submit"
                  >
                    {busy && <Spinner size={15} />}
                    {busy ? 'Calculating…' : 'Estimate spending'}
                  </button>
                </form>
              </Panel>
              <section className="panel prediction-card" aria-live="polite">
                {result ? (
                  <>
                    <span className="prediction-label">Estimated customer spend</span>
                    <strong className="prediction-value">{money(result.estimate)}</strong>
                    <span className="prediction-sub">over the next {result.horizon} days</span>
                    <RangeBar
                      lower={result.lower}
                      estimate={result.estimate}
                      upper={result.upper}
                    />
                    <dl className="prediction-facts">
                      <div>
                        <dt>Indicative range</dt>
                        <dd>
                          {money(result.lower)} – {money(result.upper)}
                        </dd>
                      </div>
                      {result.high_value_probability !== null && (
                        <div>
                          <dt>High-value likelihood</dt>
                          <dd>{percent(result.high_value_probability, 0)}</dd>
                        </div>
                      )}
                    </dl>
                    <p className="prediction-note">
                      An estimate, not a promise: past behavior and seasonal swings both move the
                      result.
                    </p>
                  </>
                ) : (
                  <div className="unavailable">
                    <ChartSpline size={30} strokeWidth={1.6} />
                    <h3>No estimate yet</h3>
                    <p>Enter the four values, then choose Estimate spending.</p>
                  </div>
                )}
              </section>
            </div>
            <ModelDetails />
          </>
        )}
      </div>
    </>
  );
}
function Segments({
  summary,
  selected,
  onSelect,
}: {
  summary: CustomerSummary;
  selected: string;
  onSelect: (segment: string) => void;
}) {
  const { money } = useWorkspace();
  const palette = usePalette();
  const segments = bySegment(summary.segments);
  const total = Math.max(1, summary.total);
  return (
    <Panel
      title="Segments"
      subtitle="Share of identified customers. Choose a segment to filter the directory."
      className="segments"
    >
      <div className="segment-bar" aria-hidden="true">
        {segments.map((s) => (
          <i
            key={s.segment}
            style={{ flexGrow: s.count, background: segmentColor(palette, s.segment) }}
          />
        ))}
      </div>
      <div className="segment-list">
        {segments.map((s) => (
          <button
            key={s.segment}
            type="button"
            className={`segment ${selected === s.segment ? 'selected' : ''}`}
            aria-pressed={selected === s.segment}
            onClick={() => onSelect(s.segment)}
          >
            <span className="segment-name">
              <i style={{ background: segmentColor(palette, s.segment) }} />
              {s.segment}
            </span>
            <strong>{number(s.count)}</strong>
            <span className="segment-meta">
              {percent(s.count / total, 0)} · {money(s.revenue, true)} in sales
            </span>
          </button>
        ))}
      </div>
    </Panel>
  );
}
const jitter = (id: string) => {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return ((((hash % 997) + 997) % 997) / 997) * 0.56 - 0.28;
};
function Behavior({ summary }: { summary: CustomerSummary }) {
  const { money } = useWorkspace();
  const palette = usePalette();
  const still = useReducedMotion();
  const points = useMemo(
    () => summary.scatter.map((c) => ({ ...c, x: c.Frequency + jitter(c.CustomerID) })),
    [summary.scatter],
  );
  const maxX = Math.max(1, ...summary.scatter.map((c) => c.Frequency));
  const step = maxX <= 6 ? 1 : maxX <= 20 ? 5 : 10;
  const ticks = [1, ...Array.from({ length: Math.floor(maxX / step) }, (_, i) => (i + 1) * step)];
  const spendTicks = niceTicks(Math.max(1, ...summary.scatter.map((c) => c.MonetaryGBP)));
  const segments = bySegment(summary.segments).filter((s) =>
    summary.scatter.some((c) => c.CustomerSegment === s.segment),
  );
  return (
    <Panel
      title="Orders and spend by segment"
      subtitle="Each dot is a customer: completed orders across, total spend up. Grey dots show the other segments."
    >
      {!summary.scatter.length ? (
        <Empty
          title="No buying behavior to show"
          detail="Import sales with customer IDs to see how customers buy."
        />
      ) : (
        <div className="multiples">
          {segments.map((s) => {
            const color = segmentColor(palette, s.segment);
            const own = points.filter((p) => p.CustomerSegment === s.segment);
            return (
              <figure key={s.segment} className="multiple">
                <figcaption>
                  <i style={{ background: color }} />
                  {s.segment}
                  <span>{number(own.length)} in sample</span>
                </figcaption>
                <div className="chart multiple-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart
                      margin={{ top: 6, right: 0, bottom: 0, left: 0 }}
                      title={`${s.segment}: orders and total spend`}
                    >
                      <CartesianGrid stroke={palette.grid} vertical={false} />
                      <XAxis
                        type="number"
                        dataKey="x"
                        name="Orders"
                        domain={[0.5, maxX + 0.5]}
                        ticks={ticks}
                        {...axisProps(palette)}
                      />
                      <YAxis
                        type="number"
                        dataKey="MonetaryGBP"
                        name="Spend"
                        orientation="right"
                        width={52}
                        domain={[0, spendTicks[spendTicks.length - 1]]}
                        ticks={spendTicks}
                        tickFormatter={(v) => money(v, true)}
                        {...axisProps(palette)}
                      />
                      <ZAxis zAxisId="context" range={[16, 16]} />
                      <ZAxis zAxisId="segment" range={[30, 30]} />
                      <Tooltip
                        cursor={false}
                        isAnimationActive={false}
                        content={({ active, payload }) => {
                          const c = payload?.[0]?.payload as (Customer & { x: number }) | undefined;
                          return active && c ? (
                            <TooltipCard
                              title={c.CustomerID.replace('CUST_', 'Customer #')}
                              rows={[
                                { label: 'total spend', value: money(c.MonetaryGBP) },
                                { label: 'orders', value: number(c.Frequency) },
                                {
                                  label: 'average order',
                                  value: money(c.AverageOrderValueGBP),
                                },
                              ]}
                            />
                          ) : null;
                        }}
                      />
                      <Scatter
                        zAxisId="context"
                        data={points.filter((p) => p.CustomerSegment !== s.segment)}
                        fill={palette.grid}
                        tooltipType="none"
                        isAnimationActive={false}
                      />
                      <Scatter
                        zAxisId="segment"
                        data={own}
                        fill={color}
                        fillOpacity={0.85}
                        isAnimationActive={!still}
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </figure>
            );
          })}
        </div>
      )}
      <p className="panel-footnote">
        A reproducible sample of up to 600 customers. Dots sit slightly apart so customers with the
        same order count don’t hide each other. Extreme wholesale spend is left out of this chart
        for readability; it remains in totals and exports.
      </p>
    </Panel>
  );
}
function RangeBar({ lower, estimate, upper }: { lower: number; estimate: number; upper: number }) {
  const scale = Math.max(upper, estimate, 1) * 1.08;
  const at = (v: number) => `${(Math.max(0, v) / scale) * 100}%`;
  return (
    <div className="range-bar" aria-hidden="true">
      <span
        className="range-bar-band"
        style={{ left: at(lower), width: `calc(${at(upper)} - ${at(lower)})` }}
      />
      <span className="range-bar-mark" style={{ left: at(estimate) }} />
    </div>
  );
}
function ModelDetails() {
  const { meta, money } = useWorkspace();
  const r = useResource<Models>('/models', meta.version);
  return (
    <details className="methodology">
      <summary>How the spending estimate is evaluated</summary>
      {r.error ? (
        <p>{r.error}</p>
      ) : !r.data ? (
        <Loading rows={2} />
      ) : (
        <>
          <p>
            The model learns from purchases before {r.data.cutoff}, then predicts the next 90
            observed days. Evaluation uses {number(r.data.test_customers)} held-out customers. It
            does not use the future period’s order value as an input.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Method</th>
                  <th className="num">Average error</th>
                  <th className="num">R²</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(r.data.models).map(([n, v]) => (
                  <tr key={n}>
                    <td>
                      {n}
                      {n === r.data!.selected && <span className="selected-tag">Selected</span>}
                    </td>
                    <td className="num">{money(v.mae)}</td>
                    <td className="num">{v.r2.toFixed(3)}</td>
                  </tr>
                ))}
                <tr>
                  <td>Simple average baseline</td>
                  <td className="num">{money(r.data.baseline_mae)}</td>
                  <td className="num">—</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>{r.data.limitations}</p>
        </>
      )}
    </details>
  );
}
