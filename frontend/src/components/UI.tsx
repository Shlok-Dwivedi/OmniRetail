import type { CSSProperties, ReactNode } from 'react';
import { useState } from 'react';
import { ArrowDownToLine, CircleAlert, Info, RotateCw, SearchX, TriangleAlert } from 'lucide-react';
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
  subtitle?: ReactNode;
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
  title,
  caption,
  action,
}: {
  title: string;
  caption?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <h1>{title}</h1>
        {caption && <p>{caption}</p>}
      </div>
      {action && <div className="page-actions">{action}</div>}
    </div>
  );
}
// The figure a view leads with. Charts rewrite it in place while the pointer scrubs them.
export function Readout({
  label,
  value,
  detail,
  live = false,
}: {
  label: ReactNode;
  value: string;
  detail?: ReactNode;
  live?: boolean;
}) {
  return (
    <div className={`stat stat-accent ${live ? 'is-scrubbing' : ''}`}>
      <span className="stat-label">{label}</span>
      <strong>{value}</strong>
      {detail && <span className="stat-detail">{detail}</span>}
    </div>
  );
}
export function KeyStats({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="key-stats">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span className="spinner" style={{ width: size, height: size }} aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => (
        <i key={i} style={{ '--i': i } as CSSProperties} />
      ))}
    </span>
  );
}
export function Loading({ label = 'Loading…', rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div className="loading" role="status">
      <span className="sr-only">{label}</span>
      <span className="skeleton skeleton-heading" />
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} className="skeleton skeleton-line" />
      ))}
      <span className="skeleton skeleton-block" />
    </div>
  );
}
export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="unavailable error-state" role="alert">
      <CircleAlert size={32} strokeWidth={1.6} />
      <h3>This view couldn’t load</h3>
      <p>{message}</p>
      {retry && (
        <button className="button" onClick={retry}>
          <RotateCw size={15} />
          Try again
        </button>
      )}
    </div>
  );
}
export function Empty({
  title = 'No sales in this selection',
  detail = 'Widen the date range or choose All markets.',
}: {
  title?: string;
  detail?: string;
}) {
  return (
    <div className="unavailable empty">
      <SearchX size={30} strokeWidth={1.6} />
      <h3>{title}</h3>
      <p>{detail}</p>
    </div>
  );
}
export function Notice({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'warning';
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className={`notice notice-${tone}`}>
      {tone === 'warning' ? <TriangleAlert size={18} /> : <Info size={18} />}
      <div>
        <strong>{title}</strong>
        {children && <p>{children}</p>}
      </div>
    </div>
  );
}
export function ExportButton({
  path,
  filename,
  children = 'Export report',
  primary = false,
  compact = false,
}: {
  path: string;
  filename: string;
  children?: ReactNode;
  primary?: boolean;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const { notify } = useWorkspace();
  return (
    <button
      className={`button ${primary ? 'button-primary' : ''} ${compact ? 'button-capsule' : ''}`}
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
      {busy ? <Spinner size={14} /> : !compact && <ArrowDownToLine size={16} />}
      {busy ? 'Preparing…' : children}
    </button>
  );
}
