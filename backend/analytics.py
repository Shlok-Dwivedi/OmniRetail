"""Business aggregates and leak-free, held-out customer modeling."""

from functools import cached_property
import warnings

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression, LogisticRegression, Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from src.feature_engineering import build_rfm_features
from src.time_series_arima import (
    decompose_series,
    fit_arima_and_forecast,
    prepare_time_series,
    run_stationarity_test,
)

FEATURES = ["RecencyDays", "Frequency", "TenureDays", "AverageOrderValueGBP"]


def records(frame: pd.DataFrame) -> list[dict]:
    """Strict JSON-safe conversion, including pandas/numpy timestamps and NaN."""
    import json

    return json.loads(frame.to_json(orient="records", date_format="iso"))


class Analytics:
    def __init__(self, transactions: pd.DataFrame, audit: dict, name: str):
        self.tx = transactions
        self.sales = transactions.loc[~transactions["IsCancelled"]].copy()
        self.audit = audit
        self.name = name

    @cached_property
    def rfm(self):
        if self.sales["CustomerID_Clean"].eq("GUEST").all():
            return pd.DataFrame()
        return build_rfm_features(self.tx)[0]

    @cached_property
    def daily(self):
        return prepare_time_series(self.tx)

    def filtered(self, start=None, end=None, country=None):
        df = self.tx
        if start:
            df = df.loc[df["InvoiceDate"] >= pd.Timestamp(start)]
        if end:
            df = df.loc[df["InvoiceDate"] < pd.Timestamp(end) + pd.Timedelta(days=1)]
        if country:
            df = df.loc[df["Country"].eq(country)]
        return df

    def overview(self, start=None, end=None, country=None):
        df = self.filtered(start, end, country)
        sales = df.loc[~df["IsCancelled"]]
        revenue = float(sales["TotalPriceGBP"].sum())
        refunds = abs(float(df.loc[df["IsCancelled"], "TotalPriceGBP"].sum()))
        orders = int(sales["InvoiceNo"].nunique())
        customers = int(sales.loc[sales["CustomerID_Clean"].ne("GUEST"), "CustomerID_Clean"].nunique())
        daily = (
            sales.groupby("InvoiceDay")
            .agg(revenue=("TotalPriceGBP", "sum"), orders=("InvoiceNo", "nunique"))
            .sort_index()
        )
        if len(sales):
            idx = pd.date_range(
                pd.Timestamp(start) if start else sales["InvoiceDate"].min().normalize(),
                pd.Timestamp(end) if end else sales["InvoiceDate"].max().normalize(),
                freq="D",
            ).strftime("%Y-%m-%d")
            daily = daily.reindex(idx, fill_value=0)
        daily["average"] = daily["revenue"].rolling(7, min_periods=1).mean()
        daily = daily.rename_axis("date").reset_index()
        markets = (
            sales.groupby("Country")
            .agg(revenue=("TotalPriceGBP", "sum"), orders=("InvoiceNo", "nunique"))
            .sort_values("revenue", ascending=False)
            .rename_axis("country")
            .reset_index()
        )
        products = (
            sales.groupby(["StockCode", "Description"])
            .agg(revenue=("TotalPriceGBP", "sum"), units=("Quantity", "sum"), orders=("InvoiceNo", "nunique"))
            .sort_values("revenue", ascending=False)
            .head(10)
            .reset_index()
            .rename(columns={"StockCode": "code", "Description": "name"})
        )
        # Compare equally long adjacent calendar windows, only when history exists.
        change = None
        if len(sales):
            last = pd.Timestamp(end) if end else sales["InvoiceDate"].max().normalize()
            first = pd.Timestamp(start) if start else sales["InvoiceDate"].min().normalize()
            days = (last - first).days + 1
            previous_start = first - pd.Timedelta(days=days)
            if previous_start >= self.sales["InvoiceDate"].min().normalize():
                prev = self.sales.loc[
                    (self.sales["InvoiceDate"] >= previous_start) & (self.sales["InvoiceDate"] < first)
                ]
                if country:
                    prev = prev.loc[prev["Country"].eq(country)]
                prior = float(prev["TotalPriceGBP"].sum())
                if prior > 0:
                    change = round((revenue / prior - 1) * 100, 1)
        return {
            "revenue": round(revenue, 2),
            "refunds": round(refunds, 2),
            "net_revenue": round(revenue - refunds, 2),
            "orders": orders,
            "customers": customers,
            "aov": round(revenue / orders, 2) if orders else 0,
            "units": int(sales["Quantity"].sum()),
            "change": change,
            "daily": records(daily),
            "markets": records(markets),
            "products": records(products),
            "rows": len(df),
        }

    @cached_property
    def customer_model(self):
        """Past behavior predicts the final 90 observed days; no same-period target features."""
        last = self.sales["InvoiceDate"].max().normalize() + pd.Timedelta(days=1)
        cutoff = last - pd.Timedelta(days=90)
        history = self.tx.loc[self.tx["InvoiceDate"] < cutoff]
        if history.empty or (cutoff - history["InvoiceDate"].min()).days < 30:
            raise ValueError("Spend estimation needs at least 120 days of sales history.")
        features, _ = build_rfm_features(history, reference_date=cutoff)
        future = (
            self.sales.loc[self.sales["InvoiceDate"] >= cutoff]
            .groupby("CustomerID_Clean")["TotalPriceGBP"]
            .sum()
        )
        features["FutureSpend"] = features["CustomerID"].map(future).fillna(0)
        if len(features) < 30:
            raise ValueError(
                "Spend estimation needs at least 30 identified customers before the validation window."
            )
        xtrain, xtest, ytrain, ytest = train_test_split(
            features[FEATURES], features["FutureSpend"], test_size=0.25, random_state=42
        )
        metrics = {}
        fitted = {}
        for name, estimator in [
            ("Linear regression", LinearRegression()),
            ("Ridge regression", Ridge(alpha=10)),
        ]:
            model = make_pipeline(StandardScaler(), estimator).fit(xtrain, ytrain)
            pred = np.maximum(0, model.predict(xtest))
            metrics[name] = {
                "r2": round(float(r2_score(ytest, pred)), 4),
                "rmse": round(float(np.sqrt(mean_squared_error(ytest, pred))), 2),
                "mae": round(float(mean_absolute_error(ytest, pred)), 2),
            }
            fitted[name] = model
        baseline = np.repeat(ytrain.mean(), len(ytest))
        baseline_mae = round(float(mean_absolute_error(ytest, baseline)), 2)
        selected = "Ridge regression"
        validation_model = fitted[selected]
        high_threshold = float(ytrain.quantile(0.75))
        high_train = (ytrain > high_threshold).astype(int)
        high_test = (ytest > high_threshold).astype(int)
        classifier = None
        auc = None
        if high_train.nunique() > 1 and high_test.nunique() > 1:
            classifier = make_pipeline(
                StandardScaler(), LogisticRegression(max_iter=2000, random_state=42)
            ).fit(xtrain, high_train)
            auc = round(float(roc_auc_score(high_test, classifier.predict_proba(xtest)[:, 1])), 4)
        residuals = ytest.to_numpy() - np.maximum(0, validation_model.predict(xtest))
        interval = float(np.quantile(np.abs(residuals), 0.90))
        final = make_pipeline(StandardScaler(), Ridge(alpha=10)).fit(
            features[FEATURES], features["FutureSpend"]
        )
        return {
            "model": final,
            "classifier": classifier,
            "interval": interval,
            "metadata": {
                "models": metrics,
                "selected": selected,
                "baseline_mae": baseline_mae,
                "classifier_auc": auc,
                "train_customers": len(xtrain),
                "test_customers": len(xtest),
                "cutoff": cutoff.strftime("%Y-%m-%d"),
                "horizon": 90,
                "high_value_threshold": round(high_threshold, 2),
                "limitations": "Historical holdout evaluation; estimates may be unreliable for large wholesale buyers or changing seasonal demand. The range uses held-out absolute errors and is not a calibrated guarantee.",
            },
        }

    def predict(self, values):
        result = self.customer_model
        x = pd.DataFrame([values], columns=FEATURES)
        value = max(0.0, float(result["model"].predict(x)[0]))
        prob = (
            float(result["classifier"].predict_proba(x)[0, 1]) if result["classifier"] is not None else None
        )
        return {
            "estimate": round(value, 2),
            "lower": round(max(0, value - result["interval"]), 2),
            "upper": round(value + result["interval"], 2),
            "high_value_probability": prob,
            "horizon": 90,
        }

    def customer_summary(self):
        rfm = self.rfm
        if rfm.empty:
            return {
                "total": 0,
                "segments": [],
                "scatter": [],
                "histogram": [],
                "boxes": [],
                "correlations": [],
                "outliers": 0,
            }
        segments = (
            rfm.groupby("CustomerSegment")
            .agg(count=("CustomerID", "size"), revenue=("MonetaryGBP", "sum"))
            .rename_axis("segment")
            .reset_index()
        )
        clean = rfm.loc[~rfm["IsMonetaryOutlier"]]
        counts, edges = np.histogram(clean["AverageOrderValueGBP"], bins=20)
        histogram = [
            {"value": round(float((edges[i] + edges[i + 1]) / 2), 2), "count": int(c)}
            for i, c in enumerate(counts)
        ]
        boxes = []
        for country in rfm["Country"].value_counts().head(6).index:
            s = rfm.loc[rfm["Country"].eq(country), "MonetaryGBP"]
            q1, median, q3 = s.quantile([0.25, 0.5, 0.75])
            iqr = q3 - q1
            inliers = s.loc[s.between(q1 - 1.5 * iqr, q3 + 1.5 * iqr)]
            boxes.append(
                {
                    "country": country,
                    "min": float(inliers.min()),
                    "q1": float(q1),
                    "median": float(median),
                    "q3": float(q3),
                    "max": float(inliers.max()),
                }
            )
        cols = ["RecencyDays", "Frequency", "MonetaryGBP", "TenureDays", "AverageOrderValueGBP"]
        correlations = {
            method: records(rfm[cols].corr(method=method).rename_axis("feature").reset_index())
            for method in ["pearson", "spearman"]
        }
        scatter = clean.sample(min(600, len(clean)), random_state=42)
        return {
            "total": len(rfm),
            "segments": records(segments),
            "scatter": records(
                scatter[["CustomerID", "Frequency", "MonetaryGBP", "AverageOrderValueGBP", "CustomerSegment"]]
            ),
            "histogram": histogram,
            "boxes": boxes,
            "correlations": correlations,
            "outliers": int(rfm["IsMonetaryOutlier"].sum()),
        }

    def forecast(self, horizon=30):
        daily = self.daily
        if len(daily) < 30:
            raise ValueError("Forecasting needs at least 30 calendar days of sales history.")
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", category=UserWarning)
            result = fit_arima_and_forecast(daily, forecast_horizon=horizon)
            stationarity = run_stationarity_test(daily["RevenueGBP"])
            decomposed = decompose_series(daily)
        history = daily.tail(90).rename_axis("date").reset_index()
        points = result["Forecast_DF"].rename_axis("date").reset_index()
        components = pd.DataFrame(decomposed).rename_axis("date").reset_index()
        return {
            "history": records(history),
            "forecast": records(points),
            "decomposition": records(components),
            "stationarity": stationarity,
            "rmse": result["Validation_RMSE"],
            "mape": result["Validation_MAPE_Percent"],
            "baseline_rmse": result["Baseline_RMSE"],
            "aic": result["AIC"],
            "total": round(float(points["PredictedRevenueGBP"].sum()), 2),
            "horizon": horizon,
            "warnings": result.get("Warnings", []),
        }
