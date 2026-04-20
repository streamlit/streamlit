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

"""E2E tests for st.App secrets parameter.

Tests verify that programmatic secrets passed to st.App are available
via st.secrets within the running Streamlit script.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from playwright.sync_api import expect

if TYPE_CHECKING:
    from playwright.sync_api import Page


def test_app_secrets_scenario(app: Page) -> None:
    """Test that programmatic secrets are accessible in the Streamlit script.

    This aggregated scenario test verifies:
    - Programmatic secrets from st.App are available via st.secrets
    - Nested secrets are accessible
    - Top-level secrets are promoted to os.environ
    - Attribute access works for nested secrets
    """
    # Verify the app title renders
    expect(app.get_by_text("st.App Secrets Test")).to_be_visible()

    # Verify programmatic secrets are available via st.secrets
    expect(app.get_by_text("API Key: test-api-key-12345")).to_be_visible()
    expect(app.get_by_text("Database Host: localhost")).to_be_visible()
    expect(app.get_by_text("Database Port: 5432")).to_be_visible()

    # Verify top-level secrets are promoted to os.environ
    expect(app.get_by_text("API Key from environ: test-api-key-12345")).to_be_visible()

    # Verify nested secrets via attribute access
    expect(app.get_by_text("Auth Client ID: my-client-id")).to_be_visible()

    # Negative assertion: no exception should be displayed
    expect(app.get_by_test_id("stException")).to_have_count(0)
