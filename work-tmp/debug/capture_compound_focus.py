"""Focused screenshot of the compound-chart sections (J/K) at a narrow width."""

from __future__ import annotations

import os

from playwright.sync_api import sync_playwright

from e2e_playwright.conftest import wait_for_app_loaded


def main() -> None:
    app_url = os.environ.get("STREAMLIT_APP_URL", "http://localhost:3005")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 900, "height": 1000})
        page.goto(app_url)
        wait_for_app_loaded(page)
        page.wait_for_timeout(2500)

        heading = page.get_by_role(
            "heading",
            name="J. Compound charts at DEFAULT width (no width/use_container_width)",
        )
        heading.scroll_into_view_if_needed()
        page.wait_for_timeout(800)
        page.screenshot(path="work-tmp/debug/overflow_compound_focus_900px.png")
        print("Saved work-tmp/debug/overflow_compound_focus_900px.png")
        browser.close()


if __name__ == "__main__":
    main()
