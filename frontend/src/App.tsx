import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import {
  ArrowUpRight,
  ChartNoAxesCombined,
  ChartPie,
  Check,
  CircleHelp,
  Database,
  LayoutDashboard,
  ShoppingBag,
  Users,
  X,
} from 'lucide-react';
import { request, useResource } from './api';
import { WorkspaceContext, fullDate } from './context';
import type { Meta } from './types';
import { ErrorState, Loading } from './components/UI';
const Overview = lazy(() => import('./pages/Overview'));
const Customers = lazy(() => import('./pages/Customers'));
const Forecast = lazy(() => import('./pages/Forecast'));
const Explore = lazy(() => import('./pages/Explore'));
const Reports = lazy(() => import('./pages/Reports'));
const navigation = [
  { path: '/', label: 'Overview', icon: LayoutDashboard },
  { path: '/customers', label: 'Customers', icon: Users },
  { path: '/forecast', label: 'Forecast', icon: ChartNoAxesCombined },
  { path: '/explore', label: 'Explore', icon: ChartPie },
  { path: '/reports', label: 'Data & reports', icon: Database },
];
export default function App() {
  const resource = useResource<Meta>('/meta');
  const [currency, setCurrency] = useState('GBP');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [country, setCountry] = useState('');
  const [help, setHelp] = useState(false);
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null);
  const location = useLocation();
  const notify = useCallback((message: string, error = false) => setToast({ message, error }), []);
  useEffect(() => {
    document.getElementById('main')?.focus();
  }, [location.pathname]);
  useEffect(() => {
    if (!resource.data) return;
    const controller = new AbortController();
    const version = resource.data.version;
    const timer = setInterval(() => {
      request<Meta>('/meta', { signal: controller.signal })
        .then((next) => {
          if (next.version !== version) {
            resource.retry();
            notify('Your updated sales workspace is ready.');
          }
        })
        .catch(() => {});
    }, 5000);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [resource.data?.version, resource.retry, notify]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!help) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setHelp(false);
      }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [help]);
  useEffect(() => {
    if (resource.data && !resource.data.currency.rates[currency]) setCurrency('GBP');
  }, [resource.data, currency]);
  useEffect(() => {
    if (!help) return;
    const previous = document.activeElement as HTMLElement | null;
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = Array.from(
        document.querySelectorAll<HTMLElement>(
          '.guide-modal button,.guide-modal a,.guide-modal input',
        ),
      );
      const first = items[0],
        last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', trap);
    return () => {
      document.removeEventListener('keydown', trap);
      previous?.focus();
    };
  }, [help]);

  if (resource.loading)
    return (
      <div className="boot">
        <ShoppingBag size={40} />
        <Loading />
      </div>
    );
  if (resource.error || !resource.data)
    return (
      <div className="boot">
        <ErrorState message={resource.error} retry={resource.retry} />
      </div>
    );
  const meta = resource.data;
  const money = (value: number, compact = false) =>
    new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
      notation: compact ? 'compact' : 'standard',
      maximumFractionDigits: compact ? 1 : 0,
    }).format(value * (meta.currency.rates[currency] || 1));
  const query = new URLSearchParams({
    ...(start && { start }),
    ...(end && { end }),
    ...(country && { country }),
  }).toString();
  return (
    <WorkspaceContext.Provider
      value={{
        meta,
        refresh: resource.retry,
        currency,
        setCurrency,
        money,
        query,
        start,
        end,
        setStart,
        setEnd,
        country,
        setCountry,
        notify,
      }}
    >
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <div className="app-content">
        <header className="navbar">
          <div className="navbar-inner">
            <NavLink className="brand" to="/" aria-label="OmniRetail home">
              <span className="brand-icon">
                <ShoppingBag size={23} />
              </span>
              <span>
                omni<span className="brand-light">retail</span>
              </span>
            </NavLink>
            <nav className="navbar-links" aria-label="Main navigation">
              {navigation.map(({ path, label, icon: Icon }) => (
                <NavLink
                  end={path === '/'}
                  key={path}
                  to={path}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                  <Icon size={17} />
                  <span>{label}</span>
                  {label === 'Forecast' && <span className="nav-badge">90d</span>}
                </NavLink>
              ))}
            </nav>
            <div className="navbar-actions">
              <span
                className="historical-tag"
                title={`${meta.name} · ${meta.audit.clean_rows.toLocaleString()} validated records`}
              >
                <i />
                Historical collection
              </span>
              <label className="currency-select">
                <span className="sr-only">Display currency</span>
                <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {Object.keys(meta.currency.rates).map((code) => (
                    <option key={code}>{code}</option>
                  ))}
                </select>
              </label>
              <button
                className="icon-button guide-button"
                aria-label="Workspace guide"
                title="Workspace guide"
                onClick={() => setHelp(true)}
              >
                <CircleHelp size={19} />
              </button>
            </div>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/forecast" element={<Forecast />} />
              <Route path="/explore" element={<Explore />} />
              <Route path="/reports" element={<Reports />} />
              <Route
                path="*"
                element={
                  <div className="empty">
                    <h1>Page not found</h1>
                    <NavLink to="/">Return to overview</NavLink>
                  </div>
                }
              />
            </Routes>
          </Suspense>
        </main>
        <footer>
          <span>
            OmniRetail <span className="footer-dot">·</span> A clearer view of your business
          </span>
          <span>
            {fullDate(meta.audit.start)} — {fullDate(meta.audit.end)}
          </span>
        </footer>
      </div>
      {toast && (
        <div
          className={`toast ${toast.error ? 'toast-error' : ''}`}
          role={toast.error ? 'alert' : 'status'}
        >
          {toast.error ? <CircleHelp size={18} /> : <Check size={18} />}
          <span>{toast.message}</span>
          <button aria-label="Dismiss notification" onClick={() => setToast(null)}>
            <X size={16} />
          </button>
        </div>
      )}
      {help && (
        <div className="modal-backdrop" onClick={() => setHelp(false)}>
          <section
            className="guide-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Workspace guide"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              autoFocus
              className="icon-button modal-close"
              aria-label="Close guide"
              onClick={() => setHelp(false)}
            >
              <X />
            </button>
            <div className="eyebrow">MAKE YOURSELF AT HOME</div>
            <h2>Your retail workspace.</h2>
            <p>Start with sales, then follow the story behind the numbers.</p>
            <ol>
              <li>
                <strong>Overview</strong>See revenue, orders, products and markets. Use date and
                market filters to focus your view.
              </li>
              <li>
                <strong>Customers</strong>Find loyalty segments and estimate a customer’s next 90
                days of spending.
              </li>
              <li>
                <strong>Forecast</strong>Explore upcoming demand alongside the range of possible
                outcomes.
              </li>
              <li>
                <strong>Explore</strong>Look deeper into trends, customer distributions and
                relationships.
              </li>
              <li>
                <strong>Data & reports</strong>Bring your own sales data, check its quality, and
                take your findings with you.
              </li>
            </ol>
            <p className="muted">
              All sales values originate in GBP. Optional currency rates use the dataset’s closing
              date.
            </p>
            <button className="button button-primary" onClick={() => setHelp(false)}>
              Got it <ArrowUpRight size={16} />
            </button>
          </section>
        </div>
      )}
    </WorkspaceContext.Provider>
  );
}
