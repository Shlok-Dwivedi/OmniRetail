import type { ReactNode } from 'react';
import { useState } from 'react';
import { AlertCircle, ArrowDownToLine, ArrowUpRight, RefreshCw } from 'lucide-react';
import { download } from '../api';
import { useWorkspace } from '../context';
export function Panel({
  title,
  subtitle,
  action,
  children,
  className = '',
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {title && (
        <div className="panel-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function Stat({
  label,
  value,
  detail,
  accent,
  tone,
  children,
}: {
  label: string;
  value: string;
  detail?: string;
  accent?: boolean;
  tone?: 'mint' | 'blue' | 'violet' | 'amber';
  children?: ReactNode;
}) {
  return (
    <div className={`stat ${accent ? 'stat-accent' : ''} ${tone ? `stat-${tone}` : ''}`}>
      <div className="stat-top">
        <span>{label}</span>
        <ArrowUpRight size={17} />
      </div>
      <strong>{value}</strong>
      <div className="stat-detail">{children || detail}</div>
    </div>
  );
}
export function Loading({ label = 'Preparing your workspace…' }: { label?: string }) {
  return (
    <div className="loading" role="status">
      <span className="loader" />
      <span>{label}</span>
    </div>
  );
}
export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="error-state" role="alert">
      <AlertCircle size={26} />
      <h3>We couldn’t load this view</h3>
      <p>{message}</p>
      {retry && (
        <button className="button" onClick={retry}>
          <RefreshCw size={16} />
          Try again
        </button>
      )}
    </div>
  );
}
export function Empty({
  title = 'No results for this selection',
  detail = 'Try a different date range or market.',
}: {
  title?: string;
  detail?: string;
}) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p>{detail}</p>
    </div>
  );
}
export function ExportButton({
  path,
  filename,
  children = 'Export report',
  primary = false,
}: {
  path: string;
  filename: string;
  children?: ReactNode;
  primary?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const { notify } = useWorkspace();
  return (
    <button
      className={`button ${primary ? 'button-primary' : ''}`}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await download(path, filename);
          notify('Your download is ready.');
        } catch (e) {
          notify((e as Error).message, true);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <span className="loader small" /> : <ArrowDownToLine size={16} />}{' '}
      {busy ? 'Preparing…' : children}
    </button>
  );
}
export const tooltipStyle = {
  background: '#202923',
  border: '1px solid #3a473f',
  borderRadius: 10,
  color: '#edf1ec',
  fontSize: 13,
  padding: '12px 16px',
};
export const axisStyle = { fontSize: 11, fill: '#8a978f' };
