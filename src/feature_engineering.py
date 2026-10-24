"""
OmniRetail - Feature Engineering & Customer Analytics Module
Corresponds to DAV Lab 2 (Data Cleaning), Lab 3 (Normalization/Standardization & Regression prep),
and Lab 8 (IQR Outlier Detection).

Tasks:
1. Calculates RFM (Recency, Frequency, Monetary) metrics for identified customers.
2. Performs IQR Outlier Detection on monetary spend and order frequency.
3. Applies StandardScaler and MinMaxScaler on customer features.
4. Categorizes customers into Loyalty Segments (Champions, Loyal, At Risk, Hibernating).
"""

import os
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler, MinMaxScaler


def build_rfm_features(df_transactions: pd.DataFrame, reference_date=None) -> tuple[pd.DataFrame, dict]:
    """
    Computes RFM metrics on registered customers (excluding 'GUEST').
    """
    # Filter valid registered customers
    valid_tx = df_transactions[
        (df_transactions["CustomerID_Clean"] != "GUEST")
        & (~df_transactions["IsCancelled"])
        & (df_transactions["TotalPriceGBP"] > 0)
    ].copy()

    if valid_tx.empty:
        raise ValueError("Customer analytics needs at least one identified purchaser.")
    valid_tx["InvoiceDate"] = pd.to_datetime(valid_tx["InvoiceDate"])
    if reference_date is None:
        # Reference date is 1 day after the latest transaction
        reference_date = valid_tx["InvoiceDate"].max() + pd.Timedelta(days=1)

    print(f"Building RFM metrics using reference date: {reference_date.strftime('%Y-%m-%d')}")

    # Aggregations per customer
    rfm = (
        valid_tx.groupby("CustomerID_Clean")
        .agg(
            RecencyDays=("InvoiceDate", lambda d: (reference_date - d.max()).days),
            Frequency=("InvoiceNo", "nunique"),
            MonetaryGBP=("TotalPriceGBP", "sum"),
            TotalItems=("Quantity", "sum"),
            FirstPurchase=("InvoiceDate", "min"),
            LastPurchase=("InvoiceDate", "max"),
            Country=("Country", "first"),
        )
        .reset_index()
    )

    rfm.rename(columns={"CustomerID_Clean": "CustomerID"}, inplace=True)

    # Customer Tenure in days
    rfm["TenureDays"] = (reference_date - rfm["FirstPurchase"]).dt.days
    # Average Order Value (AOV)
    rfm["AverageOrderValueGBP"] = np.round(rfm["MonetaryGBP"] / rfm["Frequency"], 2)
    # Average Items Per Order
    rfm["AverageItemsPerOrder"] = np.round(rfm["TotalItems"] / rfm["Frequency"], 2)

    # Calculate Return / Cancellation Metrics per customer
    cancelled_tx = df_transactions[
        (df_transactions["CustomerID_Clean"] != "GUEST") & (df_transactions["IsCancelled"])
    ]
    cancel_counts = cancelled_tx.groupby("CustomerID_Clean")["InvoiceNo"].nunique().to_dict()
    rfm["CancellationCount"] = rfm["CustomerID"].map(cancel_counts).fillna(0).astype(int)
    rfm["CancellationRate"] = np.round(
        rfm["CancellationCount"] / (rfm["Frequency"] + rfm["CancellationCount"]), 3
    )

    # Outlier Detection via IQR Rule (Lab 8 & Lab 2 alignment)
    def compute_iqr_bounds(series: pd.Series):
        q1 = series.quantile(0.25)
        q3 = series.quantile(0.75)
        iqr = q3 - q1
        lower = q1 - 1.5 * iqr
        upper = q3 + 1.5 * iqr
        return q1, q3, iqr, lower, upper

    m_q1, m_q3, m_iqr, m_low, m_high = compute_iqr_bounds(rfm["MonetaryGBP"])
    f_q1, f_q3, f_iqr, f_low, f_high = compute_iqr_bounds(rfm["Frequency"])

    rfm["IsMonetaryOutlier"] = (rfm["MonetaryGBP"] > m_high) | (rfm["MonetaryGBP"] < m_low)
    rfm["IsFrequencyOutlier"] = (rfm["Frequency"] > f_high) | (rfm["Frequency"] < f_low)

    outlier_stats = {
        "Monetary": {
            "Q1": m_q1,
            "Q3": m_q3,
            "IQR": m_iqr,
            "UpperLimit": m_high,
            "OutlierCount": int(rfm["IsMonetaryOutlier"].sum()),
        },
        "Frequency": {
            "Q1": f_q1,
            "Q3": f_q3,
            "IQR": f_iqr,
            "UpperLimit": f_high,
            "OutlierCount": int(rfm["IsFrequencyOutlier"].sum()),
        },
    }

    # RFM Scoring (1 to 4 quartiles)
    rfm["R_Score"] = np.ceil((1 - rfm["RecencyDays"].rank(pct=True, method="average")) * 3 + 1).astype(int)
    rfm["F_Score"] = np.ceil(rfm["Frequency"].rank(pct=True, method="average") * 4).clip(1, 4).astype(int)
    rfm["M_Score"] = np.ceil(rfm["MonetaryGBP"].rank(pct=True, method="average") * 4).clip(1, 4).astype(int)
    rfm["RFM_Combined"] = rfm["R_Score"].astype(str) + rfm["F_Score"].astype(str) + rfm["M_Score"].astype(str)
    rfm["RFM_ScoreSum"] = rfm["R_Score"] + rfm["F_Score"] + rfm["M_Score"]

    # Customer Segmentation
    def assign_segment(row):
        r = row["R_Score"]
        f = row["F_Score"]
        if r >= 4 and f >= 4:
            return "Champions"
        elif r >= 3 and f >= 3:
            return "Loyal Customers"
        elif r >= 3 and f < 3:
            return "Potential Loyalists"
        elif r == 2 and f >= 2:
            return "Need Attention"
        elif r == 1 and f >= 3:
            return "At Risk"
        else:
            return "Hibernating"

    rfm["CustomerSegment"] = rfm.apply(assign_segment, axis=1)

    # Feature Scaling (Lab 3 alignment)
    features_to_scale = ["RecencyDays", "Frequency", "MonetaryGBP", "TenureDays", "AverageOrderValueGBP"]
    scaler_std = StandardScaler()
    scaler_minmax = MinMaxScaler()

    for col in features_to_scale:
        rfm[f"{col}_Standardized"] = np.round(scaler_std.fit_transform(rfm[[col]]), 4)
        rfm[f"{col}_Normalized"] = np.round(scaler_minmax.fit_transform(rfm[[col]]), 4)

    # Binary High-Value Customer Target for Classification
    rfm["IsHighValueCustomer"] = (rfm["MonetaryGBP"] >= m_q3).astype(int)

    return rfm, outlier_stats


def run_feature_engineering(project_dir: str) -> pd.DataFrame:
    parquet_path = os.path.join(project_dir, "data", "processed", "cleaned_transactions.parquet")
    if not os.path.exists(parquet_path):
        raise FileNotFoundError(f"Cleaned transactions parquet not found at {parquet_path}. Run ETL first.")

    df_tx = pd.read_parquet(parquet_path)
    rfm, stats = build_rfm_features(df_tx)

    output_csv = os.path.join(project_dir, "data", "processed", "rfm_customers.csv")
    rfm.to_csv(output_csv, index=False)
    print(f" Saved RFM features for {len(rfm):,} customers to {output_csv}")
    print(
        f" Outliers detected: {stats['Monetary']['OutlierCount']} Monetary (> \u00a3{stats['Monetary']['UpperLimit']:,.2f}), "
        f"{stats['Frequency']['OutlierCount']} Frequency (> {stats['Frequency']['UpperLimit']:.1f} orders)"
    )
    return rfm


if __name__ == "__main__":
    project_root = str(__import__("pathlib").Path(__file__).resolve().parents[1])
    run_feature_engineering(project_root)
