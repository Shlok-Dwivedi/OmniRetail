"""Build and execute a portable notebook against the same application services."""

from pathlib import Path

import nbformat as nbf
from nbclient import NotebookClient
from nbconvert import HTMLExporter


def build_notebook(project_dir: str):
    root = Path(project_dir)
    nb = nbf.v4.new_notebook()
    nb.metadata = {"kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"}}
    sections = [
        (
            "OmniRetail · Retail Intelligence\n\nReproducible DAV practical analysis, Labs 0–8. Original transaction values are in GBP. The UCI Online Retail source covers December 2010–December 2011; it is historical single-retailer data, without verified channel identifiers. Customer spending estimates and forecasts are evaluated below rather than assigned a hard-coded quality score.",
            "from pathlib import Path\nimport sys\nimport pandas as pd\nroot = Path.cwd().parent\nsys.path.insert(0, str(root))\nfrom backend.store import DataStore\nstore = DataStore(root / 'data')\na = store.analytics\na.audit",
        ),
        (
            "1 · Ingestion, inspection and cleaning (Labs 0, 1, 2)\n\nThe shared ingestion service reads CSV/TXT, XLSX, JSON and safely parsed XML. Rows with invalid prices/dates/identifiers, administrative charges and exact duplicates are removed; cancellation signs are normalized. Missing customer identifiers remain guest purchases and are excluded only from customer modeling.",
            "from backend.ingestion import read_source, clean_transactions\nexample = a.tx.head(10)[['InvoiceNo','StockCode','Description','Quantity','InvoiceDate','UnitPrice','CustomerID','Country']]\nroundtrip, audit = clean_transactions(read_source(example.to_csv(index=False).encode(), 'sample.csv'))\ndisplay(roundtrip.head())\ndisplay(a.tx.describe(include='number'))\na.tx.isna().sum()",
        ),
        (
            "2 · Dated API data (Lab 4)\n\nThe application’s explicit currency refresh requests the dataset closing date from Frankfurter/ECB with retries, timeouts, response validation and persistent snapshots. Offline analysis uses GBP; synthetic macro data is never described as a live source.",
            "from backend.currency import CurrencyService\nCurrencyService(store.workspace).snapshot",
        ),
        (
            "3 · Database extraction and relationships (Lab 5)\n\nEach immutable dataset snapshot stores transactions and unique identified customers, linked by CustomerID_Clean. One customer has many product lines; an invoice can contain multiple lines. Indexed SQL queries use SQLAlchemy.",
            "from sqlalchemy import create_engine, text\nengine = create_engine(f\"sqlite:///{store.workspace / store.version / 'retail.db'}\")\nwith engine.connect() as connection:\n    result = pd.read_sql(text('SELECT Country, COUNT(*) AS ProductLines, SUM(TotalPriceGBP) AS NetRevenueGBP FROM transactions GROUP BY Country ORDER BY NetRevenueGBP DESC'), connection)\nengine.dispose()\nresult.head(10)",
        ),
        (
            "4 · RFM, outliers, scaling and correlation (Labs 2, 3)\n\nRFM is measured relative to one day after the final sale. Tied values receive equal rank scores. Scaled columns are exploratory; prediction uses a scaler fitted only on its training partition.",
            "from src.modeling import compute_correlation_matrices\nrfm = a.rfm\ndisplay(rfm.head())\ncolumns = ['RecencyDays','Frequency','MonetaryGBP','TenureDays','AverageOrderValueGBP']\npearson, spearman = compute_correlation_matrices(rfm, columns)\ndisplay(pearson)\ndisplay(spearman)\nrfm.groupby('CustomerSegment').agg(Customers=('CustomerID','size'), RevenueGBP=('MonetaryGBP','sum'))",
        ),
        (
            "5 · Customer spend estimation and classification (Lab 3)\n\nPast RFM features predict the final 90 observed days, with no target-period AOV leakage. Linear and ridge regression are evaluated on held-out customers and compared with a mean-spend baseline. The high-value classifier uses a threshold derived only from training targets. This is an exploratory historical model, not a guaranteed lifetime-value forecast.",
            "metadata = a.customer_model['metadata']\ndisplay(pd.DataFrame(metadata['models']).T)\ndisplay(metadata)\na.predict({'RecencyDays':30, 'Frequency':5, 'TenureDays':180, 'AverageOrderValueGBP':100})",
        ),
        (
            "6 · Daily trends, decomposition and forecast validation (Lab 6)\n\nNon-trading calendar days are zero-filled. The ARIMA(1,1,1) forecast is evaluated on the final 15% of observed days and compared with a weekly seasonal baseline. Intervals and central estimates are constrained to nonnegative sales.",
            "forecast = a.forecast(30)\ndisplay({key: forecast[key] for key in ['rmse','mape','baseline_rmse','stationarity','warnings']})\npd.DataFrame(forecast['forecast']).head()",
        ),
        (
            "7 · Line, scatter, distributions and box plots (Labs 7, 8)\n\nThe toolkit produces portable report images. The React workspace exposes equivalent interactive charts; the Excel export includes line, bar and donut charts.",
            "from src.visual_toolkit import generate_static_charts, create_interactive_donut\nfrom IPython.display import Image, HTML, display\npaths = generate_static_charts(a.tx, a.rfm, a.daily, str(root / 'reports' / 'figures'))\nfor path in paths:\n    display(Image(filename=path, alt=Path(path).stem.replace('_', ' ')))\ndisplay(HTML(create_interactive_donut(a.tx).to_html(full_html=False, include_plotlyjs=True)))",
        ),
        (
            "8 · Workbook and tool comparison (Labs 2, 7, 8)\n\nNative Excel data relationships, Power Query and manual Excel cleaning remain exercises in the source practicals; the application implements their data integrity principles and exports stakeholder-ready analysis without claiming to automate those desktop interactions.",
            "from backend.reports import workbook\nfrom src.visual_toolkit import get_tool_comparison_matrix\nreport = root / 'reports' / 'OmniRetail_Executive_KPI_Report.xlsx'\nreport.write_bytes(workbook(a))\ndisplay(get_tool_comparison_matrix())\nstore.close()\nprint(f'Report saved: {report.name}')",
        ),
    ]
    nb.cells = [
        cell
        for title, code in sections
        for cell in [nbf.v4.new_markdown_cell("# " + title), nbf.v4.new_code_cell(code)]
    ]
    directory = root / "notebooks"
    directory.mkdir(exist_ok=True)
    target = directory / "OmniRetail_Master_Analysis.ipynb"
    nbf.write(nb, target)
    # Use the current interpreter so a clean virtual environment needs no global kernel install.
    import sys
    from jupyter_client.kernelspec import KernelSpecManager
    import tempfile
    import json

    with tempfile.TemporaryDirectory() as temporary:
        kernel_dir = Path(temporary) / "python3"
        kernel_dir.mkdir()
        (kernel_dir / "kernel.json").write_text(
            json.dumps(
                {
                    "argv": [sys.executable, "-m", "ipykernel_launcher", "-f", "{connection_file}"],
                    "display_name": "OmniRetail Python",
                    "language": "python",
                }
            )
        )
        manager = KernelSpecManager(kernel_dirs=[temporary])
        from jupyter_client import KernelManager

        km = KernelManager(kernel_name="python3", kernel_spec_manager=manager)
        client = NotebookClient(
            nb, timeout=180, kernel_name="python3", km=km, resources={"metadata": {"path": str(directory)}}
        )
        try:
            client.execute()
        finally:
            if km.has_kernel:
                km.shutdown_kernel(now=True)
            if client.kc:
                client.kc.stop_channels()
    nbf.write(nb, target)
    html, _ = HTMLExporter().from_notebook_node(nb)
    target.with_suffix(".html").write_text(html, encoding="utf-8")
    print(f"Executed notebook and HTML export: {target}")
    return str(target)


if __name__ == "__main__":
    build_notebook(str(Path(__file__).resolve().parents[1]))
