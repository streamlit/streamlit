# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.


from playwright.sync_api import Page, expect

from e2e_playwright.conftest import rerun_app, wait_for_app_run, wait_until
from e2e_playwright.shared.app_utils import click_button, get_button

_BACKGROUND_REFRESH_STALE_WAIT_MS = 9000


def test_that_caching_shows_cached_widget_warning(app: Page):
    click_button(app, "Run cached function with widget warning")
    expect(app.get_by_test_id("stException")).to_have_count(1)

    exception_element = app.get_by_test_id("stException").nth(0)
    expect(exception_element).to_contain_text("CachedWidgetWarning: Your script uses")


def test_that_nested_cached_function_shows_cached_widget_warning(app: Page):
    click_button(app, "Run nested cached function with widget warning")
    expect(app.get_by_test_id("stException")).to_have_count(2)

    expect(app.get_by_test_id("stException").nth(0)).to_contain_text(
        "CachedWidgetWarning: Your script uses"
    )
    expect(app.get_by_test_id("stException").nth(1)).to_contain_text(
        "CachedWidgetWarning: Your script uses"
    )


def test_that_replay_element_works_as_expected(app: Page):
    click_button(app, "Cached function with element replay")
    expect(app.get_by_test_id("stException")).to_have_count(0)
    expect(app.get_by_text("Cache executions: 1")).to_be_visible()
    expect(app.get_by_text("Cache return 1")).to_be_visible()

    # Execute again, the values should be the same:
    click_button(app, "Cached function with element replay")
    expect(app.get_by_test_id("stException")).to_have_count(0)
    expect(app.get_by_text("Cache executions: 1")).to_be_visible()
    expect(app.get_by_text("Cache return 1")).to_be_visible()


def test_async_cache_resource_miss_hit_spinner_and_replay(app: Page):
    get_button(app, "Run async cache_resource E2E scenario").click()

    spinner = app.get_by_test_id("stSpinner").filter(
        has_text="Computing async cache_resource value..."
    )
    expect(spinner).to_be_visible()
    wait_for_app_run(app)

    expect(app.get_by_test_id("stSpinner")).to_have_count(0)
    expect(
        app.get_by_text("Inside async cache_resource: 1", exact=True)
    ).to_be_visible()
    expect(
        app.get_by_text("Async cache_resource result: 1", exact=True)
    ).to_be_visible()

    rerun_app(app)

    expect(app.get_by_test_id("stSpinner")).to_have_count(0)
    expect(
        app.get_by_text("Inside async cache_resource: 1", exact=True)
    ).to_be_visible()
    expect(
        app.get_by_text("Async cache_resource result: 1", exact=True)
    ).to_be_visible()
    expect(app.get_by_text("Inside async cache_resource: 2", exact=True)).to_have_count(
        0
    )


def test_background_refresh_stale_while_revalidate(app: Page):
    click_button(app, "Run cache_resource background refresh test")
    wait_for_app_run(app)

    # Initial miss computes the value, renders display output live, and warns that
    # display commands aren't replayed from a background-mode cache.
    expect(app.get_by_text("Background refresh value: 1")).to_be_visible()
    expect(app.get_by_text("Inside background cache_resource function")).to_be_visible()
    expect(app.get_by_test_id("stException")).to_contain_text(
        "CachedStFunctionInBackgroundModeWarning"
    )

    # A fresh hit keeps the value and doesn't replay display output or the warning.
    rerun_app(app)
    expect(app.get_by_text("Background refresh value: 1")).to_be_visible()
    expect(app.get_by_text("Inside background cache_resource function")).to_have_count(
        0
    )
    expect(app.get_by_test_id("stException")).to_have_count(0)

    # Enter the stale grace window ([ttl, 2 * ttl)), then verify that the stale value
    # is served without a spinner while the refresh runs in the background.
    app.wait_for_timeout(_BACKGROUND_REFRESH_STALE_WAIT_MS)
    rerun_app(app)
    expect(app.get_by_text("Background refresh value: 1")).to_be_visible()
    expect(app.get_by_test_id("stSpinner")).to_have_count(0)

    def value_refreshed() -> bool:
        rerun_app(app)
        return app.get_by_text("Background refresh value: 2").count() > 0

    wait_until(app, value_refreshed)
    expect(app.get_by_text("Background refresh value: 2")).to_be_visible()
    expect(app.get_by_text("Inside background cache_resource function")).to_have_count(
        0
    )
