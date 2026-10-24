"""Reproducible preparation and analysis commands, independent of working directory."""

import argparse
from io import BytesIO
import logging
from pathlib import Path
import zipfile

import requests
from sqlalchemy import create_engine

from .config import DATA_DIR, ROOT
from .store import DataStore


def download_source(data_dir):
    destination = data_dir / "raw" / "Online Retail.xlsx"
    if destination.exists():
        return destination
    destination.parent.mkdir(parents=True, exist_ok=True)
    response = requests.get(
        "https://archive.ics.uci.edu/static/public/352/online+retail.zip", timeout=(10, 120)
    )
    response.raise_for_status()
    with zipfile.ZipFile(BytesIO(response.content)) as archive:
        source = next((name for name in archive.namelist() if Path(name).name == "Online Retail.xlsx"), None)
        if source is None:
            raise ValueError("The UCI archive did not contain the expected workbook.")
        temporary = destination.with_suffix(".tmp")
        temporary.write_bytes(archive.read(source))
        temporary.replace(destination)
    return destination


def prepare(data_dir=DATA_DIR, rebuild=False):
    store = DataStore(data_dir)
    try:
        if rebuild:
            from .ingestion import read_source

            source = data_dir / "raw" / "Online Retail.xlsx"
            store.install(read_source(source.read_bytes(), source.name), "UCI Online Retail")
        analytics = store.analytics
        processed = data_dir / "processed"
        database = data_dir / "database"
        processed.mkdir(exist_ok=True)
        database.mkdir(exist_ok=True)
        analytics.tx.to_parquet(processed / "cleaned_transactions.parquet", index=False)
        analytics.tx.head(50000).to_csv(processed / "cleaned_transactions.csv", index=False)
        analytics.rfm.to_csv(processed / "rfm_customers.csv", index=False)
        analytics.daily.to_csv(processed / "daily_sales_with_ma.csv")
        analytics.daily.rename(
            columns={"RevenueGBP": "TotalRevenueGBP", "Orders": "TotalOrders", "Items": "TotalItemsSold"}
        ).to_csv(processed / "daily_sales_timeseries.csv")
        engine = create_engine(f"sqlite:///{database / 'omni_retail.db'}")
        try:
            with engine.begin() as conn:
                tx = analytics.tx.copy()
                tx["CustomerID"] = tx["CustomerID_Clean"]
                tx.to_sql("transactions", conn, if_exists="replace", index=False, chunksize=10000)
                analytics.daily.to_sql("daily_sales", conn, if_exists="replace", index=True)
                analytics.rfm.to_sql("customers", conn, if_exists="replace", index=False)
        finally:
            engine.dispose()
        print(f"Prepared {len(analytics.tx):,} transactions and {len(analytics.rfm):,} customer profiles.")
        return analytics
    finally:
        store.close()


def main():
    parser = argparse.ArgumentParser(description="OmniRetail data tools")
    parser.add_argument("command", choices=["prepare", "reports", "notebook", "analyze"])
    parser.add_argument("--download", action="store_true", help="Download the UCI source workbook if absent")
    parser.add_argument(
        "--rebuild", action="store_true", help="Replace the active analysis with the original UCI workbook"
    )
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    if args.download:
        download_source(DATA_DIR)
    if args.command == "prepare":
        prepare(rebuild=args.rebuild)
    elif args.command == "notebook":
        from src.build_master_notebook import build_notebook

        build_notebook(str(ROOT))
    else:
        store = DataStore(DATA_DIR)
        try:
            if args.command == "analyze":
                import json

                print(json.dumps(store.analytics.customer_model["metadata"], indent=2))
                print(
                    json.dumps(
                        {
                            k: v
                            for k, v in store.analytics.forecast().items()
                            if k not in {"history", "forecast", "decomposition"}
                        },
                        indent=2,
                    )
                )
            else:
                from .reports import workbook
                from src.visual_toolkit import generate_static_charts

                destination = ROOT / "reports" / "OmniRetail_Executive_KPI_Report.xlsx"
                destination.parent.mkdir(exist_ok=True)
                destination.write_bytes(workbook(store.analytics))
                generate_static_charts(
                    store.analytics.tx,
                    store.analytics.rfm,
                    store.analytics.daily,
                    str(destination.parent / "figures"),
                )
                print(f"Reports written to {destination.parent}")
        finally:
            store.close()


if __name__ == "__main__":
    main()
