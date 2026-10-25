import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowRight, ArrowUp, CalendarDays, Globe, RotateCcw } from 'lucide-react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useResource } from '../api';
import type { Overview as OverviewData } from '../types';
import {
  dateRange,
  dayDate,
  fullDate,
  monthDate,
  number,
  percent,
  shortDate,
  useWorkspace,
} from '../context';
import { usePalette, useReducedMotion } from '../theme';
import {
  Empty,
  ErrorState,
  ExportButton,
  KeyStats,
  Loading,
  PageTitle,
  Panel,
  Readout,
} from '../components/UI';
import { axisProps, Legend, ScrubReporter, TableView } from '../components/charts';
import Filters from '../components/Filters';
const productName = (name: string) =>
  name
    .toLowerCase()
    .replace(/\s+,/g, ',')
    .replace(/\b\w/g, (c) => c.toUpperCase());
export default function Overview() {
  const { meta, query, start, end } = useWorkspace();
  const { data, loading, error, retry } = useResource<OverviewData>(
    `/overview?${query}`,
    meta.version,
  );
  return (
    <>
      <PageTitle
        title="Sales performance"
        caption={`${meta.name} · ${dateRange(start || meta.audit.start, end || meta.audit.end)}`}
        action={
          <ExportButton path={`/export/workbook?${query}`} filename="OmniRetail-report.xlsx" />
        }
      />
      <Filters />
      {error ? (
        <ErrorState message={error} retry={retry} />
      ) : !data ? (
        <Loading label="Loading sales…" />
      ) : (
        <div className={`stack ${loading ? 'refreshing' : ''}`} aria-busy={loading}>
          <Revenue data={data} />
          <div className="overview-grid">
            <Markets data={data} />
            <Products data={data} />
          </div>
          <Highlights data={data} />
          <p className="page-note">
            Sales exclude cancellations; refunds are reported separately.{' '}
            <Link to="/reports">
              Data quality <ArrowRight size={13} />
            </Link>
          </p>
        </div>
      )}
    </>
  );
}
function Revenue({ data }: { data: OverviewData }) {
  const { money } = useWorkspace();
  const palette = usePalette();
  const still = useReducedMotion();
  const [active, setActive] = useState<string | null>(null);
  const day = active ? data.daily.find((d) => d.date === active) : undefined;
  const dense = data.daily.length > 120;
  const chart = useMemo(
    () => (
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data.daily}
          margin={{ top: 8, right: 0, bottom: 0, left: 0 }}
          title="Daily sales with a 7-day average"
        >
          <CartesianGrid stroke={palette.grid} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            minTickGap={56}
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
          {dense ? (
            <Area
              dataKey="revenue"
              type="monotone"
              stroke={palette.blue}
              strokeOpacity={0.45}
              strokeWidth={1}
              fill={palette.blue}
              fillOpacity={0.1}
              activeDot={false}
              isAnimationActive={!still}
              animationDuration={500}
            />
          ) : (
            <Bar
              dataKey="revenue"
              fill={palette.blue}
              fillOpacity={0.32}
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
              isAnimationActive={!still}
              animationDuration={500}
            />
          )}
          <Line
            dataKey="average"
            type="monotone"
            stroke={palette.blue}
            strokeWidth={2}
            strokeLinecap="round"
            dot={false}
            activeDot={{ r: 5, fill: palette.blue, stroke: palette.surface, strokeWidth: 2 }}
            isAnimationActive={!still}
            animationDuration={700}
          />
          <ScrubReporter onChange={setActive} />
        </ComposedChart>
      </ResponsiveContainer>
    ),
    [data.daily, dense, money, palette, still],
  );
  const months = useMemo(() => {
    const totals = new Map<string, { revenue: number; orders: number }>();
    for (const d of data.daily) {
      const month = totals.get(d.date.slice(0, 7)) ?? { revenue: 0, orders: 0 };
      month.revenue += d.revenue;
      month.orders += d.orders;
      totals.set(d.date.slice(0, 7), month);
    }
    return [...totals];
  }, [data.daily]);
  const change =
    data.change === null ? null : (
      <span className={`delta ${data.change >= 0 ? 'delta-up' : 'delta-down'}`}>
        {data.change >= 0 ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
        {Math.abs(data.change)}% vs previous period
      </span>
    );
  return (
    <section className="panel revenue-panel">
      <div className="readout-row">
        <Readout
          live={!!day}
          label={day ? dayDate(day.date) : 'Revenue'}
          value={money(day ? day.revenue : data.revenue)}
          detail={
            day ? (
              `${money(day.average)} 7-day average · ${number(day.orders)} orders`
            ) : (
              <>
                {change}
                {change && ' · '}
                {number(data.orders)} completed orders
              </>
            )
          }
        />
        <Legend
          items={[
            { label: 'Daily sales', color: palette.blue, kind: dense ? 'band' : 'bar' },
            { label: '7-day average', color: palette.blue, kind: 'line' },
          ]}
        />
      </div>
      {!data.daily.length ? <Empty /> : <div className="chart revenue-chart">{chart}</div>}
      <KeyStats
        items={[
          ['Orders', number(data.orders)],
          ['Items sold', number(data.units)],
          ['Customers', number(data.customers)],
          ['Average order', money(data.aov)],
          ['Refunds', money(data.refunds)],
          ['Net revenue', money(data.net_revenue)],
        ]}
      />
      {months.length > 0 && (
        <TableView
          summary="Monthly totals"
          head={['Month', 'Orders', 'Revenue']}
          rows={months.map(([month, m]) => [monthDate(month), number(m.orders), money(m.revenue)])}
        />
      )}
    </section>
  );
}
function Markets({ data }: { data: OverviewData }) {
  const { money } = useWorkspace();
  const palette = usePalette();
  const rest = data.markets.slice(5);
  const rows = [
    ...data.markets.slice(0, 5).map((m) => ({ name: m.country, revenue: m.revenue, other: false })),
    ...(rest.length
      ? [
          {
            name: `${rest.length} other ${rest.length === 1 ? 'market' : 'markets'}`,
            revenue: rest.reduce((sum, m) => sum + m.revenue, 0),
            other: true,
          },
        ]
      : []),
  ];
  const total = Math.max(1, data.revenue);
  return (
    <Panel
      title="Markets"
      subtitle={`Share of revenue across ${number(data.markets.length)} ${data.markets.length === 1 ? 'market' : 'markets'}`}
    >
      {!rows.length ? (
        <Empty />
      ) : (
        <ul className="bar-list">
          {rows.map((r) => (
            <li key={r.name}>
              <span className="bar-list-name">{r.name}</span>
              <span className="bar-list-bar" aria-hidden="true">
                <i
                  style={{
                    width: `${Math.min(100, (r.revenue / total) * 100)}%`,
                    background: r.other ? palette.gray : palette.blue,
                  }}
                />
              </span>
              <span className="bar-list-value">{percent(r.revenue / data.revenue)}</span>
              <span className="bar-list-detail">{money(r.revenue, true)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
function Products({ data }: { data: OverviewData }) {
  const { money } = useWorkspace();
  return (
    <Panel title="Top products" subtitle="Best sellers by revenue">
      {!data.products.length ? (
        <Empty />
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th className="num hide-sm">Units sold</th>
                <th className="num">Revenue</th>
                <th className="num">Share</th>
              </tr>
            </thead>
            <tbody>
              {data.products.slice(0, 5).map((p, i) => (
                <tr key={p.code + p.name}>
                  <td>
                    <span className="product-cell">
                      <span className="rank">{i + 1}</span>
                      <span>
                        {productName(p.name)}
                        <small>{p.code}</small>
                      </span>
                    </span>
                  </td>
                  <td className="num hide-sm">{number(p.units)}</td>
                  <td className="num strong">{money(p.revenue)}</td>
                  <td className="num">{percent(p.revenue / data.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
function Highlights({ data }: { data: OverviewData }) {
  const { money, country } = useWorkspace();
  const trading = data.daily.filter((d) => d.orders > 0);
  if (!trading.length || !data.revenue) return null;
  const leader = data.markets[0];
  const busiest = trading.reduce((best, d) => (d.revenue > best.revenue ? d : best));
  const typical = trading.reduce((sum, d) => sum + d.revenue, 0) / trading.length;
  const items = [
    !country &&
      leader && {
        icon: Globe,
        key: 'markets',
        title: `${leader.country} brings in ${percent(leader.revenue / data.revenue, 0)} of revenue.`,
        detail: `${money(leader.revenue)} from ${number(leader.orders)} orders.`,
      },
    {
      icon: CalendarDays,
      key: 'busiest',
      title: `${fullDate(busiest.date)} was the busiest day.`,
      detail: `${money(busiest.revenue)} in sales, ${(busiest.revenue / typical).toFixed(1)}× an average trading day.`,
    },
    {
      icon: RotateCcw,
      key: 'refunds',
      title: `Refunds came to ${percent(data.refunds / data.revenue)} of sales.`,
      detail: `${money(data.refunds)} refunded, leaving ${money(data.net_revenue)} in net revenue.`,
    },
  ].filter((item) => !!item);
  return (
    <section className="highlights" aria-labelledby="highlights-title">
      <h2 id="highlights-title" className="section-title">
        Highlights
      </h2>
      <ul className="panel highlight-list">
        {items.map(({ icon: Icon, key, title, detail }) => (
          <li key={key}>
            <Icon size={20} strokeWidth={1.8} />
            <div>
              <strong>{title}</strong>
              <p>{detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
