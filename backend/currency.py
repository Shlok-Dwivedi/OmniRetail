"""Explicitly dated exchange-rate snapshots; no silent simulated/live fallback."""

import json
import logging
from threading import Lock

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


class CurrencyService:
    def __init__(self, workspace):
        self.path = workspace / "exchange-rates.json"
        self.lock = Lock()
        self.snapshot = {
            "base": "GBP",
            "rates": {"GBP": 1.0},
            "date": None,
            "source": "Original transaction currency",
            "status": "original",
        }
        if self.path.exists():
            try:
                snapshot = json.loads(self.path.read_text())
                if snapshot.get("base") != "GBP" or snapshot.get("rates", {}).get("GBP") != 1:
                    raise ValueError("Invalid rate snapshot")
                if not all(isinstance(v, (int, float)) and 0 < v < 10000 for v in snapshot["rates"].values()):
                    raise ValueError("Invalid cached exchange rate")
                self.snapshot = snapshot
            except (OSError, ValueError, TypeError, KeyError):
                logging.getLogger(__name__).warning("Cached exchange rates could not be read; using GBP.")

    def refresh(self, date):
        with self.lock:
            with requests.Session() as session:
                session.mount(
                    "https://",
                    HTTPAdapter(
                        max_retries=Retry(total=2, backoff_factor=0.3, status_forcelist=[429, 502, 503, 504])
                    ),
                )
                response = session.get(
                    f"https://api.frankfurter.dev/v1/{date}",
                    params={"base": "GBP", "symbols": "USD,INR"},
                    timeout=(5, 15),
                )
                response.raise_for_status()
                data = response.json()
            rates = {"GBP": 1.0, **{key: float(data["rates"][key]) for key in ["USD", "INR"]}}
            if data.get("base") != "GBP":
                raise ValueError("The provider returned a different base currency.")
            if any(not 0 < rate < 10000 for rate in rates.values()):
                raise ValueError("The exchange-rate provider returned invalid values.")
            snapshot = {
                "base": "GBP",
                "rates": rates,
                "date": data["date"],
                "source": "Frankfurter / European Central Bank",
                "status": "historical",
            }
            temp = self.path.with_suffix(".tmp")
            temp.write_text(json.dumps(snapshot))
            temp.replace(self.path)
            self.snapshot = snapshot
            return self.snapshot
