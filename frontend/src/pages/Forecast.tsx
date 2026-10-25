import { useMemo, useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CalendarClock } from 'lucide-react';
import { useResource } from '../api';
import type { Forecast as ForecastData } from '../types';
import { dateRange, dayDate, fullDate, shortDate, useWorkspace } from '../context';
import { usePalette, useReducedMotion } from '../theme';
import {
  ErrorState,
  ExportButton,
  KeyStats,
  Loading,
  Notice,
  PageTitle,
  Readout,
} from '../components/UI';
import Segmented from '../components/Segmented';
import { axisProps, Legend, ScrubReporter, TableView } from '../components/charts';
interface Point {
  date: string;
  actual?: number;
  average?: number;
  forecast?: number;
  range?: [number, number];
}
export default function Forecast() {
  const { meta } = useWorkspace();
  const [horizon, setHorizon] = useState(30);
  const { data, loading, error, retry } = useResource<ForecastData>(
    `/forecast?horizon=${horizon}`,
    meta.version,
  );
  return (
    <>
      <PageTitle
        title="Demand forecast"
        caption={`ARIMA(1, 1, 1) · counted from the last observed sale on ${fullDate(meta.audit.end)}`}
        action={
          <ExportButton
            path={`/export/forecast?horizon=${horizon}`}
            filename="OmniRetail-forecast.csv"
          >
            Export forecast
          </ExportButton>
        }
      />
      <div className="filter-bar">
        <span className="filter-label">
          <CalendarClock size={16} />
          Planning horizon
        </span>
        <Segmented
          label="Planning horizon"
          value={horizon}
          onChange={setHorizon}
          options={[7, 14, 30, 60, 90].map((d) => ({ value: d, label: `${d} days` }))}
        />
      </div>
      {error ? (
        <ErrorState message={error} retry={retry} />
      ) : !data ? (
        <Loading label="Building the forecast…" />
      ) : (
        <div className={`stack ${loading ? 'refreshing' : ''}`} aria-busy={loading}>
          <Outlook data={data} />
          {data.rmse > data.baseline_rmse && (
            <Notice tone="warning" title="The seasonal baseline beat this model on the holdout.">
              Repeating the last observed week had a{' '}
              {((1 - data.baseline_rmse / data.rmse) * 100).toFixed(0)}% lower error. Use this
              forecast with caution.
            </Notice>
          )}
          <Notice title="Plan for a range of outcomes.">
            The shaded band is the model’s 95% interval. The forecast learns only from past
            purchases, so it can’t anticipate promotions, stockouts or other changes in the
            business.
          </Notice>
          {data.warnings.map((w) => (
            <p key={w} className="form-error">
              {w}
            </p>
          ))}
          <details className="methodology">
            <summary>Forecast method & validation</summary>
            <p>
              ARIMA(1, 1, 1) is evaluated on the final 15% of the daily history, then refitted on
              all available observations. Days without purchases are recorded as zero. Refunds are
              tracked separately.
            </p>
            <p>
              Daily error percentage:{' '}
              {data.mape === null
                ? 'Unavailable (all holdout sales are zero)'
                : `${data.mape.toFixed(1)}%`}
              . Stationarity test p-value:{' '}
              {data.stationarity.p_value === null
                ? 'Not applicable to a constant series'
                : data.stationarity.p_value.toFixed(4)}
              . Sales and interval bounds are clipped to zero.
            </p>
          </details>
        </div>
      )}
    </>
  );
}
function Outlook({ data }: { data: ForecastData }) {
  const { money } = useWorkspace();
  const palette = usePalette();
  const still = useReducedMotion();
  const [active, setActive] = useState<string | null>(null);
  const points = useMemo<Point[]>(
    () => [
      ...data.history.map((p) => ({ date: p.date, actual: p.RevenueGBP, average: p.SMA_7 })),
      ...data.forecast.map((p) => ({
        date: p.date,
        forecast: p.PredictedRevenueGBP,
        range: [p.LowerBoundGBP, p.UpperBoundGBP] as [number, number],
      })),
    ],
    [data],
  );
  const point = active ? points.find((p) => p.date === active) : undefined;
  const first = data.forecast[0];
  const finalDay = data.forecast[data.forecast.length - 1];
  const chart = useMemo(
    () => (
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={points}
          margin={{ top: 8, right: 0, bottom: 0, left: 0 }}
          title="Observed daily sales and forecast with 95% interval"
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
          {first && (
            <ReferenceLine
              x={first.date}
              stroke={palette.axis}
              strokeOpacity={0.5}
              ifOverflow="extendDomain"
              label={{
                value: `Forecast · ${shortDate(first.date)}`,
                position: 'insideTopLeft',
                fill: palette.axis,
                fontSize: 12,
              }}
            />
          )}
          <Area
            dataKey="range"
            stroke="none"
            fill={palette.orange}
            fillOpacity={0.16}
            activeDot={false}
            isAnimationActive={!still}
          />
          <Line
            dataKey="actual"
            stroke={palette.blue}
            strokeOpacity={0.5}
            strokeWidth={1.25}
            dot={false}
            activeDot={false}
            isAnimationActive={!still}
          />
          <Line
            dataKey="average"
            stroke={palette.blue}
            strokeWidth={2}
            strokeLinecap="round"
            dot={false}
            activeDot={{ r: 5, fill: palette.blue, stroke: palette.surface, strokeWidth: 2 }}
            isAnimationActive={!still}
          />
          <Line
            dataKey="forecast"
            stroke={palette.orange}
            strokeWidth={2}
            strokeDasharray="5 4"
            strokeLinecap="round"
            dot={false}
            activeDot={{ r: 5, fill: palette.orange, stroke: palette.surface, strokeWidth: 2 }}
            isAnimationActive={!still}
          />
          <ScrubReporter onChange={setActive} />
        </ComposedChart>
      </ResponsiveContainer>
    ),
    [first, money, palette, points, still],
  );
  const scrubbingForecast = point?.forecast !== undefined && point.actual === undefined;
  return (
    <section className="panel revenue-panel">
      <div className="readout-row">
        <Readout
          live={!!point}
          label={point ? dayDate(point.date) : `Next ${data.horizon} days`}
          value={money(
            point ? ((scrubbingForecast ? point.forecast : point.actual) ?? 0) : data.total,
          )}
          detail={
            !point
              ? first && finalDay
                ? `Estimated total sales · ${dateRange(first.date, finalDay.date)}`
                : 'Estimated total sales'
              : scrubbingForecast && point.range
                ? `Forecast · 95% interval ${money(point.range[0])} – ${money(point.range[1])}`
                : `Observed sales · ${money(point.average ?? 0)} 7-day average`
          }
        />
        <Legend
          items={[
            { label: 'Daily sales', color: `${palette.blue}80`, kind: 'line' },
            { label: '7-day average', color: palette.blue, kind: 'line' },
            { label: 'Forecast', color: palette.orange, kind: 'dash' },
            { label: '95% interval', color: palette.orange, kind: 'band' },
          ]}
        />
      </div>
      <div className="chart forecast-chart">{chart}</div>
      <KeyStats
        items={[
          ['Average per day', money(data.total / Math.max(1, data.horizon))],
          ['Model error (RMSE)', money(data.rmse)],
          ['Baseline error (RMSE)', money(data.baseline_rmse)],
          ['Daily error (MAPE)', data.mape === null ? '—' : `${data.mape.toFixed(1)}%`],
        ]}
      />
      <TableView
        summary="Daily forecast"
        head={['Date', 'Forecast', 'Low (95%)', 'High (95%)']}
        rows={data.forecast.map((p) => [
          fullDate(p.date),
          money(p.PredictedRevenueGBP),
          money(p.LowerBoundGBP),
          money(p.UpperBoundGBP),
        ])}
      />
    </section>
  );
}
