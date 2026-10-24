import { useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CalendarClock, Info } from 'lucide-react';
import { useResource } from '../api';
import type { Forecast as ForecastData } from '../types';
import { fullDate } from '../context';
import { shortDate, useWorkspace } from '../context';
import {
  axisStyle,
  ErrorState,
  ExportButton,
  Loading,
  PageTitle,
  Panel,
  Stat,
  tooltipStyle,
} from '../components/UI';
export default function Forecast() {
  const { meta, money } = useWorkspace();
  const [horizon, setHorizon] = useState(30);
  const { data, loading, error, retry } = useResource<ForecastData>(
    `/forecast?horizon=${horizon}`,
    meta.version,
  );
  const points = data
    ? [
        ...data.history.map((p) => ({ date: p.date, actual: p.RevenueGBP, average: p.SMA_7 })),
        ...data.forecast.map((p) => ({
          date: p.date,
          forecast: p.PredictedRevenueGBP,
          range: [p.LowerBoundGBP, p.UpperBoundGBP],
        })),
      ]
    : [];
  return (
    <>
      <PageTitle
        eyebrow="MAKE ROOM FOR WHAT’S NEXT"
        title="Demand forecast"
        description="Understand future demand, with uncertainty in view."
        action={
          <ExportButton
            path={`/export/forecast?horizon=${horizon}`}
            filename="OmniRetail-forecast.csv"
          >
            Export forecast
          </ExportButton>
        }
      />
      <div className="forecast-toolbar">
        <span>
          <CalendarClock size={18} />
          Planning horizon
        </span>
        <div className="period-buttons">
          {[7, 14, 30, 60, 90].map((d) => (
            <button
              key={d}
              className={horizon === d ? 'selected' : ''}
              onClick={() => setHorizon(d)}
            >
              {d} days
            </button>
          ))}
        </div>
        <span className="muted">From the last observed sale</span>
      </div>
      {loading ? (
        <Loading label="Building your demand outlook…" />
      ) : error || !data ? (
        <ErrorState message={error} retry={retry} />
      ) : (
        <>
          <div className="stats-grid">
            <Stat
              label={`Next ${horizon} days`}
              value={money(data.total)}
              detail="Estimated total sales"
              accent
            />
            <Stat
              tone="blue"
              label="Daily outlook"
              value={money(data.total / horizon)}
              detail="Average expected daily sales"
            />
            <Stat
              tone="violet"
              label="Historical forecast error"
              value={money(data.rmse)}
              detail="Held-out daily revenue · RMSE"
            />
            <Stat
              tone="amber"
              label="Seasonal baseline error"
              value={money(data.baseline_rmse)}
              detail="Repeating the last observed week"
            />
          </div>
          <Panel
            title="Your demand outlook"
            subtitle={`${fullDate(data.forecast[0].date)} — ${fullDate(data.forecast[data.forecast.length - 1].date)}`}
            action={<span className="subtle-badge">95% model interval</span>}
          >
            <div className="forecast-legend">
              <span>
                <i style={{ background: '#78897e' }} />
                Observed sales
              </span>
              <span>
                <i style={{ background: '#88b9ed' }} />
                7-day average
              </span>
              <span>
                <i style={{ background: '#b8a5e8' }} />
                Forecast
              </span>
              <span>
                <i className="range-swatch" />
                Possible range
              </span>
            </div>
            <div className="chart tall-chart">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={points} margin={{ top: 20, right: 25, left: 5, bottom: 5 }}>
                  <CartesianGrid stroke="#29332c" vertical={false} strokeDasharray="3 5" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={shortDate}
                    minTickGap={55}
                    tick={axisStyle}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => money(v, true)}
                    width={75}
                    tick={axisStyle}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelFormatter={(v) => fullDate(String(v))}
                    formatter={(v, n) => [
                      Array.isArray(v)
                        ? v.map((x) => money(Number(x))).join(' – ')
                        : money(Number(v)),
                      n === 'actual'
                        ? 'Observed sales'
                        : n === 'average'
                          ? '7-day average'
                          : n === 'range'
                            ? '95% interval'
                            : 'Forecast',
                    ]}
                  />
                  <Area dataKey="range" stroke="none" fill="#b8a5e8" fillOpacity={0.15} />
                  <Line dataKey="actual" stroke="#78897e" dot={false} strokeWidth={1.4} />
                  <Line dataKey="average" stroke="#88b9ed" dot={false} strokeWidth={2} />
                  <Line
                    dataKey="forecast"
                    stroke="#b8a5e8"
                    strokeDasharray="6 4"
                    dot={false}
                    strokeWidth={2.5}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <div className="info-banner">
            <Info size={20} />
            <div>
              <strong>Plan for a range of outcomes.</strong>
              <p>
                The shaded area shows the model’s 95% interval. The forecast uses historical
                purchases, so it cannot anticipate promotions, stockouts, or changes in your
                business.
                {data.rmse > data.baseline_rmse
                  ? ' The simple weekly baseline performed better on the holdout; use this forecast cautiously.'
                  : ''}
              </p>
            </div>
          </div>
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
        </>
      )}
    </>
  );
}
