# Engineering notes

## Architecture

React 19 + TypeScript + Vite provide five routed, lazy-loaded views. Recharts handles interactive charts; Lucide supplies consistent icons. Fonts are bundled locally. A shared workspace context contains current dataset metadata, currency and overview filters. Typed request helpers use AbortController cancellation to prevent old responses replacing new filters. Loading, empty, validation and recoverable-error states are explicit.

FastAPI exposes a thin HTTP boundary over ingestion, analytics, storage, reports and currency services. CPU/dataframe work runs in synchronous routes on the framework thread pool. Long imports use one background executor per process, a bounded job registry and polling. ARIMA results are serialized and cached per dataset version/horizon. Models and customer profiles are computed once per immutable Analytics instance. The production Python process serves the compiled frontend, so there is one origin and one start command.

This is intentionally a single-process, trusted-workspace product. Do not run multiple workers: they would have independent in-memory active datasets and import-job registries. Use a shared job queue, explicit dataset versioning across workers, authentication and database-backed tenancy if multi-user hosting is required.

## Data lifecycle

1. Parse supported sources without executing user content. XML uses defusedxml; compressed XLSX expansion is bounded.
2. Validate required columns, types, finite values, positive prices, nonzero quantities, invoice dates and identifiers. Imported derived totals/flags are ignored.
3. Remove invalid, administrative and duplicate rows in a deterministic order. Track each removal exactly once in the audit.
4. Preserve guests, flag cancellations, normalize refund quantity signs and calculate GBP line totals. Missing product names and markets get explicit placeholders.
5. Write a new version directory with Parquet and a transactional indexed SQLite database. The customer table has unique identified customer IDs; transactions link to those identifiers. Guest transactions deliberately have no customer-profile row.
6. Atomically replace `current.json` only after complete persistence. Swap in the new Analytics object and invalidate forecast caches. Concurrent readers already using the previous immutable object finish normally.
7. Restart loads the selected snapshot. Import failure leaves the previous selection in place. Original raw sources and previous snapshots are retained.

A local disk failure during writing can leave an unselected partial directory; it cannot become the current dataset. Snapshots are not pruned automatically, so monitor disk use and remove unselected snapshots manually when needed. Jobs are ephemeral; after an application restart use the current metadata to see whether an import finished. Batch `prepare --rebuild` is an explicit restore operation and should run while the server is stopped.

## Business definitions

- Sales revenue: completed positive-priced product purchases, including guest purchases; excluded administrative charges are listed in the audit.
- Refunds: absolute signed value of retained cancellations, presented separately.
- Net revenue: sales minus refunds.
- Completed orders: distinct non-cancelled invoice numbers in the selected scope.
- Active customers: distinct identified purchasers; guest is not counted as one customer.
- AOV: sales divided by distinct completed orders.
- Customer recency/tenure: relative to one day after the final observed purchase, never today’s clock.
- No marketing channels, customer names, margins, inventory or live traffic are invented where source data has none.

Amounts are original GBP. Optional Frankfurter/ECB rates use the last observed date (or last prior trading day). GBP works offline; cached real rates remain usable after a refresh failure. Exports preserve GBP and include scope notes. The old academic INR/USD columns are illustrative compatibility fields and never drive product currency values.

## Model integrity

Past customer behavior before a 90-day cutoff is aggregated into recency, frequency, tenure and past AOV. Targets are sales in the later period, including zero when a customer does not return. Customers without pre-cutoff history cannot be used for this supervised evaluation. A fixed held-out customer split evaluates linear/ridge regressions, with StandardScaler fitted exclusively on the training data. The selected estimator is ridge, fixed in advance, then refitted on all eligible customer pairs. A high-value classifier uses a threshold derived from training targets and training-only scaling. The displayed probability comes from the evaluation classifier.

Customer interval widths use the held-out 90th percentile absolute residual. They are indicative, not calibrated coverage guarantees. The model is exploratory and may extrapolate poorly, especially for wholesale buyers and changing seasons. Wholesale customers are retained in evaluation; a negative R² is shown honestly rather than suppressing it or asserting an arbitrary threshold. The legacy `src/modeling.py` same-period exercises are explicitly labeled historical associations and are not used by the application.

Forecast validation uses the final 15% of daily observations. ARIMA(1,1,1) and the repeating-last-week seasonal benchmark are compared on the same holdout. The model is then refitted on all daily sales for the requested forward horizon. Confidence bounds and point estimates are clipped to zero; convergence problems are surfaced. Constant/short-series guards prevent invalid ADF calculations. The weekly baseline currently beats ARIMA on the real dataset and the interface discloses this.

## Reports and security boundaries

Exports are generated in memory from active analysis rather than stale pre-existing files. Excel includes native charts, styled headers, filters and frozen headers. Customer profiles are all-history; sales pages follow overview filters. String cells beginning with spreadsheet formulas are escaped in both CSV and Excel.

Uploads are limited to 40 MB of file content and at most one million rows. The deployed reverse proxy should enforce the full request-body size before multipart parsing. Imports accept fixed file formats; the currency source is a fixed provider rather than an arbitrary URL. CORS permits local development origins by default. Responses set nosniff, frame denial and referrer policy headers. Predictive inputs and query ranges are bounded, ordered and checked for finite values. Internal exceptions return a general user message and are logged on the server.

No authorization or tenant isolation is implemented; this is documented rather than represented by nonfunctional login UI. Use private hosting until an explicit authentication requirement is implemented. SQLite snapshots and report generation are designed for this dataset scale, not a hosted warehouse with unbounded imports.

## Verification

The Python suite checks supported input formats, duplicate/invalid/admin accounting, refund signs, guest handling, tied small-group RFM scoring, malicious XML, formula-safe exports, filter reconciliation, customer sort/search/pagination, invalid dates/inputs, temporal model metadata, finite metrics, forecast bounds and cache, actual workbook charts, persistent import switching, failed imports, FX outage handling and security headers. Real-dataset integration tests verify derived files, customer invariants and measured forecasting/model calculations without imposing invented performance scores.

Playwright exercises complete browser workflows against disposable data on port 8001: overview filters and workbook download; customer search, pagination and prediction; forecast horizons and exploratory views; mobile navigation, guide and viewport overflow; failed imports, successful imports, reload persistence and insufficient-history recovery. The production frontend build includes strict TypeScript checking. Ruff checks Python imports, undefined names and related correctness issues. The master notebook is regenerated, executed and exported from current services.

Desktop/mobile screenshots in `docs/screenshots` show the real UCI workspace. Docker files and CI are supplied; Docker availability and execution are recorded in the final validation report rather than assumed.
