"""Playwright verification for GitHub Issue #15618."""

import os
import sys
import time

from playwright.sync_api import expect, sync_playwright

from e2e_playwright.conftest import wait_for_app_loaded, wait_for_app_run
from e2e_playwright.shared.app_utils import get_selectbox


def main() -> int:
    app_url = os.environ.get("STREAMLIT_APP_URL", "http://localhost:3001")
    screenshot_path = "work-tmp/debug/repro_gh_15618.png"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 720})

        page.goto(app_url)
        wait_for_app_loaded(page)

        page.screenshot(
            path="work-tmp/debug/repro_gh_15618_initial.png", full_page=True
        )

        selectbox = get_selectbox(page, "selectbox")
        selectbox_input = selectbox.locator("input")
        selectbox_input.click()
        selectbox_input.press("ArrowDown")
        dropdown = page.get_by_test_id("stSelectboxVirtualDropdown")
        expect(dropdown).to_be_visible()
        time.sleep(0.5)

        dropdown.get_by_role("option", name="two", exact=True).click()
        wait_for_app_run(page)
        time.sleep(0.5)

        page.screenshot(path=screenshot_path, full_page=True)
        print(f"Screenshot saved: {screenshot_path}")

        selected_text = page.get_by_text("Selected: two")
        if selected_text.count() > 0:
            print("No bug detected - 'two' was selected successfully")
            browser.close()
            return 0
        reverted_text = page.get_by_text("Selected: one")
        if reverted_text.count() > 0:
            print("BUG CONFIRMED: selectbox reverted to 'one' after selecting 'two'")
            browser.close()
            return 1
        print("INCONCLUSIVE: unexpected state")
        browser.close()
        return 2


if __name__ == "__main__":
    sys.exit(main())
