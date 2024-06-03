# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

from playwright.sync_api import Page

from e2e_playwright.shared.app_utils import expect_help_tooltip

default_tooltip = """
This is a really long tooltip.

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut ut turpis vitae
justo ornare venenatis a vitae leo. Donec mollis ornare ante, eu ultricies
tellus ornare eu. Donec eros risus, ultrices ut eleifend vel, auctor eu turpis.
In consectetur erat vel ante accumsan, a egestas urna aliquet. Nullam eget
sapien eget diam euismod eleifend. Nulla purus enim, finibus ut velit eu,
malesuada dictum nulla. In non arcu et risus maximus fermentum eget nec ante.
""".strip()

leading_indent_code_tooltip = """
Code:

    This
    is
    a
    code
    block!"""

leading_indent_regular_text_tooltip = """
This is a regular text block!
Test1
Test2

"""

indented_code_tooltip = """
Code:

    for i in range(10):
        x = i * 10
        print(x)
    """

no_indent_tooltip = "thisisatooltipwithnoindents. It has some spaces but no idents."


def test_tooltips_render_properly(app: Page):
    default_tooltip_test_ids = ["stTextInput", "stSelectbox", "stFileUploader"]
    leading_indent_code_tooltip_test_ids = [
        "stNumberInput",
        "stTimeInput",
        "stMultiSelect",
    ]
    leading_indent_regular_text_tooltip_test_ids = [
        "stCheckbox",
        "stDateInput",
        "stTextArea",
    ]
    no_indent_tooltip_test_ids = ["stColorPicker", "stButton", "stMetric"]

    for test_id in default_tooltip_test_ids:
        expect_help_tooltip(app, app.get_by_test_id(test_id), default_tooltip)

    for test_id in leading_indent_code_tooltip_test_ids:
        expect_help_tooltip(
            app, app.get_by_test_id(test_id), leading_indent_code_tooltip
        )

    for test_id in leading_indent_regular_text_tooltip_test_ids:
        expect_help_tooltip(
            app, app.get_by_test_id(test_id), leading_indent_regular_text_tooltip
        )

    expect_help_tooltip(app, app.get_by_test_id("stRadio"), indented_code_tooltip)
    expect_help_tooltip(
        app, app.get_by_test_id("stSlider").nth(0), indented_code_tooltip
    )
    expect_help_tooltip(
        app, app.get_by_test_id("stSlider").nth(1), indented_code_tooltip
    )

    for test_id in no_indent_tooltip_test_ids:
        expect_help_tooltip(app, app.get_by_test_id(test_id), no_indent_tooltip)
