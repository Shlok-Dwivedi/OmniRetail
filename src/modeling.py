"""
OmniRetail - Historical association models for academic comparison
Corresponds to DAV Lab 3 (Correlation Analysis, Feature Normalization & Regression Modeling).

Tasks:
1. Pearson and Spearman Correlation Analysis.
2. Linear and Ridge fits explaining observed spend (not forward CLV forecasts).
3. Logistic association model for observed high-value status.
4. Comprehensive Model Performance Evaluation (R^2, RMSE, MAE, Classification Report).
"""

import os
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LinearRegression, Ridge, LogisticRegression
from sklearn.metrics import (
    mean_squared_error,
    mean_absolute_error,
    r2_score,
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
)


def compute_correlation_matrices(
    df: pd.DataFrame, numerical_cols: list[str]
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Computes Pearson and Spearman rank correlation matrices.
    """
    pearson_corr = np.round(df[numerical_cols].corr(method="pearson"), 4)
    spearman_corr = np.round(df[numerical_cols].corr(method="spearman"), 4)
    return pearson_corr, spearman_corr


def train_clv_regression(df_rfm: pd.DataFrame, filter_outliers: bool = True) -> dict:
    """
    Explains observed MonetaryGBP. AOV is derived from this same target, so this
    historical exercise must not be interpreted as a future-spend validation.
    The application uses backend.analytics.Analytics.customer_model instead.
    Feature variables: RecencyDays, Frequency, TenureDays, AverageOrderValueGBP
    Target variable: MonetaryGBP
    """
    data = df_rfm.copy()
    if filter_outliers:
        data = data[~data["IsMonetaryOutlier"]].copy()

    features = ["RecencyDays", "Frequency", "TenureDays", "AverageOrderValueGBP"]
    target = "MonetaryGBP"

    X = data[features]
    y = data[target]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.20, random_state=42)

    # 1. Multiple Linear Regression (Lab 3 core algorithm)
    lr = LinearRegression()
    lr.fit(X_train, y_train)
    y_pred_lr = lr.predict(X_test)

    r2_lr = r2_score(y_test, y_pred_lr)
    rmse_lr = np.sqrt(mean_squared_error(y_test, y_pred_lr))
    mae_lr = mean_absolute_error(y_test, y_pred_lr)

    # 2. Regularized Ridge Regression
    ridge = Ridge(alpha=1.0)
    ridge.fit(X_train, y_train)
    y_pred_ridge = ridge.predict(X_test)

    r2_ridge = r2_score(y_test, y_pred_ridge)
    rmse_ridge = np.sqrt(mean_squared_error(y_test, y_pred_ridge))
    mae_ridge = mean_absolute_error(y_test, y_pred_ridge)

    # Feature Importance / Coefficients
    coefficients = pd.DataFrame(
        {
            "Feature": features,
            "LinearRegression_Coefficient": np.round(lr.coef_, 4),
            "Ridge_Coefficient": np.round(ridge.coef_, 4),
        }
    )

    return {
        "LinearRegression": {
            "model": lr,
            "R2": round(float(r2_lr), 4),
            "RMSE": round(float(rmse_lr), 2),
            "MAE": round(float(mae_lr), 2),
            "Intercept": round(float(lr.intercept_), 2),
        },
        "Ridge": {
            "model": ridge,
            "R2": round(float(r2_ridge), 4),
            "RMSE": round(float(rmse_ridge), 2),
            "MAE": round(float(mae_ridge), 2),
        },
        "Coefficients": coefficients,
        "X_test": X_test,
        "y_test": y_test,
        "y_pred_lr": y_pred_lr,
    }


def train_high_value_classifier(df_rfm: pd.DataFrame) -> dict:
    """
    Classifies observed customer status; this is not a future-value model.
    """
    features = ["RecencyDays", "Frequency", "TenureDays", "AverageItemsPerOrder"]
    target = "IsHighValueCustomer"

    X = df_rfm[features]
    y = df_rfm[target]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=42, stratify=y)

    clf = make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000, random_state=42))
    clf.fit(X_train, y_train)
    y_pred = clf.predict(X_test)
    y_prob = clf.predict_proba(X_test)[:, 1]

    return {
        "model": clf,
        "Accuracy": round(float(accuracy_score(y_test, y_pred)), 4),
        "Precision": round(float(precision_score(y_test, y_pred)), 4),
        "Recall": round(float(recall_score(y_test, y_pred)), 4),
        "F1_Score": round(float(f1_score(y_test, y_pred)), 4),
        "ROC_AUC": round(float(roc_auc_score(y_test, y_prob)), 4),
    }


def run_modeling_pipeline(project_dir: str):
    rfm_path = os.path.join(project_dir, "data", "processed", "rfm_customers.csv")
    rfm = pd.read_csv(rfm_path)

    print("--- 1. Correlation Matrix (Lab 3) ---")
    num_cols = ["RecencyDays", "Frequency", "MonetaryGBP", "TenureDays", "AverageOrderValueGBP"]
    p_corr, s_corr = compute_correlation_matrices(rfm, num_cols)
    print("Pearson Correlation:")
    print(p_corr)

    print("\n--- 2. Historical spend association (not a future-value validation) ---")
    reg_results = train_clv_regression(rfm, filter_outliers=True)
    print(
        f"Linear Regression R^2: {reg_results['LinearRegression']['R2']} | RMSE: \u00a3{reg_results['LinearRegression']['RMSE']}"
    )
    print(
        f"Ridge Regression    R^2: {reg_results['Ridge']['R2']} | RMSE: \u00a3{reg_results['Ridge']['RMSE']}"
    )
    print("\nFeature Coefficients:")
    print(reg_results["Coefficients"])

    print("\n--- 3. Observed high-value association (not future classification) ---")
    clf_results = train_high_value_classifier(rfm)
    print(
        f"Accuracy: {clf_results['Accuracy']} | Precision: {clf_results['Precision']} | Recall: {clf_results['Recall']} | F1: {clf_results['F1_Score']}"
    )


if __name__ == "__main__":
    project_root = str(__import__("pathlib").Path(__file__).resolve().parents[1])
    run_modeling_pipeline(project_root)
