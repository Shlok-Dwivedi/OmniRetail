import type { MouseEvent } from 'react';
import { CalendarDays, ChevronsUpDown, Globe, RotateCcw } from 'lucide-react';
import { fullDate, useWorkspace } from '../context';
import Segmented from './Segmented';
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
  const openPicker = (event: MouseEvent<HTMLInputElement>) => {
    try {
      event.currentTarget.showPicker();
    } catch {
      // Older browsers keep their built-in date entry.
    }
  };
  const period =
    !start && !end
      ? 0
      : ([90, 30].find((days) => start === periodStart(days) && end === meta.audit.end) ?? null);
  return (
    <div className="filter-bar">
      <div className="date-range">
        <CalendarDays size={16} />
        <span className="date-field">
          <input
            aria-label="Start date"
            type="date"
            className={start ? '' : 'empty'}
            value={start}
            min={meta.audit.start}
            max={end || meta.audit.end}
            onChange={(e) => setStart(e.target.value)}
            onClick={openPicker}
          />
          {!start && (
            <span className="date-hint" aria-hidden="true">
              {fullDate(meta.audit.start)}
            </span>
          )}
        </span>
        <span aria-hidden="true">–</span>
        <span className="date-field">
          <input
            aria-label="End date"
            type="date"
            className={end ? '' : 'empty'}
            value={end}
            min={start || meta.audit.start}
            max={meta.audit.end}
            onChange={(e) => setEnd(e.target.value)}
            onClick={openPicker}
          />
          {!end && (
            <span className="date-hint" aria-hidden="true">
              {fullDate(meta.audit.end)}
            </span>
          )}
        </span>
      </div>
      <Segmented
        label="Period"
        value={period}
        onChange={preset}
        options={[
          { value: 0, label: 'All time' },
          { value: 90, label: '90 days' },
          { value: 30, label: '30 days' },
        ]}
      />
      <label className="popup">
        <Globe size={15} />
        <select aria-label="Market" value={country} onChange={(e) => setCountry(e.target.value)}>
          <option value="">All markets</option>
          {meta.countries.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <ChevronsUpDown size={14} className="popup-chevron" />
      </label>
      {(start || end || country) && (
        <button
          className="button button-plain"
          aria-label="Reset filters"
          onClick={() => {
            preset(0);
            setCountry('');
          }}
        >
          <RotateCcw size={15} />
          Reset
        </button>
      )}
    </div>
  );
}
