# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_loaded
from e2e_playwright.shared.app_utils import expect_font


def test_theme_from_window_variable(app: Page, assert_snapshot: ImageCompareFunction):
    # Inject custom theme configuration script
    app.add_init_script("""
      window.__streamlit = {
        LIGHT_THEME: {
        base: "light",
        primaryColor: "#1a6ce7",
        secondaryBackgroundColor: "#f7f7f7",
        textColor: "#1e252f",
        borderColor: "#d5dae4",
        showWidgetBorder: true,
        bodyFont: "Inter",
        headingFont: "Inter",
        codeFont: '"Monaspace Argon", Menlo, Monaco, Consolas, "Courier New", monospace',
        baseFontSize: 14,
        fontFaces: [
          {
            family: "Inter",
            url: "./app/static/Inter-Regular.woff2",
            weight: 400,
          },
          {
            family: "Inter",
            url: "./app/static/Inter-SemiBold.woff2",
            weight: 600,
          },
          {
            family: "Inter",
            url: "./app/static/Inter-Bold.woff2",
            weight: 700,
          },
          {
            family: "Inter",
            url: "./app/static/Inter-Black.woff2",
            weight: 900,
          },
          {
            "family": "Monaspace Argon",
            "url": "https://raw.githubusercontent.com/githubnext/monaspace/refs/heads/main/fonts/webfonts/MonaspaceArgon-Regular.woff2",
            "weight": 400,
        },
        {
            "family": "Monaspace Argon",
            "url": "https://raw.githubusercontent.com/githubnext/monaspace/refs/heads/main/fonts/webfonts/MonaspaceArgon-Medium.woff2",
            "weight": 500,
        },
        {
            "family": "Monaspace Argon",
            "url": "https://raw.githubusercontent.com/githubnext/monaspace/refs/heads/main/fonts/webfonts/MonaspaceArgon-Bold.woff2",
            "weight": 700,
        },
        ],
        }
      }
    """)

    app.reload()
    wait_for_app_loaded(app)

    # Make sure that all elements are rendered and no skeletons are shown:
    expect(app.get_by_test_id("stSkeleton")).to_have_count(0, timeout=25000)
    # Add some additional timeout to ensure that fonts can load without
    # creating flakiness:
    app.wait_for_timeout(5000)
    expect_font(app, "Inter")
    expect_font(app, "Monaspace Argon")
    assert_snapshot(app, name="theme_from_window_variable", image_threshold=0.0005)
