"""
Fetch daily OHLCV price data for one PSX ticker using psxdata.

Manual run command:
uv run python daily_price_data/fetch_daily_price_data.py
If uv is not on PATH yet:
~/.local/bin/uv run python daily_price_data/fetch_daily_price_data.py
"""

from pathlib import Path

import psxdata

# Change TICKER at the top to fetch a different stock.
TICKER = "LUCK"
START_DATE = "2021-04-24"
END_DATE = "2026-04-24"


def main() -> None:
    output_dir = Path(__file__).resolve().parent / "output"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_file = output_dir / f"{TICKER}_{START_DATE}_to_{END_DATE}.csv"

    try:
        # Fetch OHLCV daily data for one ticker and date range.
        df = psxdata.stocks(TICKER, start=START_DATE, end=END_DATE)

        if df is None:
            raise ValueError("psxdata.stocks returned None.")

        if hasattr(df, "empty") and df.empty:
            raise ValueError(
                f"No data returned for ticker={TICKER} between {START_DATE} and {END_DATE}."
            )

        # Sort rows by date ascending while preserving all columns, including is_anomaly.
        if "date" not in df.columns:
            raise KeyError("Expected 'date' column is missing from fetched data.")
        df = df.sort_values(by="date", ascending=True)

        if "ticker" not in df.columns:
            df["ticker"] = TICKER

        min_date = df["date"].min()
        max_date = df["date"].max()

        # Print summary info.
        print(f"Ticker: {TICKER}")
        print(f"Date range: {START_DATE} to {END_DATE}")
        print(f"Row count: {len(df)}")
        print(f"Columns: {list(df.columns)}")
        print(f"Min date: {min_date}")
        print(f"Max date: {max_date}")

        if "is_anomaly" in df.columns:
            anomaly_count = int(df["is_anomaly"].fillna(False).astype(bool).sum())
            print(f"Anomaly row count: {anomaly_count}")
        else:
            print("Anomaly row count: 0 (is_anomaly column not present)")

        df.to_csv(output_file, index=False)
        print(f"Saved CSV: {output_file}")

    except Exception as exc:
        print("Failed to fetch/save daily price data.")
        print(f"Error type: {type(exc).__name__}")
        print(f"Error details: {exc}")
        raise


if __name__ == "__main__":
    main()
