import { CalendarDays, Globe2, RotateCcw } from 'lucide-react';
import { useWorkspace } from '../context';
export default function Filters() {
  const { meta, start, end, setStart, setEnd, country, setCountry } = useWorkspace();
  function periodStart(days: number) {
    const final = new Date(meta.audit.end + 'T12:00:00');
    final.setDate(final.getDate() - days + 1);
    return final.toISOString().slice(0, 10);
  }
  function preset(days: number) {
    if (!days) {
      setStart('');
      setEnd('');
      return;
    }
    setStart(periodStart(days));
    setEnd(meta.audit.end);
  }
  return (
    <div className="filter-bar">
      <div className="filter-group">
        <CalendarDays size={16} />
        <label>
          <span className="sr-only">Start date</span>
          <input
            aria-label="Start date"
            type="date"
            value={start}
            min={meta.audit.start}
            max={end || meta.audit.end}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <span className="muted">—</span>
        <label>
          <span className="sr-only">End date</span>
          <input
            aria-label="End date"
            type="date"
            value={end}
            min={start || meta.audit.start}
            max={meta.audit.end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
      </div>
      <div className="period-buttons">
        <button className={!start && !end ? 'selected' : ''} onClick={() => preset(0)}>
          All time
        </button>
        {[90, 30].map((days) => (
          <button
            key={days}
            className={start === periodStart(days) && end === meta.audit.end ? 'selected' : ''}
            onClick={() => preset(days)}
          >
            {days} days
          </button>
        ))}
      </div>
      <label className="market-filter">
        <Globe2 size={16} />
        <select aria-label="Market" value={country} onChange={(e) => setCountry(e.target.value)}>
          <option value="">All markets</option>
          {meta.countries.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      {(start || end || country) && (
        <button
          className="icon-button"
          title="Reset filters"
          aria-label="Reset filters"
          onClick={() => {
            preset(0);
            setCountry('');
          }}
        >
          <RotateCcw size={16} />
        </button>
      )}
    </div>
  );
}
