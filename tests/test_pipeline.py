"""Integration checks on the bundled UCI dataset; no fabricated quality thresholds."""

from pathlib import Path

import numpy as np
import pandas as pd

from backend.analytics import Analytics
from src.time_series_arima import fit_arima_and_forecast, prepare_time_series

PROJECT_ROOT = Path(__file__).resolve().parents[1]


def test_processed_data_exists():
    for relative in [
        "processed/cleaned_transactions.parquet",
        "processed/rfm_customers.csv",
        "database/omni_retail.db",
    ]:
        assert (PROJECT_ROOT / "data" / relative).exists()


def test_rfm_feature_properties():
    rfm = pd.read_csv(PROJECT_ROOT / "data/processed/rfm_customers.csv")
    assert len(rfm) > 4000
    assert rfm.CustomerID.is_unique
    assert (rfm.RecencyDays >= 0).all()
    assert (rfm.Frequency >= 1).all()
    assert (rfm.MonetaryGBP > 0).all()
    assert rfm.R_Score.between(1, 4).all()
    assert rfm.F_Score.between(1, 4).all()


def test_regression_model_is_evaluated_without_target_period_features():
    tx = pd.read_parquet(PROJECT_ROOT / "data/processed/cleaned_transactions.parquet")
    analytics = Analytics(tx, {}, "UCI test")
    result = analytics.customer_model
    metadata = result["metadata"]
    assert (
        tx.InvoiceDate.max().normalize() + pd.Timedelta(days=1) - pd.Timestamp(metadata["cutoff"])
    ).days == 90
    assert metadata["train_customers"] > metadata["test_customers"] > 0
    assert metadata["baseline_mae"] > 0
    assert result["model"].feature_names_in_.tolist() == [
        "RecencyDays",
        "Frequency",
        "TenureDays",
        "AverageOrderValueGBP",
    ]
    for model in metadata["models"].values():
        assert np.isfinite(model["r2"])
        assert model["rmse"] > 0 and model["mae"] > 0


def test_arima_forecasting():
    tx = pd.read_parquet(PROJECT_ROOT / "data/processed/cleaned_transactions.parquet")
    daily = prepare_time_series(tx)
    assert len(daily) > 300
    assert daily.index.to_series().diff().dropna().eq(pd.Timedelta(days=1)).all()
    forecast = fit_arima_and_forecast(daily, forecast_horizon=14)
    points = forecast["Forecast_DF"]
    assert len(points) == 14
    assert points.index.min() == daily.index.max() + pd.Timedelta(days=1)
    assert (points.PredictedRevenueGBP >= points.LowerBoundGBP).all()
    assert (points.UpperBoundGBP >= points.PredictedRevenueGBP).all()
    assert forecast["Baseline_RMSE"] > 0
