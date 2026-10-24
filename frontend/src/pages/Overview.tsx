import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Globe2, Package, TrendingUp } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useResource } from '../api';
import type { Overview as OverviewData } from '../types';
import { COLORS, fullDate, number, shortDate, useWorkspace } from '../context';
import {
  axisStyle,
  Empty,
  ErrorState,
  ExportButton,
  Loading,
  PageTitle,
  Panel,
  Stat,
  tooltipStyle,
} from '../components/UI';
import Filters from '../components/Filters';
export default function Overview() {
  const { meta, money, query, start, end } = useWorkspace();
  const { data, loading, error, retry } = useResource<OverviewData>(
    `/overview?${query}`,
    meta.version,
  );
  return (
    <>
      <PageTitle
        eyebrow="YOUR BUSINESS, AT A GLANCE"
        title="Sales performance"
        description="Track revenue, customer activity, and the products driving your sales."
        action={
          <ExportButton path={`/export/workbook?${query}`} filename="OmniRetail-report.xlsx" />
        }
      />
      <Filters />
      {loading ? (
        <Loading label="Bringing your sales into focus…" />
      ) : error || !data ? (
        <ErrorState message={error} retry={retry} />
      ) : (
        <>
          <div className="stats-grid">
            <Stat label="Sales revenue" value={money(data.revenue)} accent>
              <span className="stat-pill">
                {data.change === null
                  ? 'Completed sales'
                  : `${data.change > 0 ? '+' : ''}${data.change}% vs prior period`}
              </span>
            </Stat>
            <Stat
              tone="blue"
              label="Completed orders"
              value={number(data.orders)}
              detail={`${number(data.units)} items sold`}
            />
            <Stat
              tone="violet"
              label="Active customers"
              value={number(data.customers)}
              detail="Identified customers in this period"
            />
            <Stat
              tone="amber"
              label="Average order value"
              value={money(data.aov)}
              detail="Revenue per completed order"
            />
          </div>
          <div className="overview-charts">
            <Panel
              title="Revenue performance"
              subtitle={`${fullDate(start || meta.audit.start)} — ${fullDate(end || meta.audit.end)}`}
              action={
                <span className="chart-legend">
                  <i />
                  Sales <i className="line-dot" />
                  7-day average
                </span>
              }
            >
              {!data.daily.length ? (
                <Empty />
              ) : (
                <>
                  <div className="chart-summary">
                    <strong>{money(data.revenue)}</strong>
                    <span>across {number(data.orders)} orders</span>
                  </div>
                  <div className="chart revenue-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={data.daily}
                        margin={{ top: 15, right: 12, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#88b9ed" stopOpacity={0.2} />
                            <stop offset="100%" stopColor="#88b9ed" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#2b342e" vertical={false} strokeDasharray="3 5" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={shortDate}
                          minTickGap={48}
                          tick={axisStyle}
                          axisLine={false}
                          tickLine={false}
                          dy={10}
                        />
                        <YAxis
                          tickFormatter={(v) => money(v, true)}
                          width={65}
                          tick={axisStyle}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={tooltipStyle}
                          labelFormatter={(v) => fullDate(String(v))}
                          formatter={(v, name) => [
                            money(Number(v)),
                            name === 'revenue' ? 'Sales' : '7-day average',
                          ]}
                        />
                        <Area
                          type="monotone"
                          dataKey="revenue"
                          stroke="#88b9ed"
                          strokeWidth={1.5}
                          fill="url(#revenue-fill)"
                          animationDuration={700}
                        />
                        <Area
                          type="monotone"
                          dataKey="average"
                          stroke="#a7d9b4"
                          strokeWidth={2.2}
                          fill="transparent"
                          animationDuration={900}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </Panel>
            <Panel
              title="Your markets"
              subtitle="Where your revenue comes from"
              action={<Globe2 size={18} className="muted" />}
            >
              {!data.markets.length ? (
                <Empty />
              ) : (
                <>
                  <div className="donut-wrap">
                    <ResponsiveContainer width="100%" height={210}>
                      <PieChart>
                        <Pie
                          data={[
                            ...data.markets.slice(0, 4),
                            ...(data.markets.length > 4
                              ? [
                                  {
                                    country: 'Other markets',
                                    revenue: data.markets
                                      .slice(4)
                                      .reduce((s, v) => s + v.revenue, 0),
                                  },
                                ]
                              : []),
                          ]}
                          dataKey="revenue"
                          nameKey="country"
                          innerRadius={70}
                          outerRadius={91}
                          paddingAngle={3}
                          stroke="none"
                          cornerRadius={4}
                        >
                          {COLORS.map((c, i) => (
                            <Cell key={i} fill={c} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} formatter={(v) => money(Number(v))} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="donut-center">
                      <strong>{data.markets.length}</strong>
                      <span>markets</span>
                    </div>
                  </div>
                  <div className="market-legend">
                    {data.markets.slice(0, 4).map((m, i) => (
                      <div key={m.country}>
                        <span>
                          <i style={{ background: COLORS[i] }} />
                          {m.country}
                        </span>
                        <strong>{((m.revenue / data.revenue) * 100).toFixed(1)}%</strong>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Panel>
          </div>
          <div className="overview-bottom">
            <Panel
              title="Products leading the way"
              subtitle="Your best sellers, ranked by sales revenue"
              action={<Package size={18} className="muted" />}
            >
              {!data.products.length ? (
                <Empty />
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Units sold</th>
                        <th>Revenue</th>
                        <th>Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.products.slice(0, 5).map((p, i) => (
                        <tr key={p.code + p.name}>
                          <td>
                            <span className="product-cell">
                              <span className="product-number">
                                {String(i + 1).padStart(2, '0')}
                              </span>
                              <span>
                                {p.name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
                                <small>{p.code}</small>
                              </span>
                            </span>
                          </td>
                          <td>{number(p.units)}</td>
                          <td className="table-strong">{money(p.revenue)}</td>
                          <td>
                            <span className="share-bar">
                              <i
                                style={{
                                  width: `${Math.min(100, (p.revenue / data.revenue) * 1000)}%`,
                                }}
                              />
                            </span>
                            <span className="muted">
                              {((p.revenue / data.revenue) * 100).toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
            <section className="insight-card">
              <span className="insight-icon">
                <TrendingUp size={22} />
              </span>
              <div className="eyebrow">THE BIGGER PICTURE</div>
              <h2>
                Plan your next
                <br />
                move with clarity.
              </h2>
              <p>
                {data.markets[0]
                  ? `${data.markets[0].country} accounts for ${((data.markets[0].revenue / Math.max(1, data.revenue)) * 100).toFixed(0)}% of sales. Explore upcoming demand to plan with confidence.`
                  : 'Explore upcoming demand and plan your next move.'}
              </p>
              <Link to="/forecast">
                Explore your forecast <ArrowUpRight size={17} />
              </Link>
              <div className="insight-decoration" aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
            </section>
          </div>
          <div className="sales-note">
            <span>
              Sales exclude cancellations. Refunds: <strong>{money(data.refunds)}</strong>
              <span className="footer-dot">·</span>Net revenue:{' '}
              <strong>{money(data.net_revenue)}</strong>
            </span>
            <Link to="/reports">
              View data quality <ArrowRight size={14} />
            </Link>
          </div>
        </>
      )}
    </>
  );
}
