from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from backend.main import create_app


@pytest.fixture
def raw_transactions():
    rng = np.random.default_rng(42)
    rows = []
    for day in range(210):
        for customer in range(1, 49):
            if rng.random() > 0.13:
                continue
            rows.append(
                {
                    "InvoiceNo": f"{day:03}{customer:03}",
                    "StockCode": "SKU1",
                    "Description": "Ceramic mug",
                    "Quantity": int(rng.integers(1, 5)),
                    "InvoiceDate": pd.Timestamp("2025-01-01") + pd.Timedelta(days=day),
                    "UnitPrice": float(5 + customer % 10),
                    "CustomerID": customer,
                    "Country": "United Kingdom" if customer % 3 else "France",
                }
            )
    return pd.DataFrame(rows)


@pytest.fixture
def data_dir(tmp_path, raw_transactions):
    source = tmp_path / "raw"
    source.mkdir()
    raw_transactions.to_excel(source / "Online Retail.xlsx", index=False)
    return tmp_path


@pytest.fixture
def client(data_dir):
    with TestClient(create_app(Path(data_dir))) as test_client:
        yield test_client
