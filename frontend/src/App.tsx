import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import {
  ChartColumn,
  ChartSpline,
  Check,
  ChevronsUpDown,
  CircleHelp,
  Database,
  Telescope,
  TriangleAlert,
  Users,
  X,
} from 'lucide-react';
import { request, useResource } from './api';
import { WorkspaceContext, dateRange, number } from './context';
import type { Meta } from './types';
import { ErrorState, Loading, Spinner } from './components/UI';
const Overview = lazy(() => import('./pages/Overview'));
const Customers = lazy(() => import('./pages/Customers'));
const Forecast = lazy(() => import('./pages/Forecast'));
const Explore = lazy(() => import('./pages/Explore'));
const Reports = lazy(() => import('./pages/Reports'));
const navigation = [
  {
    path: '/',
    label: 'Overview',
    title: 'Sales performance',
    icon: ChartColumn,
    about: 'Revenue, orders, markets and best sellers, filtered by date range and market.',
  },
  {
    path: '/customers',
    label: 'Customers',
    title: 'Customer intelligence',
    icon: Users,
    about: 'Loyalty segments, a searchable directory and a 90-day spending estimate.',
  },
  {
    path: '/forecast',
    label: 'Forecast',
    title: 'Demand forecast',
    icon: ChartSpline,
    badge: '90d',
    about: 'Expected sales for the next 7 to 90 days, with the range of likely outcomes.',
  },
  {
    path: '/explore',
    label: 'Explore',
    title: 'Explore your business',
    icon: Telescope,
    about: 'Spending distributions, correlations and the weekly rhythm of sales.',
  },
  {
    path: '/reports',
    label: 'Data & reports',
    short: 'Reports',
    title: 'Data & reports',
    icon: Database,
    about: 'Import your own sales, check data quality and download reports.',
  },
];
export function AppIcon({ size = 28 }: { size?: number }) {
  return (
    <svg className="app-icon" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id="app-icon-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3d9cff" />
          <stop offset="1" stopColor="#0062d6" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="9.5" fill="url(#app-icon-fill)" />
      <path
        d="M16.4 15.6v-1.3a3.6 3.6 0 0 1 7.2 0v1.3"
        fill="none"
        stroke="#fff"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path d="M12.6 15.6h14.8l-1 12.3a2 2 0 0 1-2 1.8h-8.8a2 2 0 0 1-2-1.8z" fill="#fff" />
      <rect x="16.2" y="22.6" width="2" height="4" rx=".7" fill="#0a6fe0" />
      <rect x="19" y="20.6" width="2" height="6" rx=".7" fill="#0a6fe0" />
      <rect x="21.8" y="18.6" width="2" height="8" rx=".7" fill="#0a6fe0" />
    </svg>
  );
}
export default function App() {
  const resource = useResource<Meta>('/meta');
  const [currency, setCurrency] = useState('GBP');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [country, setCountry] = useState('');
  const [help, setHelp] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null);
  const location = useLocation();
  const page = navigation.find((item) => item.path === location.pathname);
  const notify = useCallback((message: string, error = false) => setToast({ message, error }), []);
  useEffect(() => {
    window.scrollTo(0, 0);
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [location.pathname]);
  useEffect(() => {
    document.title = page ? `${page.title} · OmniRetail` : 'OmniRetail';
  }, [page]);
  useEffect(() => {
    // The large title hands over to the toolbar once it scrolls beneath it.
    const onScroll = () => setScrolled(window.scrollY > 44);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
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
  const rates = resource.data?.currency.rates;
  const money = useCallback(
    (value: number, compact = false) =>
      new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency,
        notation: compact ? 'compact' : 'standard',
        maximumFractionDigits: compact ? 1 : 0,
      }).format(value * (rates?.[currency] || 1)),
    [currency, rates],
  );

  if (!resource.data)
    return (
      <div className="boot">
        {resource.error ? (
          <ErrorState message={resource.error} retry={resource.retry} />
        ) : (
          <>
            <AppIcon size={64} />
            <Spinner size={20} />
            <span className="sr-only" role="status">
              Opening OmniRetail…
            </span>
          </>
        )}
      </div>
    );
  const meta = resource.data;
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
      <div className="shell">
        <div className="sidebar-column">
          <div className="sidebar">
            <NavLink className="brand" to="/" aria-label="OmniRetail home">
              <AppIcon />
              <span>OmniRetail</span>
            </NavLink>
            <nav className="nav" aria-label="Main navigation">
              {navigation.map(({ path, label, short, icon: Icon, badge }) => (
                <NavLink
                  end={path === '/'}
                  key={path}
                  to={path}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                  <Icon size={18} strokeWidth={1.9} />
                  <span className="nav-label">
                    {short ? (
                      <>
                        <span className="nav-label-full">{label}</span>
                        <span className="nav-label-short" aria-hidden="true">
                          {short}
                        </span>
                      </>
                    ) : (
                      label
                    )}
                  </span>
                  {badge && (
                    <>
                      {' '}
                      <span className="nav-badge">{badge}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
            <div className="sidebar-foot">
              <strong>{meta.name}</strong>
              <span>{number(meta.audit.clean_rows)} validated rows</span>
              <span>{dateRange(meta.audit.start, meta.audit.end)}</span>
            </div>
          </div>
        </div>
        <div className="main-column">
          <header className={`toolbar ${scrolled ? 'scrolled' : ''}`}>
            <span className="toolbar-title" aria-hidden="true">
              {page?.title}
            </span>
            <div className="toolbar-actions">
              <label className="popup popup-compact" title="Display currency">
                <span className="sr-only">Display currency</span>
                <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {Object.keys(meta.currency.rates).map((code) => (
                    <option key={code}>{code}</option>
                  ))}
                </select>
                <ChevronsUpDown size={13} className="popup-chevron" />
              </label>
              <button
                className="icon-button"
                aria-label="Workspace guide"
                title="Workspace guide"
                onClick={() => setHelp(true)}
              >
                <CircleHelp size={19} strokeWidth={1.9} />
              </button>
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
                    <div className="unavailable not-found">
                      <h1>Page not found</h1>
                      <p>This address isn’t part of the workspace.</p>
                      <NavLink className="button" to="/">
                        Go to Overview
                      </NavLink>
                    </div>
                  }
                />
              </Routes>
            </Suspense>
          </main>
          <footer className="footer">
            {meta.name} · {dateRange(meta.audit.start, meta.audit.end)}
          </footer>
        </div>
      </div>
      {toast && (
        <div
          className={`toast ${toast.error ? 'toast-error' : ''}`}
          role={toast.error ? 'alert' : 'status'}
        >
          {toast.error ? <TriangleAlert size={18} /> : <Check size={18} />}
          <span>{toast.message}</span>
          <button aria-label="Dismiss notification" onClick={() => setToast(null)}>
            <X size={15} />
          </button>
        </div>
      )}
      {help && (
        <div className="modal-backdrop" onClick={() => setHelp(false)}>
          <section
            className="guide-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="guide-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              autoFocus
              className="icon-button modal-close"
              aria-label="Close guide"
              onClick={() => setHelp(false)}
            >
              <X size={18} />
            </button>
            <AppIcon size={56} />
            <h2 id="guide-title">Welcome to OmniRetail</h2>
            <p>Five views, from sales to the data behind them.</p>
            <ul className="guide-list">
              {navigation.map(({ path, label, icon: Icon, about }) => (
                <li key={path}>
                  <Icon size={24} strokeWidth={1.7} />
                  <div>
                    <strong>{label}</strong>
                    <span>{about}</span>
                  </div>
                </li>
              ))}
            </ul>
            <p className="guide-note">
              Sales values originate in GBP. Optional exchange rates use the dataset’s closing date.
            </p>
            <button className="button button-primary button-large" onClick={() => setHelp(false)}>
              Continue
            </button>
          </section>
        </div>
      )}
    </WorkspaceContext.Provider>
  );
}
