"""
OmniRetail - Visualization Toolkit & Chart Generator Module
Corresponds to DAV Lab 7 (Line & Scatter Plots, Trends & Annotations)
and DAV Lab 8 (Categorical Distributions, Boxplots, IQR Outliers & Multi-Tool Comparison).

Provides:
- Publication-grade Matplotlib / Seaborn figures.
- High-contrast interactive Plotly charts.
- Objective multi-tool comparison matrix (Matplotlib vs Plotly vs Excel).
"""

import os
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import plotly.graph_objects as go
import plotly.express as px

# Set consistent plotting styling
plt.style.use("seaborn-v0_8-whitegrid" if "seaborn-v0_8-whitegrid" in plt.style.available else "default")
plt.rcParams["font.sans-serif"] = ["DejaVu Sans", "sans-serif"]
plt.rcParams["figure.dpi"] = 150


def generate_static_charts(
    df_transactions: pd.DataFrame, df_rfm: pd.DataFrame, daily_df: pd.DataFrame, output_dir: str
):
    """
    Renders and exports static publication-grade visualizations for reports and lab submissions.
    """
    os.makedirs(output_dir, exist_ok=True)

    # 1. Lab 7: Time Series Line Plot with Moving Averages and Annotations
    fig, ax = plt.subplots(figsize=(12, 5))
    ax.plot(
        daily_df.index,
        daily_df["RevenueGBP"],
        label="Daily Revenue (\u00a3)",
        color="#94a3b8",
        alpha=0.45,
        linewidth=1,
    )
    ax.plot(daily_df.index, daily_df["SMA_7"], label="7-Day Moving Average", color="#0284c7", linewidth=2)
    ax.plot(
        daily_df.index,
        daily_df["SMA_30"],
        label="30-Day Moving Average",
        color="#e11d48",
        linewidth=2.5,
        linestyle="--",
    )

    # Peak annotation
    peak_date = daily_df["RevenueGBP"].idxmax()
    peak_val = daily_df["RevenueGBP"].max()
    ax.annotate(
        f"Peak observed revenue\n(\u00a3{peak_val:,.0f})",
        xy=(peak_date, peak_val),
        xytext=(peak_date - pd.Timedelta(days=60), peak_val * 0.85),
        arrowprops=dict(facecolor="#0f172a", shrink=0.08, width=1.5, headwidth=6),
        fontsize=9,
        fontweight="bold",
        bbox=dict(boxstyle="round,pad=0.3", fc="#f8fafc", ec="#cbd5e1"),
    )

    ax.set_title(
        "OmniRetail Daily Sales Trend & Moving Average Smoothing (Lab 7)",
        fontsize=13,
        fontweight="bold",
        pad=12,
    )
    ax.set_xlabel("Invoice Date", fontsize=10)
    ax.set_ylabel("Revenue (\u00a3)", fontsize=10)
    ax.legend(frameon=True, loc="upper left")
    plt.tight_layout()
    chart1_path = os.path.join(output_dir, "lab7_timeseries_moving_averages.png")
    plt.savefig(chart1_path)
    plt.close()

    if df_rfm.empty:
        return [chart1_path]

    # 2. Lab 7: Scatter Plot with Variable Size/Color & Regression Trendline
    # Filter monetary outliers for clean visual scaling
    clean_rfm = df_rfm[~df_rfm["IsMonetaryOutlier"]].copy()
    if clean_rfm.empty:
        clean_rfm = df_rfm.copy()
    fig, ax = plt.subplots(figsize=(10, 6))

    sns.scatterplot(
        data=clean_rfm,
        x="Frequency",
        y="MonetaryGBP",
        hue="CustomerSegment",
        size="AverageOrderValueGBP",
        sizes=(30, 300),
        alpha=0.75,
        palette="tab10",
        ax=ax,
    )
    # Regression trendline
    sns.regplot(
        data=clean_rfm,
        x="Frequency",
        y="MonetaryGBP",
        scatter=False,
        ax=ax,
        color="#0f172a",
        line_kws={"linestyle": "--", "linewidth": 1.8, "label": "Linear Fit Trendline"},
    )

    ax.set_title(
        "Customer Frequency vs. Monetary Value with Segment Hue & AOV Size (Lab 7)",
        fontsize=12,
        fontweight="bold",
        pad=12,
    )
    ax.set_xlabel("Order Frequency (Number of Invoices)", fontsize=10)
    ax.set_ylabel("Total Spend (\u00a3)", fontsize=10)
    ax.legend(bbox_to_anchor=(1.02, 1), loc="upper left", frameon=True)
    plt.tight_layout()
    chart2_path = os.path.join(output_dir, "lab7_scatter_regression_segments.png")
    plt.savefig(chart2_path)
    plt.close()

    # 3. Lab 8: Histograms with KDE and Boxplots with IQR Outlier Detection
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))

    # Left: Histogram of Average Order Value
    sns.histplot(clean_rfm["AverageOrderValueGBP"], kde=True, ax=axes[0], color="#0284c7", bins=35)
    axes[0].set_title("Distribution of Customer Average Order Value (Lab 8)", fontsize=11, fontweight="bold")
    axes[0].set_xlabel("Average Order Value (\u00a3)")
    axes[0].set_ylabel("Customer Count")

    # Right: Box-and-Whisker Plot for Monetary Value across Top 6 Countries
    top_countries = clean_rfm["Country"].value_counts().head(6).index
    country_rfm = clean_rfm[clean_rfm["Country"].isin(top_countries)]

    sns.boxplot(
        data=country_rfm,
        x="Country",
        y="MonetaryGBP",
        hue="Country",
        legend=False,
        ax=axes[1],
        palette="Set2",
    )
    axes[1].set_title(
        "Box-and-Whisker Plots & Outlier Analysis by Country (Lab 8)", fontsize=11, fontweight="bold"
    )
    axes[1].set_xlabel("Country")
    axes[1].set_ylabel("Total Monetary Spend (\u00a3)")
    plt.xticks(rotation=25)

    plt.tight_layout()
    chart3_path = os.path.join(output_dir, "lab8_distribution_boxplots.png")
    plt.savefig(chart3_path)
    plt.close()

    print(f"Generated and saved all static charts to {output_dir}")
    return [chart1_path, chart2_path, chart3_path]


def create_interactive_donut(df_transactions: pd.DataFrame) -> go.Figure:
    """
    Renders an interactive Plotly Donut Chart of Country Revenue (Lab 8 alignment).
    """
    valid_tx = df_transactions[~df_transactions["IsCancelled"]]
    country_rev = valid_tx.groupby("Country")["TotalPriceGBP"].sum().reset_index()
    top_8 = country_rev.sort_values("TotalPriceGBP", ascending=False).head(8)
    other_val = country_rev.sort_values("TotalPriceGBP", ascending=False).iloc[8:]["TotalPriceGBP"].sum()

    chart_data = pd.concat(
        [top_8, pd.DataFrame([{"Country": "Other Countries", "TotalPriceGBP": other_val}])], ignore_index=True
    )

    fig = go.Figure(
        data=[
            go.Pie(
                labels=chart_data["Country"],
                values=chart_data["TotalPriceGBP"],
                hole=0.45,
                hoverinfo="label+percent+value",
                textinfo="label+percent",
                marker=dict(colors=px.colors.qualitative.Prism),
            )
        ]
    )
    fig.update_layout(
        title="<b>Geographic Revenue Contribution (Plotly Donut Chart - Lab 8)</b>",
        margin=dict(t=50, b=20, l=20, r=20),
        legend=dict(orientation="h", yanchor="bottom", y=-0.2, xanchor="center", x=0.5),
    )
    return fig


def create_interactive_forecast_chart(daily_df: pd.DataFrame, forecast_df: pd.DataFrame) -> go.Figure:
    """
    Renders an interactive Plotly chart combining historical revenue with the 30-day ARIMA forecast.
    """
    recent_history = daily_df.tail(90)

    fig = go.Figure()
    # Historical observations
    fig.add_trace(
        go.Scatter(
            x=recent_history.index,
            y=recent_history["RevenueGBP"],
            mode="lines",
            name="Actual Daily Revenue",
            line=dict(color="#64748b", width=1.5),
        )
    )
    # 7-day smoothing
    fig.add_trace(
        go.Scatter(
            x=recent_history.index,
            y=recent_history["SMA_7"],
            mode="lines",
            name="7-Day Moving Average",
            line=dict(color="#0284c7", width=2.5),
        )
    )
    # Forecast mean
    fig.add_trace(
        go.Scatter(
            x=forecast_df.index,
            y=forecast_df["PredictedRevenueGBP"],
            mode="lines+markers",
            name="ARIMA 30-Day Forecast",
            line=dict(color="#16a34a", width=2.5, dash="dash"),
        )
    )
    # Upper Bound
    fig.add_trace(
        go.Scatter(
            x=forecast_df.index,
            y=forecast_df["UpperBoundGBP"],
            mode="lines",
            name="Upper 95% CI",
            line=dict(color="rgba(22, 163, 74, 0.2)", width=0),
            showlegend=False,
        )
    )
    # Lower Bound with fill
    fig.add_trace(
        go.Scatter(
            x=forecast_df.index,
            y=forecast_df["LowerBoundGBP"],
            mode="lines",
            name="95% Confidence Interval",
            line=dict(color="rgba(22, 163, 74, 0.2)", width=0),
            fill="tonexty",
            fillcolor="rgba(22, 163, 74, 0.15)",
        )
    )

    fig.update_layout(
        title="<b>OmniRetail ARIMA(1, 1, 1) Forward Revenue Forecast (Lab 6)</b>",
        xaxis_title="Date",
        yaxis_title="Revenue (\u00a3)",
        hovermode="x unified",
        margin=dict(t=50, b=30, l=40, r=30),
    )
    return fig


def get_tool_comparison_matrix() -> pd.DataFrame:
    """
    Returns an objective evaluation matrix comparing Matplotlib, Plotly, and Excel (Lab 8 assignment).
    """
    matrix = [
        {
            "Criterion": "Interactive Features",
            "Matplotlib & Seaborn": "Static raster/vector output; requires interactive backend/widgets for basic hover.",
            "Plotly (Python)": "Native zoom, pan, hover tooltips, trace toggling, and export tools built-in.",
            "Microsoft Excel": "Interactive slicers, timeline filters, and pivot chart drill-downs.",
        },
        {
            "Criterion": "Aesthetic & Visual Appeal",
            "Matplotlib & Seaborn": "High academic publication quality; full control over styling and figure layout.",
            "Plotly (Python)": "Modern, sleek, and responsive web styling with built-in responsive themes.",
            "Microsoft Excel": "Standard corporate styles; quick formatting but limited bespoke customization.",
        },
        {
            "Criterion": "Data Volume & Scaling",
            "Matplotlib & Seaborn": "Easily renders 500k+ points efficiently via aggregation or hexbins.",
            "Plotly (Python)": "Can lag if rendering >100k raw SVG points; requires WebGL (Scattergl) for large sets.",
            "Microsoft Excel": "Row limit of 1,048,576 rows; large workbooks can experience performance lag.",
        },
        {
            "Criterion": "Automation & Pipeline Integration",
            "Matplotlib & Seaborn": "100% programmatic; seamlessly integrates into batch ETL, CI/CD, and PDF pipelines.",
            "Plotly (Python)": "Easily embedded in web dashboards (Streamlit, Dash) and HTML outputs.",
            "Microsoft Excel": "Requires COM/openpyxl automation or manual human configuration.",
        },
        {
            "Criterion": "Ease of Initial Setup",
            "Matplotlib & Seaborn": "Moderate; requires understanding object-oriented figure and axis APIs.",
            "Plotly (Python)": "Very easy with Plotly Express (`px`); intuitive one-liners for complex charts.",
            "Microsoft Excel": "Instant drag-and-drop interface accessible to non-programmers.",
        },
    ]
    return pd.DataFrame(matrix)
