# Verification record

Verified on 24 October 2026, using Linux x86-64, Python 3.12.14, Node 24.18.0, Chromium and Docker 29.8.0. The Docker frontend also built with Node 22, and its runtime used Python 3.12-slim. Windows/macOS instructions and universal dependency markers are provided; those operating systems were not independently executed here.

| Check | Result |
|---|---|
| Python tests | **25 passed**; unit, API and real-UCI integration coverage |
| Browser workflows + accessibility | **10 passed**, against disposable sales data |
| Main-view accessibility | No axe WCAG 2 A/AA or WCAG 2.1 AA violations in the five scanned initial views |
| Responsive browser layout | Desktop 1440 px and mobile 390 px verified; no document overflow at mobile width |
| Production React build | Passed strict TypeScript checks and Vite build |
| Python lint / compilation | Ruff passed; all backend, batch and test-server modules compiled |
| Frontend formatting | Prettier check passed |
| Installed Python dependency consistency | `uv pip check`: 98 compatible packages |
| Dataset preparation | Real UCI workbook reprocessed; batch Parquet/CSV/SQLite artifacts rebuilt |
| Notebook | All **9 code cells** executed without error; self-contained HTML exported, including embedded Plotly code |
| Workbook | Regenerated with summary, trends, markets, products, all-history customer profiles, data quality, provenance and comparison sheets; native Excel chart objects verified |
| Currency integration | Real Frankfurter request succeeded for 2011-12-09; GBP→USD 1.5688 and GBP→INR 81.69 recorded as historical rates |
| Docker image | Full multi-stage build succeeded; no host Python/Node dependencies used by runtime |
| Docker runtime | Started as non-root with a fresh named workspace volume; health check passed |
| Container smoke tests | All five frontend routes, overview, customer summary, forecast, models, prediction and XLSX export returned successful responses |
| Container persistence | Active dataset version unchanged after container restart |
| Compose | Configuration validated |

The source workbook has **541,909 rows**. The corrected cleaning pipeline retains **531,441**: 2,517 invalid rows, 2,693 administrative rows and 5,258 duplicates are removed. The retained dataset includes 8,730 refund lines and 131,651 guest lines. It produces **4,334 identified customer profiles** across 38 markets.

Gross product sales are **£10,255,019.18** before refunds; the running dashboard and reports calculate all figures from retained data rather than static text. The underlying source covers 1 December 2010–9 December 2011.

The current forward-spending model has weak held-out R² and the ARIMA model is beaten by the weekly seasonal forecast benchmark. These are analytical limitations, explicitly shown and documented, rather than hidden behind manufactured quality thresholds. Use the models as exploratory support.

Known non-failing upstream messages include a Starlette TestClient deprecation for httpx, a statsmodels starting-parameter warning on the real-dataset test, and nbconvert's image-alt warning in the standalone report export. Forecast convergence is separately checked and surfaced to the user. Automated accessibility scans do not replace comprehensive manual assistive-technology testing.

The temporary Docker verification container and volume were removed after testing. The local application remains available at http://localhost:8000. Screenshots in `docs/screenshots` use the real UCI data; browser tests use isolated fixtures and do not modify that dataset.
