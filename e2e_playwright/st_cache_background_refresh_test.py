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
from e2e_playwright.shared.app_utils import get_element_by_key

# The cached functions in the app use a 2 second ttl.
_TTL_MS = 2000


def test_background_refresh_serves_stale_then_refreshes(app: Page) -> None:
    """An expired entry serves the stale value immediately, then refreshes in the
    background, for both st.cache_data and st.cache_resource.
    """
    data_value = get_element_by_key(app, "data_value")
    resource_value = get_element_by_key(app, "resource_value")

    # Initial computation.
    expect(data_value).to_have_text("data-v1")
    expect(resource_value).to_have_text("resource-v1")

    # Let the ttl elapse so the entries become stale.
    app.wait_for_timeout(_TTL_MS + 500)

    # The next rerun returns the stale value immediately. If the refresh ran in the
    # foreground instead, the value would already be "v2" here.
    rerun_app(app)
    expect(data_value).to_have_text("data-v1")
    expect(resource_value).to_have_text("resource-v1")

    # The background refresh recomputes the values; once it completes, a subsequent
    # rerun shows a refreshed (advanced) value. We assert the value moves past v1
    # rather than to an exact version to avoid flakiness if the ttl re-expires
    # during the rerun loop on slow machines.
    def _refreshed() -> bool:
        rerun_app(app)
        return (
            get_element_by_key(app, "data_value").inner_text().strip() != "data-v1"
            and get_element_by_key(app, "resource_value").inner_text().strip()
            != "resource-v1"
        )

    wait_until(app, _refreshed)

    # No exceptions should be shown during the whole flow.
    expect(app.get_by_test_id("stException")).not_to_be_attached()
