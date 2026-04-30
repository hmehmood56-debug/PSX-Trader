from pathlib import Path

import psxdata


TICKERS = [
    "MEBL",
    "FFC",
    "MCB",
    "ENGROH",
    "SYS",
    "NESTLE",
    "COLG",
    "PAKT",
    "BWCL",
    "EFERT",
    "HUBC",
    "BAHL",
    "BAFL",
    "NBP",
    "ABL",
    "ILP",
    "ATRL",
    "POL",
    "PTC",
    "DGKC",
]

START_DATE = "2021-04-24"
END_DATE = "2026-04-24"

# If ENGROH fails, try ENGRO instead.


def main() -> None:
    output_dir = Path(__file__).resolve().parent / "output"
    output_dir.mkdir(parents=True, exist_ok=True)

    for ticker in TICKERS:
        try:
            df = psxdata.stocks(ticker, start=START_DATE, end=END_DATE)

            if df is None or (hasattr(df, "empty") and df.empty):
                raise ValueError("No data returned.")

            if "date" not in df.columns:
                raise KeyError("Expected 'date' column is missing.")

            df = df.sort_values(by="date", ascending=True)

            if "ticker" not in df.columns:
                df["ticker"] = ticker

            if "is_anomaly" in df.columns:
                anomaly_count = int(df["is_anomaly"].fillna(False).astype(bool).sum())
            else:
                anomaly_count = 0

            print(f"Ticker: {ticker}")
            print(f"Row count: {len(df)}")
            print(f"Anomaly row count: {anomaly_count}")

            output_file = output_dir / f"{ticker}_{START_DATE}_to_{END_DATE}.csv"
            df.to_csv(output_file, index=False)
            print(f"Saved CSV: {output_file}")

        except Exception:
            print(f"FAILED: {ticker}")


if __name__ == "__main__":
    main()
