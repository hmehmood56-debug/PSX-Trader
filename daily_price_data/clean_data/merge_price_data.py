from pathlib import Path

import pandas as pd


# Re-run this script after adding more ticker files to update master dataset.

REQUIRED_COLUMNS = ["date", "open", "high", "low", "close", "volume"]


def main() -> None:
    script_dir = Path(__file__).resolve().parent
    input_dir = script_dir.parent / "output"
    output_dir = script_dir
    output_dir.mkdir(parents=True, exist_ok=True)
    output_file = output_dir / "prices_master.csv"

    all_frames = []

    for csv_file in sorted(input_dir.glob("*.csv")):
        try:
            df = pd.read_csv(csv_file)

            missing_required = [col for col in REQUIRED_COLUMNS if col not in df.columns]
            if missing_required:
                raise ValueError(
                    f"Missing required columns {missing_required} in {csv_file.name}"
                )

            if "ticker" not in df.columns:
                ticker_from_name = csv_file.stem.split("_", 1)[0]
                df["ticker"] = ticker_from_name

            df["date"] = pd.to_datetime(df["date"], errors="coerce").dt.strftime("%Y-%m-%d")
            df = df.dropna(subset=["date"]).sort_values("date", ascending=True)

            ordered_columns = ["date", "ticker", "open", "high", "low", "close", "volume"]
            if "is_anomaly" in df.columns:
                ordered_columns.append("is_anomaly")

            df = df[ordered_columns]
            all_frames.append(df)

        except Exception as exc:
            print(f"FAILED: {csv_file.name} ({exc})")

    if not all_frames:
        print("No valid CSV files found to merge.")
        return

    combined = pd.concat(all_frames, ignore_index=True, sort=False)
    final_columns = ["date", "ticker", "open", "high", "low", "close", "volume"]
    if "is_anomaly" in combined.columns:
        final_columns.append("is_anomaly")

    combined = combined[final_columns].sort_values(
        by=["date", "ticker"], ascending=[True, True]
    )
    combined.to_csv(output_file, index=False)

    print(f"Total rows: {len(combined)}")
    print(f"Number of tickers: {combined['ticker'].nunique()}")
    print(f"Date range: {combined['date'].min()} to {combined['date'].max()}")
    print(f"Saved: {output_file}")


if __name__ == "__main__":
    main()
