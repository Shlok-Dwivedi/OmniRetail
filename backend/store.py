"""Atomic dataset snapshots; readers continue using the last complete import."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
import logging
import os
from pathlib import Path
from threading import Lock
from uuid import uuid4

import pandas as pd
from sqlalchemy import create_engine, text

from .analytics import Analytics
from .ingestion import clean_transactions, read_source

logger = logging.getLogger(__name__)


class DataStore:
    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self.workspace = data_dir / "workspace"
        self.workspace.mkdir(parents=True, exist_ok=True)
        self.lock = Lock()
        self.executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="retail-import")
        self.jobs = {}
        self.busy = False
        self.analytics = None
        self.version = None
        self.forecasts = {}
        self.forecast_lock = Lock()
        pointer = self.workspace / "current.json"
        if pointer.exists():
            metadata = json.loads(pointer.read_text())
            frame = pd.read_parquet(self.workspace / metadata["version"] / "transactions.parquet")
            self.analytics = Analytics(frame, metadata["audit"], metadata["name"])
            self.version = metadata["version"]
        else:
            source = data_dir / "raw" / "Online Retail.xlsx"
            if not source.exists():
                raise FileNotFoundError(
                    "Retail source data is missing. Run python -m backend.cli prepare --download."
                )
            self.install(read_source(source.read_bytes(), source.name), "UCI Online Retail")

    def install(self, raw, name):
        frame, audit = clean_transactions(raw)
        version = uuid4().hex
        directory = self.workspace / version
        directory.mkdir()
        frame.to_parquet(directory / "transactions.parquet", index=False)
        engine = create_engine(f"sqlite:///{directory / 'retail.db'}")
        try:
            with engine.begin() as conn:
                frame.to_sql("transactions", conn, if_exists="replace", index=False, chunksize=10000)
                conn.execute(text("CREATE INDEX idx_date_country ON transactions (InvoiceDate, Country)"))
                conn.execute(text("CREATE INDEX idx_customer ON transactions (CustomerID_Clean)"))
                frame.loc[
                    frame["CustomerID_Clean"].ne("GUEST"), ["CustomerID_Clean", "Country"]
                ].drop_duplicates("CustomerID_Clean").to_sql("customers", conn, index=False)
                conn.execute(text("CREATE UNIQUE INDEX idx_customer_id ON customers (CustomerID_Clean)"))
        finally:
            engine.dispose()
        metadata = {
            "version": version,
            "name": name,
            "audit": audit,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        temporary = self.workspace / f"{version}.json"
        temporary.write_text(json.dumps(metadata), encoding="utf-8")
        replacement = Analytics(frame, audit, name)
        with self.lock:
            os.replace(temporary, self.workspace / "current.json")
            self.analytics = replacement
            self.version = version
            self.forecasts.clear()
        return audit

    def submit(self, content: bytes, filename: str):
        with self.lock:
            if self.busy:
                raise ValueError("An import is already running. Please wait for it to finish.")
            self.busy = True
            job_id = uuid4().hex
            # Bound retained job metadata for long-running workspaces.
            if len(self.jobs) >= 50:
                self.jobs.pop(next(iter(self.jobs)))
            self.jobs[job_id] = {"id": job_id, "status": "processing", "filename": filename}

        def work():
            try:
                audit = self.install(read_source(content, filename), Path(filename).name)
                result = {"status": "complete", "audit": audit}
            except (ValueError, TypeError, KeyError, OSError) as exc:
                logger.exception("Import failed")
                result = {"status": "failed", "message": str(exc)[:500]}
            except Exception:
                logger.exception("Unexpected import failure")
                result = {
                    "status": "failed",
                    "message": "The file could not be imported. Check its format and try again.",
                }
            finally:
                with self.lock:
                    self.jobs[job_id].update(result)
                    self.busy = False

        self.executor.submit(work)
        return dict(self.jobs[job_id])

    def forecast(self, horizon):
        # Model fitting is serialized, cached by immutable dataset version and horizon.
        with self.forecast_lock:
            with self.lock:
                version, analytics = self.version, self.analytics
            key = (version, horizon)
            cached = self.forecasts.get(key)
            if cached is None:
                value = analytics.forecast(horizon)
                with self.lock:
                    if self.version == version:
                        self.forecasts[key] = value
                return value
            return cached

    def close(self):
        self.executor.shutdown(wait=True)
