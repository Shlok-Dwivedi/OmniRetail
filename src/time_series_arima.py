"""
OmniRetail - Time Series Analytics & ARIMA Forecasting Module
Corresponds to DAV Lab 6 (Analytics on Time Series Data).

Techniques Implemented:
1. Resampling and Date Regularization (Daily & Weekly Revenue).
2. Time Series Decomposition: Observed, Trend, Seasonality, Residuals.
3. Moving Averages & Smoothing: 7-day SMA, 30-day SMA, 14-day EMA.
4. Stationarity Testing: Augmented Dickey-Fuller (ADF) test.
5. ARIMA(p, d, q) Model Fitting and 30-Day Forward Demand/Revenue Forecasting.
6. Forecast Accuracy Evaluation (RMSE, MAPE, AIC, BIC).
"""

import os
import numpy as np
import pandas as pd
from statsmodels.tsa.seasonal import seasonal_decompose
from statsmodels.tsa.stattools import adfuller
from statsmodels.tsa.arima.model import ARIMA
from sklearn.metrics import mean_squared_error, mean_absolute_percentage_error


def prepare_time_series(df_transactions: pd.DataFrame) -> pd.DataFrame:
    """
    Constructs a regular continuous daily time series of sales and orders.
    """
    valid_tx = df_transactions[~df_transactions["IsCancelled"]].copy()
    valid_tx["InvoiceDay"] = pd.to_datetime(valid_tx["InvoiceDate"]).dt.date

    daily = (
        valid_tx.groupby("InvoiceDay")
        .agg(
            RevenueGBP=("TotalPriceGBP", "sum"),
            RevenueINR=("TotalPriceINR", "sum"),
            Orders=("InvoiceNo", "nunique"),
            Items=("Quantity", "sum"),
        )
        .reset_index()
    )

    daily["InvoiceDay"] = pd.to_datetime(daily["InvoiceDay"])
    daily.set_index("InvoiceDay", inplace=True)

    # Reindex to a complete daily calendar frequency ('D'), filling non-trading days with 0
    full_idx = pd.date_range(start=daily.index.min(), end=daily.index.max(), freq="D")
    daily = daily.reindex(full_idx)
    daily["RevenueGBP"] = daily["RevenueGBP"].fillna(0.0)
    daily["RevenueINR"] = daily["RevenueINR"].fillna(0.0)
    daily["Orders"] = daily["Orders"].fillna(0).astype(int)
    daily["Items"] = daily["Items"].fillna(0).astype(int)

    # Compute Moving Averages and Smoothing (Lab 6 alignment)
    daily["SMA_7"] = daily["RevenueGBP"].rolling(window=7, min_periods=1).mean()
    daily["SMA_30"] = daily["RevenueGBP"].rolling(window=30, min_periods=1).mean()
    daily["EMA_14"] = daily["RevenueGBP"].ewm(span=14, adjust=False).mean()

    return daily


def run_stationarity_test(series: pd.Series) -> dict:
    """
    Performs Augmented Dickey-Fuller (ADF) test for stationarity.
    """
    clean_series = series.dropna()
    if len(clean_series) < 12 or clean_series.nunique() < 2:
        return {
            "ADF_Statistic": None,
            "p_value": None,
            "Used_Lags": 0,
            "Observations": len(clean_series),
            "Critical_Values": {},
            "Is_Stationary": None,
        }
    result = adfuller(clean_series, autolag="AIC")
    is_stationary = result[1] < 0.05
    return {
        "ADF_Statistic": round(float(result[0]), 4),
        "p_value": round(float(result[1]), 6),
        "Used_Lags": int(result[2]),
        "Observations": int(result[3]),
        "Critical_Values": {k: round(float(v), 4) for k, v in result[4].items()},
        "Is_Stationary": bool(is_stationary),
    }


def decompose_series(daily_df: pd.DataFrame, period: int = 7) -> dict:
    """
    Decomposes time series into Trend, Seasonality, and Residual components.
    """
    # Use additive model for zero-inclusive series
    decomp = seasonal_decompose(daily_df["RevenueGBP"], model="additive", period=period)
    return {
        "trend": decomp.trend,
        "seasonal": decomp.seasonal,
        "resid": decomp.resid,
        "observed": decomp.observed,
    }


def fit_arima_and_forecast(
    daily_df: pd.DataFrame, order: tuple = (1, 1, 1), forecast_horizon: int = 30
) -> dict:
    """
    Fits an ARIMA model on daily revenue and produces out-of-sample forecasts with confidence intervals.
    """
    if not 1 <= forecast_horizon <= 90:
        raise ValueError("Forecast horizon must be between 1 and 90 days.")
    if len(daily_df) < 30:
        raise ValueError("Forecasting requires at least 30 days of history.")
    series = daily_df["RevenueGBP"].astype(float)
    if not np.isfinite(series).all():
        raise ValueError("Revenue must contain only finite values.")
    train_size = int(len(series) * 0.85)
    train, test = series.iloc[:train_size], series.iloc[train_size:]

    # Train model on training partition for validation
    model_eval = ARIMA(train, order=order)
    model_eval_fit = model_eval.fit()
    pred_test = model_eval_fit.forecast(steps=len(test)).clip(lower=0)

    rmse = np.sqrt(mean_squared_error(test, pred_test))
    # Replace zeros in test to compute non-inf MAPE
    test_nonzero = test.replace(0, np.nan).dropna()
    pred_nonzero = pred_test.loc[test_nonzero.index]
    mape = mean_absolute_percentage_error(test_nonzero, pred_nonzero) * 100 if len(test_nonzero) else None
    baseline = np.resize(train.tail(7).values, len(test))
    baseline_rmse = np.sqrt(mean_squared_error(test, baseline))

    # Fit model on the full historical series for forward deployment
    model_full = ARIMA(series, order=order)
    model_full_fit = model_full.fit()
    forecast_obj = model_full_fit.get_forecast(steps=forecast_horizon)
    forecast_mean = forecast_obj.predicted_mean
    conf_int = forecast_obj.conf_int(alpha=0.05)

    forecast_dates = pd.date_range(
        start=series.index.max() + pd.Timedelta(days=1), periods=forecast_horizon, freq="D"
    )
    forecast_df = pd.DataFrame(
        {
            "ForecastDate": forecast_dates,
            "PredictedRevenueGBP": np.round(np.maximum(0, forecast_mean.values), 2),
            "LowerBoundGBP": np.round(np.maximum(0, conf_int.iloc[:, 0].values), 2),
            "UpperBoundGBP": np.round(np.maximum(0, conf_int.iloc[:, 1].values), 2),
        }
    ).set_index("ForecastDate")

    return {
        "model_fit": model_full_fit,
        "AIC": round(float(model_full_fit.aic), 2),
        "BIC": round(float(model_full_fit.bic), 2),
        "Validation_RMSE": round(float(rmse), 2),
        "Validation_MAPE_Percent": round(float(mape), 2) if mape is not None else None,
        "Baseline_RMSE": round(float(baseline_rmse), 2),
        "Warnings": []
        if model_full_fit.mle_retvals.get("converged", False)
        else ["The forecast model did not fully converge; treat estimates cautiously."],
        "Forecast_DF": forecast_df,
        "Order": order,
    }


def run_time_series_pipeline(project_dir: str):
    parquet_path = os.path.join(project_dir, "data", "processed", "cleaned_transactions.parquet")
    df_tx = pd.read_parquet(parquet_path)
    daily_df = prepare_time_series(df_tx)

    print("--- 1. Augmented Dickey-Fuller (ADF) Test (Lab 6) ---")
    adf_res = run_stationarity_test(daily_df["RevenueGBP"])
    print(f"ADF Statistic: {adf_res['ADF_Statistic']} | p-value: {adf_res['p_value']}")
    print(f"Series is Stationary: {adf_res['Is_Stationary']}")

    print("\n--- 2. Fitting ARIMA(1, 1, 1) Model ---")
    arima_res = fit_arima_and_forecast(daily_df, order=(1, 1, 1), forecast_horizon=30)
    print(f"Model AIC: {arima_res['AIC']} | BIC: {arima_res['BIC']}")
    print(
        f"Out-of-Sample RMSE: \u00a3{arima_res['Validation_RMSE']} | MAPE: {arima_res['Validation_MAPE_Percent']:.2f}%"
    )
    print("\n30-Day Forward Revenue Forecast Sample:")
    print(arima_res["Forecast_DF"].head(5))

    # Save daily time series with moving averages
    daily_out = os.path.join(project_dir, "data", "processed", "daily_sales_with_ma.csv")
    daily_df.to_csv(daily_out)
    print(f"\nSaved daily time series to {daily_out}")


if __name__ == "__main__":
    project_root = str(__import__("pathlib").Path(__file__).resolve().parents[1])
    run_time_series_pipeline(project_root)
