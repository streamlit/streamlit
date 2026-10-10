"""Print the answer key for the probe app's questions.

Run with `uv run python expected_answers.py` from this directory.
"""

# A command-line report, and this folder is not a package.
# ruff: noqa: INP001, T201

from __future__ import annotations

import probe_data


def main() -> None:
    orders = probe_data.sales_table()
    orders["revenue"] = orders["units"] * orders["unit_price"]
    by_region = orders.groupby("region")["revenue"].sum().round(2)
    series = probe_data.chart_series()
    peak = series.loc[series["value"].idxmax()]

    print(f"rows: {len(orders)}")
    print(f"revenue by region: {by_region.to_dict()}")
    print(f"top region: {by_region.idxmax()}")
    print(
        f"delta orders with units >= 45: {((orders.region == 'delta') & (orders.units >= 45)).sum()}"
    )
    print(f"order 31337: {orders.loc[orders.order_id == 31337].to_dict('records')[0]}")
    print(f"chart peak: {peak['day'].date()} at {peak['value']}")
    print(f"pdf code: {probe_data.PDF_CODE}")
    print("image: left half red, right half blue")
    for kb in (16, 256, 1024, 2048, 2560, 3072, 3584, 4096):
        lines = probe_data.payload_text(kb).splitlines()
        count = len(lines) - 1
        checks = {
            n: probe_data.line_token(n)
            for n in (1, count // 4, count // 2, (3 * count) // 4, count)
        }
        print(f"payload {kb}KB: {lines[-1]}; line tokens {checks}")


if __name__ == "__main__":
    main()
