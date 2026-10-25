import { useEffect, useRef, useState } from 'react';
import {
  CircleCheck,
  Download,
  FileSpreadsheet,
  FileText,
  FileUp,
  Globe,
  RefreshCw,
} from 'lucide-react';
import { download, request } from '../api';
import { dateRange, number, percent, useWorkspace } from '../context';
import type { Currency } from '../types';
import { ExportButton, PageTitle, Panel, Spinner } from '../components/UI';
interface ImportJob {
  id: string;
  status: string;
  filename: string;
  message?: string;
}
export default function Reports() {
  const { meta, refresh, query, notify, setStart, setEnd, setCountry } = useWorkspace();
  const [file, setFile] = useState<File | null>(null);
  const [job, setJob] = useState<ImportJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [fxBusy, setFxBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (!job || job.status !== 'processing') return;
    let stopped = false;
    const timer = setInterval(async () => {
      try {
        const next = await request<ImportJob>(`/import/${job.id}`);
        if (stopped) return;
        setJob(next);
        if (next.status === 'complete') {
          notify('Your sales data is ready to explore.');
          setStart('');
          setEnd('');
          setCountry('');
          refresh();
        } else if (next.status === 'failed') notify(next.message || 'Import failed.', true);
      } catch (e) {
        if (!stopped) {
          setJob({ ...job, status: 'failed', message: (e as Error).message });
        }
      }
    }, 1500);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [job, notify, refresh, setStart, setEnd, setCountry]);
  function choose(next: File | null) {
    if (next && next.size > 40 * 1024 * 1024) {
      notify('Choose a file smaller than 40 MB.', true);
      return;
    }
    setFile(next);
    setJob(null);
  }
  async function upload() {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const next = await request<ImportJob>('/import', { method: 'POST', body: form });
      if (alive.current) setJob(next);
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  async function rates() {
    setFxBusy(true);
    try {
      const result = await request<Currency>('/currency/refresh', { method: 'POST' });
      notify(`Historical exchange rates loaded for ${result.date}.`);
      refresh();
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setFxBusy(false);
    }
  }
  const audit = meta.audit;
  const retained = audit.clean_rows / Math.max(1, audit.raw_rows);
  const importing = busy || job?.status === 'processing';
  return (
    <>
      <PageTitle
        title="Data & reports"
        caption={`${meta.name} · ${number(audit.clean_rows)} validated rows · ${dateRange(audit.start, audit.end)}`}
      />
      <div className="report-grid">
        <section className="panel report-feature">
          <FileSpreadsheet size={34} strokeWidth={1.5} className="report-icon" />
          <div>
            <h2>Business report</h2>
            <p>
              Sales, markets, products, customer profiles and data quality in one Excel workbook,
              with charts ready to share.
            </p>
            <small>
              Sales sheets follow the Overview filters. Customer profiles cover all history. All
              values in GBP.
            </small>
          </div>
          <ExportButton
            path={`/export/workbook?${query}`}
            filename="OmniRetail-report.xlsx"
            primary
          >
            Download Excel report
          </ExportButton>
        </section>
        <Panel title="Detailed exports" subtitle="The CSV files behind the dashboard">
          <ul className="export-list">
            {[
              {
                label: 'Sales transactions',
                detail: 'Current Overview selection · GBP',
                path: `/export/transactions?${query}`,
                filename: 'OmniRetail-transactions.csv',
              },
              {
                label: 'Customer profiles',
                detail: 'All history · all segments',
                path: '/export/customers',
                filename: 'OmniRetail-customers.csv',
              },
              {
                label: 'Demand forecast',
                detail: 'Next 30 days with the 95% interval',
                path: '/export/forecast?horizon=30',
                filename: 'OmniRetail-forecast.csv',
              },
            ].map((item) => (
              <li key={item.label}>
                <FileText size={20} strokeWidth={1.7} />
                <span>
                  {item.label}
                  <small>{item.detail}</small>
                </span>
                <ExportButton path={item.path} filename={item.filename} compact>
                  CSV
                </ExportButton>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      <div className="two-columns">
        <Panel
          title="Data quality"
          subtitle={meta.name}
          action={
            <span className="status-tag">
              <CircleCheck size={14} />
              Validated
            </span>
          }
        >
          <div className="quality-top">
            <strong>{number(audit.clean_rows)}</strong>
            <span>clean product transactions</span>
          </div>
          <div className="meter" aria-hidden="true">
            <i style={{ width: `${retained * 100}%` }} />
          </div>
          <p className="meter-caption">
            {percent(retained)} of {number(audit.raw_rows)} source rows retained
          </p>
          <dl className="quality-list">
            {[
              ['Duplicate rows removed', audit.duplicate_rows],
              ['Invalid rows removed', audit.invalid_rows],
              ['Administrative rows removed', audit.administrative_rows],
              ['Refund lines retained', audit.return_rows],
              ['Guest purchases retained', audit.guest_rows],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <dt>{label}</dt>
                <dd>{number(Number(value))}</dd>
              </div>
            ))}
          </dl>
          <p className="panel-footnote">
            {dateRange(audit.start, audit.end)} · {number(meta.countries.length)} markets. Guest
            sales count toward revenue; customer analysis includes identified purchasers only.
          </p>
        </Panel>
        <Panel
          title="Import sales data"
          subtitle="Replace the active dataset with your own transactions"
        >
          <div
            className={`drop-zone ${drag ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              if (!importing) choose(e.dataTransfer.files[0] || null);
            }}
          >
            <FileUp size={30} strokeWidth={1.5} />
            <strong>{file ? file.name : 'Drop a sales file here'}</strong>
            <p>
              {file
                ? `${(file.size / 1024 / 1024).toFixed(2)} MB · ready to import`
                : 'CSV, Excel, JSON or XML, up to 40 MB'}
            </p>
            <button className="button" disabled={importing} onClick={() => input.current?.click()}>
              {file ? 'Choose another file' : 'Choose a file'}
            </button>
            <input
              ref={input}
              type="file"
              className="sr-only"
              aria-label="Sales file"
              accept=".csv,.txt,.xlsx,.json,.xml"
              onChange={(e) => choose(e.target.files?.[0] || null)}
            />
          </div>
          {file && (
            <button
              className="button button-primary button-large import-button"
              disabled={importing || job?.status === 'complete'}
              onClick={() => void upload()}
            >
              {importing && <Spinner size={15} />}
              {importing
                ? 'Validating your sales…'
                : job?.status === 'complete'
                  ? 'Import complete'
                  : 'Import & open workspace'}
            </button>
          )}
          {job?.status === 'failed' && (
            <p className="form-error" role="alert">
              {job.message}
            </p>
          )}
          <p className="upload-note">
            Importing replaces the active analysis after validation. Your original files stay on
            disk.
          </p>
          <button
            className="text-button"
            onClick={() =>
              download('/template', 'retail-import-template.csv').catch((e) =>
                notify(e.message, true),
              )
            }
          >
            <Download size={15} />
            Download a sample file
          </button>
          <details className="import-help">
            <summary>What should my file contain?</summary>
            <p>
              Each row is a product line. Required columns: InvoiceNo, StockCode, Quantity,
              InvoiceDate, UnitPrice, Country. Include CustomerID for customer insights and
              Description for product names. Prices must be in GBP. Use negative quantities or an
              invoice starting with C for refunds.
            </p>
            <p>
              Excel uses its first sheet; JSON accepts a transaction array; XML uses one child
              element per transaction. Forecasts need 30 days of history, and spending estimates
              need 120 days and 30 identified customers.
            </p>
          </details>
        </Panel>
      </div>
      <Panel title="Display currency" subtitle="Transactions are recorded in British pounds.">
        <div className="currency-row">
          <Globe size={20} strokeWidth={1.7} />
          <div>
            <strong>
              {meta.currency.status === 'original'
                ? 'Showing original GBP values'
                : `Historical rates · ${meta.currency.date}`}
            </strong>
            <p>
              {meta.currency.status === 'original'
                ? 'Load historical exchange rates to view the dashboard in USD or INR.'
                : `${meta.currency.source}. Display rates come from the dataset’s closing date; exports keep the original GBP amounts.`}
            </p>
          </div>
          <button className="button" disabled={fxBusy} onClick={() => void rates()}>
            {fxBusy ? <Spinner size={14} /> : <RefreshCw size={15} />}
            {fxBusy
              ? 'Loading rates…'
              : meta.currency.status === 'original'
                ? 'Load exchange rates'
                : 'Refresh rates'}
          </button>
        </div>
      </Panel>
    </>
  );
}
