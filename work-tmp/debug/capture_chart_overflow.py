"""Capture full-page screenshots of the chart overflow repro at several widths.

Usage (with `make debug work-tmp/debug/test_chart_overflow_repro.py` running):
  STREAMLIT_APP_URL=http://localhost:3005 \
  PYTHONPATH=. uv run python work-tmp/debug/capture_chart_overflow.py
"""

from __future__ import annotations

import json
import os

from playwright.sync_api import sync_playwright

from e2e_playwright.conftest import wait_for_app_loaded

OUT_DIR = "work-tmp/debug"

# (label, viewport width in px). Heights are tall so full_page captures everything.
WIDTHS = [
    ("normal", 1440),
    ("narrow", 900),
    ("very_narrow", 600),
]


def detect_overflow(page) -> list[dict]:
    """Return per-chart geometry, flagging charts wider than their parent column."""
    return page.evaluate(
        """() => {
        const results = [];
        // Build an ordered list of section labels (h2/h3) with their Y position.
        const headings = [...document.querySelectorAll('h2, h3')].map((h) => ({
            top: h.getBoundingClientRect().top + window.scrollY,
            text: h.innerText.trim(),
        }));
        const labelFor = (chart) => {
            const y = chart.getBoundingClientRect().top + window.scrollY;
            let label = '';
            for (const h of headings) {
                if (h.top <= y) label = h.text; else break;
            }
            return label;
        };
        const charts = document.querySelectorAll('[data-testid="stVegaLiteChart"]');
        charts.forEach((chart, idx) => {
            // Nearest column or generic block container.
            const col = chart.closest('[data-testid="stColumn"]')
                || chart.closest('[data-testid="stVerticalBlockBorderWrapper"]')
                || chart.parentElement;
            const cRect = chart.getBoundingClientRect();
            const pRect = col.getBoundingClientRect();
            // Overflow past the parent column's right edge.
            const overflowPx = Math.round(cRect.right - pRect.right);
            // Internal overflow: chart content wider than the chart box.
            const innerOverflowPx = Math.round(chart.scrollWidth - chart.clientWidth);
            results.push({
                idx,
                section: labelFor(chart),
                chartWidth: Math.round(cRect.width),
                parentWidth: Math.round(pRect.width),
                overflowPx,
                innerOverflowPx,
                overflows: overflowPx > 1 || innerOverflowPx > 1,
            });
        });
        return results;
    }"""
    )


def main() -> None:
    app_url = os.environ.get("STREAMLIT_APP_URL", "http://localhost:3005")
    summary: dict[str, object] = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for label, width in WIDTHS:
            page = browser.new_page(viewport={"width": width, "height": 2400})
            page.goto(app_url)
            wait_for_app_loaded(page)
            # Let Vega-Lite finish its async render/resize pass.
            page.wait_for_timeout(2500)

            path = f"{OUT_DIR}/overflow_{label}_{width}px.png"
            page.screenshot(path=path, full_page=True)

            charts = detect_overflow(page)
            overflowing = [c for c in charts if c["overflows"]]

            # Group overflow by section header for a readable summary.
            by_section: dict[str, dict] = {}
            for c in charts:
                sec = by_section.setdefault(
                    c["section"], {"n": 0, "n_overflow": 0, "max_overflow_px": 0}
                )
                sec["n"] += 1
                if c["overflows"]:
                    sec["n_overflow"] += 1
                    sec["max_overflow_px"] = max(sec["max_overflow_px"], c["overflowPx"])

            summary[label] = {
                "width": width,
                "n_charts": len(charts),
                "n_overflowing": len(overflowing),
                "worst_overflow_px": max((c["overflowPx"] for c in charts), default=0),
                "sections_with_overflow": {
                    s: v for s, v in by_section.items() if v["n_overflow"] > 0
                },
            }
            print(f"[{label} @ {width}px] charts={len(charts)} "
                  f"overflowing={len(overflowing)} -> {path}")
            page.close()
        browser.close()

    with open(f"{OUT_DIR}/overflow_summary.json", "w") as f:
        json.dump(summary, f, indent=2)
    print("\nSummary:\n" + json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
