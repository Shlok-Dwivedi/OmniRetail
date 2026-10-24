import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  FileChartColumn,
  FileSpreadsheet,
  Globe2,
  RefreshCw,
  UploadCloud,
} from 'lucide-react';
import { download, request } from '../api';
import { fullDate, number, useWorkspace } from '../context';
import type { Currency } from '../types';
import { ExportButton, PageTitle, Panel } from '../components/UI';
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
  const importing = busy || job?.status === 'processing';
  return (
    <>
      <PageTitle
        eyebrow="YOUR DATA, WORKING FOR YOU"
        title="Data & reports"
        description="Bring your data together. Take your insights with you."
      />
      <div className="report-downloads">
        <section className="download-feature">
          <span className="report-icon">
            <FileSpreadsheet size={26} />
          </span>
          <div>
            <span className="eyebrow">READY TO SHARE</span>
            <h2>The complete business report.</h2>
            <p>
              Sales, markets, products, customer profiles and data quality in one Excel workbook,
              with ready-made charts.
            </p>
            <ExportButton
              path={`/export/workbook?${query}`}
              filename="OmniRetail-report.xlsx"
              primary
            >
              Download Excel report
            </ExportButton>
            <small>
              Sales sheets follow your overview filters. Customer profiles cover all history. All
              values in GBP.
            </small>
          </div>
        </section>
        <Panel title="Take a closer look" subtitle="Download the detail behind your dashboard">
          <div className="export-list">
            <div>
              <span>
                <FileChartColumn size={20} />
                Sales transactions<small>Current overview selection · GBP</small>
              </span>
              <ExportButton
                path={`/export/transactions?${query}`}
                filename="OmniRetail-transactions.csv"
              >
                CSV
              </ExportButton>
            </div>
            <div>
              <span>
                <FileChartColumn size={20} />
                Customer profiles<small>All history · all segments</small>
              </span>
              <ExportButton path="/export/customers" filename="OmniRetail-customers.csv">
                CSV
              </ExportButton>
            </div>
            <div>
              <span>
                <FileChartColumn size={20} />
                Demand outlook<small>Next 30 days · forecast & range</small>
              </span>
              <ExportButton path="/export/forecast?horizon=30" filename="OmniRetail-forecast.csv">
                CSV
              </ExportButton>
            </div>
          </div>
        </Panel>
      </div>
      <div className="two-columns">
        <Panel
          title="A healthy foundation"
          subtitle={meta.name}
          action={
            <span className="subtle-badge">
              <CheckCircle2 size={14} />
              Validated
            </span>
          }
        >
          <div className="quality-top">
            <strong>{number(audit.clean_rows)}</strong>
            <span>clean product transactions</span>
            <div className="quality-meter">
              <i style={{ width: `${(audit.clean_rows / audit.raw_rows) * 100}%` }} />
            </div>
            <p>
              {((audit.clean_rows / audit.raw_rows) * 100).toFixed(1)}% of {number(audit.raw_rows)}{' '}
              source rows retained
            </p>
          </div>
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
          <div className="panel-footnote">
            {fullDate(audit.start)} — {fullDate(audit.end)} · {meta.countries.length} markets
            <br />
            Guest sales count toward revenue; customer analysis includes identified purchasers only.
          </div>
        </Panel>
        <Panel
          title="Bring your own sales"
          subtitle="Create a new analysis from your transaction history"
        >
          <div
            className={`drop-zone ${drag ? 'dragging' : ''}`}
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
            <UploadCloud size={30} />
            <strong>{file ? file.name : 'A fresh perspective starts with your data.'}</strong>
            <p>
              {file
                ? `${(file.size / 1024 / 1024).toFixed(2)} MB · ready to import`
                : 'Drop your sales file here, or choose one below.'}
            </p>
            <button className="button" disabled={importing} onClick={() => input.current?.click()}>
              Choose a file
            </button>
            <input
              ref={input}
              type="file"
              className="sr-only"
              aria-label="Sales file"
              accept=".csv,.txt,.xlsx,.json,.xml"
              onChange={(e) => choose(e.target.files?.[0] || null)}
            />
            <small>CSV, Excel, JSON or XML · up to 40 MB</small>
          </div>
          {file && (
            <button
              className="button button-primary import-button"
              disabled={importing || job?.status === 'complete'}
              onClick={() => void upload()}
            >
              {importing ? <span className="loader small" /> : <UploadCloud size={16} />}{' '}
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
            Importing replaces the active analysis after validation. Your original files stay
            available on disk.
          </p>
          <button
            className="text-button"
            onClick={() =>
              download('/template', 'retail-import-template.csv').catch((e) =>
                notify(e.message, true),
              )
            }
          >
            Download a sample format →
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
      <Panel
        title="One currency, a consistent view"
        subtitle="Original transaction amounts are in British pounds."
        action={<Globe2 size={20} className="muted" />}
      >
        <div className="currency-panel">
          <div>
            <strong>
              {meta.currency.status === 'original'
                ? 'Showing original GBP values'
                : `Historical rates · ${meta.currency.date}`}
            </strong>
            <p>
              {meta.currency.status === 'original'
                ? 'Load historical exchange rates to view your dashboard in USD or INR.'
                : `${meta.currency.source}. Display rates are from the dataset’s closing date; exports preserve original GBP amounts.`}
            </p>
          </div>
          <button className="button" disabled={fxBusy} onClick={() => void rates()}>
            <RefreshCw size={16} className={fxBusy ? 'spinning' : ''} />
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
