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

from e2e_playwright.conftest import rerun_app, wait_until

# Comfortably longer than the app's ttl (8s) so the entry is safely inside the stale
# grace window ([ttl, 2*ttl)) when we rerun, with a ~1s margin on a slow/loaded CI
# runner (both before the stale window starts and before hard expiry at 2*ttl).
_STALE_WAIT_MS = 9000


def test_background_refresh_stale_while_revalidate(app: Page):
    """Aggregated scenario covering background stale-while-revalidate.

    Covers:

    - The initial miss renders display output live and shows a one-time warning.
    - A fresh-window hit does not replay the cached display output.
    - A stale-window access serves the old value instantly (no spinner).
    - A background refresh recomputes the value shortly after.
    """
    # Initial run: cache miss. The value is computed and the cached function's display
    # command renders live...
    expect(app.get_by_text("Value: 1")).to_be_visible()
    expect(app.get_by_text("Inside cached function")).to_be_visible()
    # ...and a warning about background-mode display commands is shown.
    expect(app.get_by_test_id("stException")).to_contain_text(
        "CachedStFunctionInBackgroundModeWarning"
    )

    # A rerun within the fresh window is a cache hit: the value is unchanged and the
    # cached display output is NOT replayed (and no new warning appears).
    rerun_app(app)
    expect(app.get_by_text("Value: 1")).to_be_visible()
    expect(app.get_by_text("Inside cached function")).to_have_count(0)
    expect(app.get_by_test_id("stException")).to_have_count(0)

    # Let the entry expire into the stale grace window.
    app.wait_for_timeout(_STALE_WAIT_MS)

    # A rerun in the stale window serves the OLD value immediately (no blocking, so no
    # spinner) and schedules a background refresh.
    rerun_app(app)
    expect(app.get_by_text("Value: 1")).to_be_visible()
    expect(app.get_by_test_id("stSpinner")).to_have_count(0)

    # The background refresh recomputes the value; a subsequent rerun reflects it.
    def _value_refreshed() -> bool:
        rerun_app(app)
        return app.get_by_text("Value: 2").count() > 0

    wait_until(app, _value_refreshed)
    expect(app.get_by_text("Value: 2")).to_be_visible()
    # The refreshed value must not replay the cached display output either.
    expect(app.get_by_text("Inside cached function")).to_have_count(0)
