"""Generate the same executive workbook served by the application."""

from pathlib import Path

from backend.reports import workbook
from backend.store import DataStore


def generate_excel_dashboard(project_dir: str):
    root = Path(project_dir)
    store = DataStore(root / "data")
    try:
        target = root / "reports" / "OmniRetail_Executive_KPI_Report.xlsx"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(workbook(store.analytics))
        print(f"Generated {target}")
        return str(target)
    finally:
        store.close()


if __name__ == "__main__":
    generate_excel_dashboard(str(Path(__file__).resolve().parents[1]))
