#!/usr/bin/env python3
# Install dependency: pip install psxdata

from datetime import date, timedelta

from psxdata import PSX


def main() -> None:
    symbol = "OGDC"
    end_date = date.today()
    start_date = end_date - timedelta(days=60)

    try:
        client = PSX()

        # Small test window only (last ~60 days), not full history.
        data = client.history(symbol=symbol, start=start_date, end=end_date)

        print(f"Fetched {len(data)} rows for {symbol}")
        print(data.head(5))

        output_file = "OGDC_test.csv"
        data.to_csv(output_file, index=False)
        print(f"Saved test output to {output_file}")

    except Exception as exc:
        print(f"Failed to fetch PSX test data for {symbol}: {exc}")


if __name__ == "__main__":
    main()

