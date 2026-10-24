"""Run browser tests against disposable data, never the user's workspace."""

from pathlib import Path
import sys
import tempfile

import numpy as np
import pandas as pd
import uvicorn

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.main import create_app

with tempfile.TemporaryDirectory(prefix="omniretail-browser-") as temporary:
    directory = Path(temporary)
    (directory / "raw").mkdir()
    rng = np.random.default_rng(42)
    rows = []
    for day in range(210):
        for customer in range(1, 49):
            if rng.random() > 0.15:
                continue
            rows.append(
                {
                    "InvoiceNo": f"{day:03}{customer:03}",
                    "StockCode": f"SKU{customer % 4}",
                    "Description": ["Ceramic mug", "Linen napkin", "Glass vase", "Cotton tote"][customer % 4],
                    "Quantity": int(rng.integers(1, 5)),
                    "InvoiceDate": pd.Timestamp("2025-01-01") + pd.Timedelta(days=day),
                    "UnitPrice": float(5 + customer % 10),
                    "CustomerID": customer,
                    "Country": "United Kingdom" if customer % 3 else "France",
                }
            )
    pd.DataFrame(rows).to_excel(directory / "raw" / "Online Retail.xlsx", index=False)
    uvicorn.run(create_app(directory), host="127.0.0.1", port=8001)
