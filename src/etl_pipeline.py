"""Batch ETL adapter using the same validation rules as the application."""

from pathlib import Path

import pandas as pd
from sqlalchemy import create_engine, text

from backend.ingestion import clean_transactions, read_source


def run_etl(project_dir: str, save_csv: bool = True) -> tuple[pd.DataFrame, pd.DataFrame]:
    root = Path(project_dir)
    raw = root / "data" / "raw" / "Online Retail.xlsx"
    df, audit = clean_transactions(read_source(raw.read_bytes(), raw.name))
    processed = root / "data" / "processed"
    database = root / "data" / "database"
    processed.mkdir(parents=True, exist_ok=True)
    database.mkdir(parents=True, exist_ok=True)
    sales = df.loc[~df["IsCancelled"]]
    summary = (
        sales.groupby("InvoiceDay")
        .agg(
            TotalRevenueGBP=("TotalPriceGBP", "sum"),
            TotalRevenueINR=("TotalPriceINR", "sum"),
            TotalOrders=("InvoiceNo", "nunique"),
            TotalItemsSold=("Quantity", "sum"),
            UniqueCustomers=("CustomerID_Clean", lambda x: x[x.ne("GUEST")].nunique()),
        )
        .reset_index()
    )
    summary["AverageOrderValueGBP"] = summary["TotalRevenueGBP"] / summary["TotalOrders"]
    engine = create_engine(f"sqlite:///{database / 'omni_retail.db'}")
    try:
        with engine.begin() as conn:
            sql_frame = df.copy()
            sql_frame["CustomerID"] = sql_frame["CustomerID_Clean"]
            sql_frame.to_sql("transactions", conn, if_exists="replace", index=False, chunksize=10000)
            summary.to_sql("daily_sales", conn, if_exists="replace", index=False)
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_invoice_date ON transactions (InvoiceDate)"))
    finally:
        engine.dispose()
    df.to_parquet(processed / "cleaned_transactions.parquet", index=False)
    summary.to_csv(processed / "daily_sales_timeseries.csv", index=False)
    if save_csv:
        df.head(50000).to_csv(processed / "cleaned_transactions.csv", index=False)
    print(
        f"Validated {audit['clean_rows']:,} of {audit['raw_rows']:,} rows. Legacy USD/INR columns use illustrative fixed rates; application conversions use dated provider rates."
    )
    return df, summary


if __name__ == "__main__":
    run_etl(str(Path(__file__).resolve().parents[1]))
