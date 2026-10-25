# OmniRetail

OmniRetail is a retail analytics application for exploring sales, understanding customers, and forecasting demand. It uses a React frontend and a Python backend.

## Requirements

Install these before starting:

- **Python 3.12** recommended; Python 3.11–3.13 is supported.
- **Node.js 22.12 or newer**, with npm.

Run all commands below from the **`OmniRetail_DAV_Project` directory**, which contains `app.py`, `requirements.lock`, and the `frontend` folder. No API keys or separate database server are required.

## First-time setup

### Windows — PowerShell

Create a Python environment and install the backend dependencies:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.lock
```

Install and build the frontend:

```powershell
npm --prefix frontend ci
npm --prefix frontend run build
```

Start the application:

```powershell
.\.venv\Scripts\python.exe app.py
```

These commands use the environment's Python directly, so activating it or changing PowerShell's execution policy is unnecessary.

### macOS / Linux

Create a Python environment and install the backend dependencies:

```bash
python3.12 -m venv .venv
.venv/bin/python -m pip install -r requirements.lock
```

Install and build the frontend:

```bash
npm --prefix frontend ci
npm --prefix frontend run build
```

Start the application:

```bash
.venv/bin/python app.py
```

If your supported Python installation uses a different command, such as `python3`, use that command in place of `python3.12` when creating the environment.

### Open the application

Wait for the terminal to display:

```text
Uvicorn running on http://127.0.0.1:8000
```

Then open **[http://localhost:8000](http://localhost:8000)** in your browser.

The first start processes the included dataset and creates its database and cache. Allow about 30 seconds, or longer on a slower computer. Subsequent starts load the saved data. Keep the terminal open while using the application. Press **Ctrl+C** to stop it.

You only need **one running terminal** for this setup: the Python server serves both the backend and the built frontend. Do not open `frontend/index.html` directly or run a separate frontend server for normal use.

## Starting again later

Once setup is complete, run only the command for your operating system from the project directory:

**Windows — PowerShell**

```powershell
.\.venv\Scripts\python.exe app.py
```

**macOS / Linux**

```bash
.venv/bin/python app.py
```

Open **http://localhost:8000**. You do not need to reinstall dependencies or rebuild the frontend on every start.

After changing frontend code, stop the app, run `npm --prefix frontend run build`, and start it again. If dependencies change, reinstall from `requirements.lock` and/or run `npm --prefix frontend ci` before rebuilding.

## Running during development

Use this mode when editing the code and you want automatic reloads. It requires two terminals, both opened in the project directory.

**Terminal 1 — backend**

Windows:

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --reload --port 8000
```

macOS / Linux:

```bash
.venv/bin/python -m uvicorn backend.main:app --reload --port 8000
```

**Terminal 2 — frontend**

```bash
npm --prefix frontend run dev
```

Open **http://localhost:5173** for development. The frontend forwards its service requests to the backend on port 8000. Stop the normal `app.py` server before starting the development backend on that same port.

## Running with Docker

With Docker and Docker Compose installed, run:

```bash
docker compose up --build
```

Open **http://localhost:8000** after startup completes. Python and Node.js do not need to be installed on the host when using Docker. A named volume preserves imported data between container runs.

To stop the application, press **Ctrl+C**, then run:

```bash
docker compose down
```

## Startup troubleshooting

| Problem | What to do |
| --- | --- |
| `python3.12` or `py` is not found | Install Python 3.12, reopen the terminal, and retry. Use your installed supported Python command if its name differs. |
| `npm` is not found | Install Node.js with npm, then reopen the terminal. |
| `.venv` is missing or its Python does not run | Create a fresh `.venv` on this computer using the first-time setup commands. Virtual environments are specific to the machine that created them. |
| A Python module is missing | Run the dependency installation command using `.venv`'s Python, as shown above. |
| The page returns `Not Found`, or frontend changes are missing | Run `npm --prefix frontend ci` and `npm --prefix frontend run build`, then restart the Python server. |
| Port 8000 is already in use | Stop the previous application terminal with Ctrl+C. Alternatively, set a different port using the commands below. |
| `Online Retail.xlsx` is missing | With the app stopped, run `.venv/bin/python -m backend.cli prepare --download` on macOS/Linux, or `.\.venv\Scripts\python.exe -m backend.cli prepare --download` on Windows. This downloads the source workbook and needs internet access. |

To run on a different port, such as 8005:

**Windows — PowerShell**

```powershell
$env:PORT = "8005"
.\.venv\Scripts\python.exe app.py
```

**macOS / Linux**

```bash
PORT=8005 .venv/bin/python app.py
```

Then open **http://localhost:8005**.

## Architecture

```text
Browser
   │
   ▼
React + TypeScript frontend
   │  Requests and file downloads
   ▼
FastAPI backend
   ├── Data ingestion and validation
   ├── Sales and customer analytics
   ├── Customer spending models and demand forecasts
   ├── Excel / CSV report generation
   └── Historical currency conversion
   │
   ▼
Local storage: SQLite + Parquet + JSON metadata
```

### Frontend

The interface uses **React, TypeScript, and Vite**, with **Recharts** for charts. A sidebar, which becomes a bottom tab bar on phones, connects five views, and the interface follows the system's light or dark appearance:

- **Overview:** sales, orders, customers, market contribution, and best-selling products.
- **Customers:** segmentation, search, buying behavior, and spending estimates.
- **Forecast:** future sales estimates, uncertainty ranges, and validation metrics.
- **Explore:** distributions, correlations, and time-series patterns.
- **Data & reports:** file imports, data quality, downloads, and currency settings.

Vite builds the frontend into `frontend/dist`. In normal use, FastAPI serves those files alongside the backend. During development, Vite runs separately and proxies requests to FastAPI.

### Backend

**FastAPI** handles requests and delegates work to separate Python modules. **Pandas and NumPy** process transactions, **scikit-learn** builds customer spending models, and **statsmodels** produces time-series analysis and ARIMA forecasts. **SQLAlchemy** writes indexed SQLite snapshots; **openpyxl** creates Excel reports.

Imports are validated in a background worker. A new dataset becomes active only after its snapshot is saved successfully. Failed imports preserve the previous dataset. Customer profiles and models are cached per dataset, and forecasts are cached by dataset version and horizon.

### Data and storage

The default source is **`data/raw/Online Retail.xlsx`**, the historical UCI Online Retail dataset covering **December 2010–December 2011**. Dashboard numbers are calculated from the data; they are not hardcoded or supplied by a live sales feed. Users can import their own transactions through **Data & reports**.

- **SQLite** stores indexed transactions and customer identifiers.
- **Parquet** provides fast transaction loading.
- **JSON** records the active snapshot and cached exchange rates.
- **`data/workspace/`** preserves the selected dataset across restarts.

Amounts originate in GBP. Optional historical currency rates come from Frankfurter/ECB. The application works offline in GBP after dependencies are installed, provided the included source data or a saved workspace is available.

### Project structure

```text
OmniRetail_DAV_Project/
├── app.py                 # Normal application startup
├── backend/               # Request handling, services, storage, and CLI
├── frontend/
│   ├── src/               # React pages, components, styles, and request helpers
│   ├── dist/              # Generated frontend build
│   └── package-lock.json  # Exact frontend dependency versions
├── src/                   # Reusable analytical and batch-processing modules
├── data/
│   ├── raw/               # Original source files
│   ├── processed/         # Derived batch-analysis files
│   ├── database/          # Batch-analysis SQLite database
│   └── workspace/         # Persistent application snapshots
├── notebooks/             # Executed analysis notebook and HTML report
├── reports/               # Generated workbooks and figures
├── tests/                 # Python tests
├── requirements.txt       # Direct backend dependencies
├── requirements.lock      # Exact backend dependency versions used for setup
├── Dockerfile             # Container build
└── compose.yaml           # Container startup and persistent storage
```

The application uses a **single shared workspace**. It is intended for local use or a trusted private network; public multi-user hosting requires authentication and additional deployment controls.
