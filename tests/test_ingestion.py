from io import BytesIO
import json

import numpy as np
import pandas as pd
import pytest

from backend.ingestion import clean_transactions, read_source
from backend.reports import spreadsheet_safe
from src.feature_engineering import build_rfm_features


def test_cleaning_refunds_guests_duplicates_and_invalids(raw_transactions):
    sample = raw_transactions.head(3).copy()
    refund = sample.iloc[[0]].assign(InvoiceNo="C100", Quantity=2)
    guest = sample.iloc[[0]].assign(InvoiceNo="G100", CustomerID=np.nan)
    bad = sample.iloc[[0]].assign(InvoiceNo="B100", UnitPrice=-1)
    admin = sample.iloc[[0]].assign(InvoiceNo="A100", StockCode="POST")
    df, audit = clean_transactions(pd.concat([sample, sample.iloc[[0]], refund, guest, bad, admin]))
    assert audit["raw_rows"] == 8
    assert audit["duplicate_rows"] == audit["administrative_rows"] == audit["invalid_rows"] == 1
    assert audit["clean_rows"] == 5
    assert df.loc[df.InvoiceNo.eq("C100"), "TotalPriceGBP"].iloc[0] < 0
    assert df.loc[df.InvoiceNo.eq("G100"), "CustomerID_Clean"].iloc[0] == "GUEST"
    assert df.TotalPriceGBP.sum() == pytest.approx((df.Quantity * df.UnitPrice).sum())


@pytest.mark.parametrize("extension", ["csv", "txt", "xlsx", "json", "xml"])
def test_supported_formats(raw_transactions, extension):
    sample = raw_transactions.head(8)
    if extension in {"csv", "txt"}:
        content = sample.to_csv(index=False).encode()
    elif extension == "xlsx":
        output = BytesIO()
        sample.to_excel(output, index=False)
        content = output.getvalue()
    elif extension == "json":
        content = sample.to_json(orient="records", date_format="iso").encode()
    else:
        import xml.etree.ElementTree as ET

        root = ET.Element("transactions")
        for row in sample.to_dict("records"):
            child = ET.SubElement(root, "transaction")
            for key, value in row.items():
                ET.SubElement(child, key).text = str(value)
        content = ET.tostring(root)
    frame, audit = clean_transactions(read_source(content, f"sales.{extension}"))
    assert len(frame) == 8
    assert audit["invalid_rows"] == 0


def test_rejects_missing_columns_empty_and_nonfinite(raw_transactions):
    with pytest.raises(ValueError, match="Missing columns"):
        clean_transactions(raw_transactions.drop(columns="InvoiceNo"))
    with pytest.raises(ValueError, match="No valid"):
        clean_transactions(raw_transactions.assign(UnitPrice=np.inf))
    with pytest.raises(ValueError):
        read_source(json.dumps({"wrong": []}).encode(), "sales.json")


def test_xml_entities_are_not_expanded():
    with pytest.raises(Exception):
        read_source(
            b'<!DOCTYPE x [<!ENTITY a SYSTEM "file:///etc/passwd">]><x><row><Country>&a;</Country></row></x>',
            "sales.xml",
        )


def test_rfm_tied_small_groups(raw_transactions):
    df, _ = clean_transactions(raw_transactions.head(1))
    rfm, _ = build_rfm_features(df)
    assert len(rfm) == 1
    assert rfm.RecencyDays.iloc[0] >= 0
    assert rfm.R_Score.between(1, 4).all()


def test_spreadsheet_formula_safety():
    frame = spreadsheet_safe(
        pd.DataFrame({"Description": ["=1+1", " @SUM(A1)", "Ordinary mug"], "Quantity": [1, 2, 3]})
    )
    assert frame.Description.tolist() == ["'=1+1", "' @SUM(A1)", "Ordinary mug"]
    assert frame.Quantity.tolist() == [1, 2, 3]


def test_corrupted_exchange_cache_falls_back_to_original_currency(tmp_path):
    from backend.currency import CurrencyService

    (tmp_path / "exchange-rates.json").write_text("{invalid")
    assert CurrencyService(tmp_path).snapshot["rates"] == {"GBP": 1.0}
