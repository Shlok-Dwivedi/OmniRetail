import { useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Search, Sparkles } from 'lucide-react';
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
import { COLORS, number, useWorkspace } from '../context';
import type { Customer, CustomerSummary, Models, Prediction } from '../types';
import {
  axisStyle,
  Empty,
  ErrorState,
  ExportButton,
  Loading,
  PageTitle,
  Panel,
  tooltipStyle,
} from '../components/UI';
export default function Customers() {
  const { meta, money, notify } = useWorkspace();
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
        eyebrow="PEOPLE BEHIND THE PURCHASES"
        title="Customer intelligence"
        description="Turn buying behavior into stronger customer relationships."
        action={
          <ExportButton path="/export/customers" filename="OmniRetail-customers.csv">
            Export customers
          </ExportButton>
        }
      />
      {summary.loading ? (
        <Loading />
      ) : summary.error ? (
        <ErrorState message={summary.error} retry={summary.retry} />
      ) : (
        summary.data && (
          <div className="segment-grid">
            {summary.data.segments.map((s, i) => (
              <button
                key={s.segment}
                className={`segment-card ${segment === s.segment ? 'selected' : ''}`}
                onClick={() => {
                  setSegment(segment === s.segment ? '' : s.segment);
                  setPage(1);
                  setTab('directory');
                }}
              >
                <span>
                  <i style={{ background: COLORS[i % COLORS.length] }} />
                  {s.segment}
                </span>
                <strong>{number(s.count)}</strong>
                <small>{money(s.revenue)} in sales</small>
                <span className="segment-meter">
                  <i
                    style={{
                      width: `${(s.count / summary.data!.total) * 100}%`,
                      background: COLORS[i % COLORS.length],
                    }}
                  />
                </span>
              </button>
            ))}
          </div>
        )
      )}
      <div className="tabs" role="tablist" aria-label="Customer view">
        {[
          ['directory', 'Customer directory'],
          ['behavior', 'Buying behavior'],
          ['estimate', 'Spend estimator'],
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
      {tab === 'directory' && (
        <Panel>
          <div className="directory-toolbar">
            <label className="search-field">
              <Search size={17} />
              <input
                placeholder="Search customers or markets…"
                aria-label="Search customers"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </label>
            <select
              aria-label="Customer segment"
              value={segment}
              onChange={(e) => {
                setSegment(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All segments</option>
              {summary.data?.segments.map((s) => (
                <option key={s.segment}>{s.segment}</option>
              ))}
            </select>
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
          </div>
          {directory.loading ? (
            <Loading />
          ) : directory.error ? (
            <ErrorState message={directory.error} retry={directory.retry} />
          ) : !directory.data?.items.length ? (
            <Empty
              title="No customers found"
              detail="Try another customer number, market, or segment."
            />
          ) : (
            <>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Market</th>
                      <th>Segment</th>
                      <th>Orders</th>
                      <th>Total spend</th>
                      <th>Last purchase</th>
                    </tr>
                  </thead>
                  <tbody>
                    {directory.data.items.map((c) => (
                      <tr key={c.CustomerID}>
                        <td>
                          <span className="customer-id">
                            <span className="mini-avatar">{c.CustomerID.slice(-2)}</span>
                            {c.CustomerID.replace('CUST_', '#')}
                          </span>
                        </td>
                        <td>{c.Country}</td>
                        <td>
                          <span
                            className={`segment-tag ${c.CustomerSegment === 'Champions' ? 'champion' : ''}`}
                          >
                            {c.CustomerSegment}
                          </span>
                        </td>
                        <td>{number(c.Frequency)}</td>
                        <td className="table-strong">{money(c.MonetaryGBP)}</td>
                        <td>{c.RecencyDays} days ago*</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pagination">
                <span>
                  {number(directory.data.total)} customers{' '}
                  <span className="muted">· *relative to the dataset’s closing date</span>
                </span>
                <div>
                  <button
                    className="icon-button"
                    aria-label="Previous page"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft size={17} />
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
                    <ChevronRight size={17} />
                  </button>
                </div>
              </div>
            </>
          )}
        </Panel>
      )}
      {tab === 'behavior' && (
        <Panel
          title="A closer look at loyalty"
          subtitle="Order frequency and total spend · point size reflects average order value"
        >
          {!summary.data?.scatter.length ? (
            <Empty
              title="No customer behavior to show"
              detail="Import sales with identified customers to see their buying patterns."
            />
          ) : (
            <div className="chart tall-chart">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 30, bottom: 25, left: 20 }}>
                  <CartesianGrid stroke="#29332c" strokeDasharray="3 5" />
                  <XAxis
                    type="number"
                    dataKey="Frequency"
                    name="Orders"
                    tick={axisStyle}
                    axisLine={false}
                    label={{
                      value: 'Completed orders',
                      position: 'bottom',
                      fill: '#8a978f',
                      fontSize: 12,
                    }}
                  />
                  <YAxis
                    type="number"
                    dataKey="MonetaryGBP"
                    name="Spend"
                    tickFormatter={(v) => money(v, true)}
                    tick={axisStyle}
                    width={70}
                    axisLine={false}
                  />
                  <ZAxis dataKey="AverageOrderValueGBP" range={[20, 180]} />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    contentStyle={tooltipStyle}
                    formatter={(v, n) => [
                      n === 'Spend' || n === 'AverageOrderValueGBP' ? money(Number(v)) : v,
                      n === 'AverageOrderValueGBP' ? 'Average order' : n,
                    ]}
                  />
                  {summary.data.segments.map((s, i) => (
                    <Scatter
                      key={s.segment}
                      name={s.segment}
                      data={summary.data!.scatter.filter((c) => c.CustomerSegment === s.segment)}
                      fill={COLORS[i % COLORS.length]}
                      fillOpacity={0.7}
                    />
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="panel-footnote">
            A reproducible sample of up to 600 customers. Extreme wholesale spend is omitted from
            this chart for readability; it remains in totals and exports.
          </div>
        </Panel>
      )}
      {tab === 'estimate' && (
        <>
          <div className="two-columns">
            <Panel
              title="What might their next 90 days look like?"
              subtitle="Use a customer’s current buying behavior to explore a spending estimate."
            >
              <form
                className="estimator-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void predict();
                }}
              >
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
                  { key: 'tenure', label: 'Days as a customer', max: 36500, min: 1, unit: 'days' },
                  {
                    key: 'average_order_value',
                    label: 'Average order value',
                    max: 1000000,
                    min: 0.01,
                    unit: 'GBP',
                  },
                ].map((f) => (
                  <label key={f.key}>
                    {f.label}
                    <div className="number-field">
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
                    </div>
                  </label>
                ))}
                {formError && (
                  <p role="alert" className="form-error">
                    {formError}
                  </p>
                )}
                <button className="button button-primary" disabled={busy} type="submit">
                  {busy ? <span className="loader small" /> : <Sparkles size={17} />}{' '}
                  {busy ? 'Calculating…' : 'Estimate spending'}
                  <ArrowRight size={16} />
                </button>
              </form>
            </Panel>
            <section className="prediction-card">
              <div className="eyebrow">90-DAY SPENDING OUTLOOK</div>
              {result ? (
                <>
                  <span className="prediction-label">Estimated customer spend</span>
                  <strong>{money(result.estimate)}</strong>
                  <div className="prediction-range">
                    <span>Indicative range</span>
                    <b>
                      {money(result.lower)} – {money(result.upper)}
                    </b>
                  </div>
                  {result.high_value_probability !== null && (
                    <div className="prediction-range">
                      <span>High-value likelihood</span>
                      <b>{(result.high_value_probability * 100).toFixed(0)}%</b>
                    </div>
                  )}
                  <p>
                    Use this estimate to support a decision. Historical behavior and seasonal
                    changes can affect the result.
                  </p>
                </>
              ) : (
                <>
                  <Sparkles size={44} strokeWidth={1} />
                  <h2>
                    A little context.
                    <br />A clearer outlook.
                  </h2>
                  <p>
                    Add the customer’s buying behavior to see an estimated spend and a range of
                    possible outcomes.
                  </p>
                </>
              )}
            </section>
          </div>
          <ModelDetails />
        </>
      )}
    </>
  );
}
function ModelDetails() {
  const { meta, money } = useWorkspace();
  const r = useResource<Models>('/models', meta.version);
  return (
    <details className="methodology">
      <summary>How the spending estimate is evaluated</summary>
      {r.loading ? (
        <Loading />
      ) : r.error ? (
        <p>{r.error}</p>
      ) : (
        r.data && (
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
                    <th>Average error</th>
                    <th>R²</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(r.data.models).map(([n, v]) => (
                    <tr key={n}>
                      <td>{n}</td>
                      <td>{money(v.mae)}</td>
                      <td>{v.r2.toFixed(3)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td>Simple average baseline</td>
                    <td>{money(r.data.baseline_mae)}</td>
                    <td>—</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>{r.data.limitations}</p>
          </>
        )
      )}
    </details>
  );
}
