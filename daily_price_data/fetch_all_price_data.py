from datetime import datetime
from pathlib import Path

import psxdata


START_DATE = "2021-04-24"
END_DATE = "2026-04-24"
OUTPUT_DIR = Path(__file__).resolve().parent / "output"
LOG_DIR = Path(__file__).resolve().parent / "logs"


def normalize_tickers(raw_tickers) -> list[str]:
    normalized: list[str] = []

    if raw_tickers is None:
        return normalized

    if isinstance(raw_tickers, str):
        raw_tickers = [raw_tickers]

    for item in raw_tickers:
        if isinstance(item, str):
            ticker = item.strip().upper()
        elif isinstance(item, dict):
            # Handle common structures returned by data libraries.
            ticker = str(
                item.get("ticker")
                or item.get("symbol")
                or item.get("code")
                or ""
            ).strip().upper()
        else:
            ticker = str(item).strip().upper()

        if ticker:
            normalized.append(ticker)

    # Deduplicate while preserving order.
    seen = set()
    unique = []
    for ticker in normalized:
        if ticker not in seen:
            seen.add(ticker)
            unique.append(ticker)

    return unique


def get_anomaly_count(df) -> int:
    if "is_anomaly" not in df.columns:
        return 0
    return int(df["is_anomaly"].fillna(False).astype(bool).sum())


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    log_file = LOG_DIR / "fetch_all_price_data_log.csv"

    started_at = datetime.now().isoformat(timespec="seconds")
    print(f"Started at: {started_at}")

    raw_tickers = psxdata.tickers()
    tickers = normalize_tickers(raw_tickers)

    log_rows = []
    saved_count = 0
    skipped_existing_count = 0
    failed_count = 0
    no_data_count = 0

    for ticker in tickers:
        output_file = OUTPUT_DIR / f"{ticker}_{START_DATE}_to_{END_DATE}.csv"
        status = "saved"
        row_count = 0
        anomaly_count = 0
        error_text = ""

        try:
            if output_file.exists():
                status = "skipped_existing"
                skipped_existing_count += 1
            else:
                df = psxdata.stocks(ticker, start=START_DATE, end=END_DATE)

                if df is None or (hasattr(df, "empty") and df.empty):
                    status = "no_data"
                    no_data_count += 1
                else:
                    if "date" not in df.columns:
                        raise KeyError("Expected 'date' column is missing.")

                    df = df.sort_values(by="date", ascending=True)

                    if "ticker" not in df.columns:
                        df["ticker"] = ticker

                    row_count = int(len(df))
                    anomaly_count = get_anomaly_count(df)

                    # Keep all columns, including is_anomaly if present.
                    df.to_csv(output_file, index=False)
                    saved_count += 1

        except Exception as exc:
            status = "failed"
            failed_count += 1
            error_text = f"{type(exc).__name__}: {exc}"

        print(
            f"ticker={ticker}, status={status}, row_count={row_count}, anomaly_count={anomaly_count}"
        )
        log_rows.append(
            {
                "ticker": ticker,
                "status": status,
                "row_count": row_count,
                "anomaly_count": anomaly_count,
                "error": error_text,
                "output_file": str(output_file),
            }
        )

    # Write collection log for auditability and reruns.
    import pandas as pd

    pd.DataFrame(
        log_rows,
        columns=[
            "ticker",
            "status",
            "row_count",
            "anomaly_count",
            "error",
            "output_file",
        ],
    ).to_csv(log_file, index=False)

    print(f"Total tickers: {len(tickers)}")
    print(f"Saved count: {saved_count}")
    print(f"Skipped existing count: {skipped_existing_count}")
    print(f"Failed count: {failed_count}")
    print(f"No data count: {no_data_count}")
    print(f"Log saved: {log_file}")


if __name__ == "__main__":
    main()
