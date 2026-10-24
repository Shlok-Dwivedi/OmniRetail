"""HTTP boundary for the retail workspace. Run with uvicorn backend.main:app."""

from contextlib import asynccontextmanager
from datetime import date
from io import BytesIO
import logging
import os
from typing import Annotated, Literal

from fastapi import Depends, FastAPI, File, HTTPException, Query, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, model_validator
import requests

from . import config
from .analytics import records
from .currency import CurrencyService
from .reports import spreadsheet_safe, workbook
from .store import DataStore

logger = logging.getLogger(__name__)


class Filters(BaseModel):
    start: date | None = None
    end: date | None = None
    country: str | None = Field(None, max_length=100)

    @model_validator(mode="after")
    def ordered(self):
        for value in (self.start, self.end):
            if value and not date(1678, 1, 1) <= value <= date(2261, 12, 31):
                raise ValueError("Choose dates between 1678 and 2261.")
        if self.start and self.end and self.start > self.end:
            raise ValueError("The start date must be before the end date.")
        if self.start and self.end and (self.end - self.start).days > 36525:
            raise ValueError("Choose a date range shorter than 100 years.")
        return self

    def values(self):
        return {
            "start": self.start.isoformat() if self.start else None,
            "end": self.end.isoformat() if self.end else None,
            "country": self.country,
        }


def filters(
    start: date | None = None, end: date | None = None, country: str | None = Query(None, max_length=100)
):
    try:
        return Filters(start=start, end=end, country=country)
    except ValueError as exc:
        raise HTTPException(422, "Choose a valid date range; the start must precede the end.") from exc


class Prediction(BaseModel):
    recency: int = Field(30, ge=0, le=3650)
    frequency: int = Field(5, ge=1, le=10000)
    tenure: int = Field(180, ge=1, le=36500)
    average_order_value: float = Field(100, gt=0, le=1000000, allow_inf_nan=False)

    @model_validator(mode="after")
    def consistent(self):
        if self.recency > self.tenure:
            raise ValueError("Days since last purchase cannot exceed customer tenure.")
        return self


def create_app(data_dir=None):
    @asynccontextmanager
    async def lifespan(app):
        app.state.store = DataStore(data_dir or config.DATA_DIR)
        app.state.currency = CurrencyService(app.state.store.workspace)
        yield
        app.state.store.close()

    app = FastAPI(title="OmniRetail", version="2.0.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=os.environ.get(
            "OMNIRETAIL_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
        ).split(","),
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )

    @app.exception_handler(ValueError)
    async def invalid_value(request, exc):
        return JSONResponse(status_code=422, content={"detail": str(exc)[:500]})

    @app.exception_handler(RequestValidationError)
    async def invalid_request(request, exc):
        return JSONResponse(
            status_code=422, content={"detail": "Please check the dates and values, then try again."}
        )

    @app.exception_handler(Exception)
    async def unexpected(request, exc):
        logger.exception("Request failed: %s", request.url.path, exc_info=exc)
        return JSONResponse(status_code=500, content={"detail": "Something went wrong. Please try again."})

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-Frame-Options"] = "DENY"
        return response

    @app.get("/api/health")
    def health():
        return {"status": "ok", "version": "2.0.0", "dataset": app.state.store.version}

    @app.get("/api/meta")
    def meta():
        a = app.state.store.analytics
        return {
            "name": a.name,
            "version": app.state.store.version,
            "audit": a.audit,
            "countries": sorted(a.tx["Country"].unique().tolist()),
            "currency": app.state.currency.snapshot,
        }

    @app.get("/api/overview")
    def overview(f: Annotated[Filters, Depends(filters)]):
        return app.state.store.analytics.overview(**f.values())

    @app.get("/api/customers/summary")
    def customer_summary():
        return app.state.store.analytics.customer_summary()

    @app.get("/api/customers")
    def customers(
        search: str = Query("", max_length=100),
        segment: str | None = None,
        page: int = Query(1, ge=1),
        page_size: int = Query(20, ge=1, le=100),
        sort: Literal["spend", "recent", "orders"] = "spend",
    ):
        frame = app.state.store.analytics.rfm
        if frame.empty:
            return {"items": [], "total": 0, "page": page, "pages": 0}
        if search:
            frame = frame.loc[
                frame["CustomerID"].str.contains(search, case=False, regex=False)
                | frame["Country"].str.contains(search, case=False, regex=False)
            ]
        if segment:
            frame = frame.loc[frame["CustomerSegment"].eq(segment)]
        frame = frame.sort_values(
            {"spend": "MonetaryGBP", "recent": "RecencyDays", "orders": "Frequency"}[sort],
            ascending=sort == "recent",
        )
        total = len(frame)
        frame = frame.iloc[(page - 1) * page_size : page * page_size]
        return {
            "items": records(
                frame[
                    [
                        "CustomerID",
                        "Country",
                        "RecencyDays",
                        "Frequency",
                        "MonetaryGBP",
                        "AverageOrderValueGBP",
                        "CustomerSegment",
                        "CancellationRate",
                    ]
                ]
            ),
            "total": total,
            "page": page,
            "pages": (total + page_size - 1) // page_size,
        }

    @app.get("/api/models")
    def models():
        return app.state.store.analytics.customer_model["metadata"]

    @app.post("/api/predict")
    def predict(body: Prediction):
        return app.state.store.analytics.predict(
            {
                "RecencyDays": body.recency,
                "Frequency": body.frequency,
                "TenureDays": body.tenure,
                "AverageOrderValueGBP": body.average_order_value,
            }
        )

    @app.get("/api/forecast")
    def forecast(horizon: int = Query(30, ge=7, le=90)):
        return app.state.store.forecast(horizon)

    @app.get("/api/export/{kind}")
    def export(
        kind: Literal["workbook", "transactions", "customers", "forecast"],
        f: Annotated[Filters, Depends(filters)],
        horizon: int = Query(30, ge=7, le=90),
    ):
        a = app.state.store.analytics
        if kind == "workbook":
            return StreamingResponse(
                BytesIO(workbook(a, **f.values())),
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": 'attachment; filename="OmniRetail-report.xlsx"'},
            )
        if kind == "transactions":
            frame = a.filtered(**f.values())[
                [
                    "InvoiceNo",
                    "StockCode",
                    "Description",
                    "Quantity",
                    "InvoiceDate",
                    "UnitPrice",
                    "CustomerID_Clean",
                    "Country",
                    "IsCancelled",
                    "TotalPriceGBP",
                ]
            ]
        elif kind == "customers":
            frame = a.rfm
        else:
            import pandas as pd

            frame = pd.DataFrame(app.state.store.forecast(horizon)["forecast"])
        return Response(
            spreadsheet_safe(frame).to_csv(index=False),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="OmniRetail-{kind}.csv"'},
        )

    @app.post("/api/import", status_code=202)
    async def import_file(file: Annotated[UploadFile, File()]):
        try:
            content = await file.read(config.MAX_UPLOAD_BYTES + 1)
            if len(content) > config.MAX_UPLOAD_BYTES:
                raise HTTPException(413, "Files must be 40 MB or smaller.")
            if not content:
                raise HTTPException(422, "Choose a file containing transactions.")
            from pathlib import Path

            if Path(file.filename or "").suffix.lower() not in {".csv", ".xlsx", ".json", ".xml", ".txt"}:
                raise HTTPException(422, "Choose a CSV, TXT, XLSX, JSON, or XML file.")
            try:
                return app.state.store.submit(content, file.filename or "transactions.csv")
            except ValueError as exc:
                raise HTTPException(409, str(exc)) from exc
        finally:
            await file.close()

    @app.get("/api/import/{job_id}")
    def import_status(job_id: str):
        with app.state.store.lock:
            job = app.state.store.jobs.get(job_id)
            if job is None:
                raise HTTPException(404, "This import could not be found.")
            return dict(job)

    @app.post("/api/currency/refresh")
    def refresh_currency():
        try:
            return app.state.currency.refresh(app.state.store.analytics.audit["end"])
        except (requests.RequestException, KeyError, TypeError, ValueError) as exc:
            logger.warning("Exchange rate lookup failed: %s", exc)
            raise HTTPException(
                503, "Exchange rates are temporarily unavailable. Your existing currency remains available."
            ) from exc

    @app.get("/api/template")
    def template():
        return Response(
            "InvoiceNo,StockCode,Description,Quantity,InvoiceDate,UnitPrice,CustomerID,Country\n10001,SKU001,Ceramic mug,2,2026-01-01 10:00:00,12.50,1001,United Kingdom\n",
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="retail-import-template.csv"'},
        )

    if config.FRONTEND_DIST.exists():
        app.mount("/assets", StaticFiles(directory=config.FRONTEND_DIST / "assets"), name="assets")

        @app.get("/{path:path}", include_in_schema=False)
        def frontend(path: str):
            if path.startswith("api/"):
                raise HTTPException(404, "Not found")
            candidate = (config.FRONTEND_DIST / path).resolve()
            if candidate.is_relative_to(config.FRONTEND_DIST) and candidate.is_file():
                return FileResponse(candidate)
            return FileResponse(config.FRONTEND_DIST / "index.html")

    return app


app = create_app()
