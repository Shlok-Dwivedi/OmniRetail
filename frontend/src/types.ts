export interface Audit {
  raw_rows: number;
  clean_rows: number;
  invalid_rows: number;
  administrative_rows: number;
  duplicate_rows: number;
  guest_rows: number;
  return_rows: number;
  start: string;
  end: string;
}
export interface Currency {
  base: string;
  rates: Record<string, number>;
  date: string | null;
  source: string;
  status: string;
}
export interface Meta {
  name: string;
  version: string;
  audit: Audit;
  countries: string[];
  currency: Currency;
}
export interface Overview {
  revenue: number;
  refunds: number;
  net_revenue: number;
  orders: number;
  customers: number;
  aov: number;
  units: number;
  change: number | null;
  rows: number;
  daily: { date: string; revenue: number; orders: number; average: number }[];
  markets: { country: string; revenue: number; orders: number }[];
  products: { code: string; name: string; revenue: number; units: number; orders: number }[];
}
export interface Customer {
  CustomerID: string;
  Country: string;
  RecencyDays: number;
  Frequency: number;
  MonetaryGBP: number;
  AverageOrderValueGBP: number;
  CustomerSegment: string;
  CancellationRate: number;
}
export interface CustomerSummary {
  total: number;
  segments: { segment: string; count: number; revenue: number }[];
  scatter: Customer[];
  histogram: { value: number; count: number }[];
  boxes: { country: string; min: number; q1: number; median: number; q3: number; max: number }[];
  correlations: Record<string, Record<string, string | number | null>[]>;
  outliers: number;
}
export interface Forecast {
  history: { date: string; RevenueGBP: number; SMA_7: number; SMA_30: number; EMA_14: number }[];
  forecast: {
    date: string;
    PredictedRevenueGBP: number;
    LowerBoundGBP: number;
    UpperBoundGBP: number;
  }[];
  decomposition: {
    date: string;
    trend: number | null;
    seasonal: number;
    resid: number | null;
    observed: number;
  }[];
  stationarity: { p_value: number | null; Is_Stationary: boolean | null };
  rmse: number;
  mape: number | null;
  baseline_rmse: number;
  aic: number;
  total: number;
  horizon: number;
  warnings: string[];
}
export interface Models {
  models: Record<string, { r2: number; rmse: number; mae: number }>;
  selected: string;
  baseline_mae: number;
  classifier_auc: number | null;
  train_customers: number;
  test_customers: number;
  cutoff: string;
  horizon: number;
  high_value_threshold: number;
  limitations: string;
}
export interface Prediction {
  estimate: number;
  lower: number;
  upper: number;
  high_value_probability: number | null;
  horizon: number;
}
