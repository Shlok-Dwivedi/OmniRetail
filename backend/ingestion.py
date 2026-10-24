"""Validated multi-format ingestion. Currency amounts are always stored in GBP."""

import io
import json
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd
from defusedxml import ElementTree

REQUIRED = {"InvoiceNo", "StockCode", "Quantity", "InvoiceDate", "UnitPrice", "Country"}
ADMIN_CODES = {"POST", "D", "DOT", "M", "BANK CHARGES", "PADS", "CRUK", "AMAZONFEE", "B"}


def read_source(content: bytes, filename: str) -> pd.DataFrame:
    suffix = Path(filename).suffix.lower()
    stream = io.BytesIO(content)
    if suffix in {".csv", ".txt"}:
        return pd.read_csv(stream, dtype={"InvoiceNo": str, "StockCode": str})
    if suffix == ".xlsx":
        with zipfile.ZipFile(stream) as archive:
            if sum(info.file_size for info in archive.infolist()) > 300 * 1024 * 1024:
                raise ValueError("This workbook expands beyond the 300 MB safety limit.")
        stream.seek(0)
        return pd.read_excel(stream, dtype={"InvoiceNo": str, "StockCode": str})
    if suffix == ".json":
        records = json.loads(content)
        if isinstance(records, dict):
            records = records.get("transactions", records.get("data"))
        if not isinstance(records, list):
            raise ValueError("Use a JSON array of transactions or a transactions/data array.")
        return pd.DataFrame(records)
    if suffix == ".xml":
        root = ElementTree.fromstring(content)
        return pd.DataFrame([{child.tag: child.text for child in row} for row in root])
    raise ValueError("Choose a CSV, TXT, XLSX, JSON, or XML file.")


def clean_transactions(raw: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    missing = REQUIRED - set(raw.columns)
    if missing:
        raise ValueError("Missing columns: " + ", ".join(sorted(missing)))
    if raw.empty or len(raw) > 1_000_000:
        raise ValueError("The dataset must contain between 1 and 1,000,000 rows.")
    df = raw.copy()
    # Discard derived input columns; never trust imported totals or cancellation flags.
    df = df[list(sorted(REQUIRED)) + [c for c in ["Description", "CustomerID"] if c in df]]
    for col in ["InvoiceNo", "StockCode", "Country"]:
        df[col] = df[col].astype("string").str.strip()
    for col in ["Quantity", "UnitPrice"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df["InvoiceDate"] = pd.to_datetime(df["InvoiceDate"], errors="coerce", format="mixed")
    try:
        df["InvoiceDate"] = df["InvoiceDate"].dt.tz_localize(None)
    except AttributeError as exc:
        raise ValueError("Use consistent, timezone-free invoice dates.") from exc
    invalid = (
        df["InvoiceDate"].isna()
        | ~np.isfinite(df["Quantity"])
        | ~np.isfinite(df["UnitPrice"])
        | (df["Quantity"] == 0)
        | (df["UnitPrice"] <= 0)
        | (df["Quantity"].abs() > 1e9)
        | (df["UnitPrice"] > 1e9)
        | df["InvoiceNo"].isna()
        | df["StockCode"].isna()
        | df["InvoiceNo"].eq("")
        | df["StockCode"].eq("")
    )
    invalid_count = int(invalid.sum())
    df = df.loc[~invalid].copy()
    admin = df["StockCode"].str.upper().isin(ADMIN_CODES)
    admin_count = int(admin.sum())
    df = df.loc[~admin].copy()
    duplicates = int(df.duplicated().sum())
    df = df.drop_duplicates().copy()
    if df.empty:
        raise ValueError("No valid product transactions remain after cleaning.")
    df["Description"] = (
        df.get("Description", pd.Series(index=df.index, dtype=str))
        .fillna("Unknown product")
        .astype(str)
        .str.strip()
        .replace("", "Unknown product")
    )
    df["Country"] = df["Country"].fillna("Unspecified").replace("", "Unspecified")
    customers = (
        df.get("CustomerID", pd.Series(index=df.index, dtype=str))
        .astype("string")
        .str.strip()
        .str.replace(r"\.0$", "", regex=True)
    )
    customers = customers.mask(customers.isin(["", "nan", "None", "GUEST"]))
    df["CustomerID_Clean"] = customers.map(
        lambda x: "GUEST" if pd.isna(x) else str(x) if str(x).startswith("CUST_") else "CUST_" + str(x)
    )
    df["IsCancelled"] = df["InvoiceNo"].str.upper().str.startswith("C") | (df["Quantity"] < 0)
    # A cancellation invoice is a refund even when a source supplies a positive quantity.
    df.loc[df["IsCancelled"], "Quantity"] = -df.loc[df["IsCancelled"], "Quantity"].abs()
    df["TotalPriceGBP"] = (df["Quantity"] * df["UnitPrice"]).round(2)
    df["InvoiceDay"] = df["InvoiceDate"].dt.strftime("%Y-%m-%d")
    df["InvoiceNoStr"] = df["InvoiceNo"]
    # Legacy analysis compatibility; illustrative rates, never exposed as live FX.
    df["TotalPriceUSD"] = (df["TotalPriceGBP"] * 1.30).round(2)
    df["TotalPriceINR"] = (df["TotalPriceGBP"] * 108.50).round(2)
    df = df.sort_values("InvoiceDate").reset_index(drop=True)
    if not (~df["IsCancelled"]).any():
        raise ValueError("Include at least one completed sale.")
    audit = {
        "raw_rows": len(raw),
        "clean_rows": len(df),
        "invalid_rows": invalid_count,
        "administrative_rows": admin_count,
        "duplicate_rows": duplicates,
        "guest_rows": int(df["CustomerID_Clean"].eq("GUEST").sum()),
        "return_rows": int(df["IsCancelled"].sum()),
        "start": df["InvoiceDay"].min(),
        "end": df["InvoiceDay"].max(),
    }
    return df, audit
