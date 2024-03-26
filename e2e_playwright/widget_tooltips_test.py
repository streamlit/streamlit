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

import re

from playwright.sync_api import Page, expect

DEFAULT_TOOLTIP = """This is a really long tooltip.
Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut ut turpis vitae
justo ornare venenatis a vitae leo. Donec mollis ornare ante, eu ultricies
tellus ornare eu. Donec eros risus, ultrices ut eleifend vel, auctor eu turpis.
In consectetur erat vel ante accumsan, a egestas urna aliquet. Nullam eget
sapien eget diam euismod eleifend. Nulla purus enim, finibus ut velit eu,
malesuada dictum nulla. In non arcu et risus maximus fermentum eget nec ante."""

TOOLTIP_CODE_BLOCK1 = """This
is
a
code
block!"""
TOOLTIP_CODE_BLOCK2 = """for i in range(10):
    x = i * 10
    print(x)"""

TOOLTIP_TEXT_BLOCK1 = """This is a regular text block!
Test1
Test2"""
TOOLTIP_TEXT_BLOCK2 = (
    """thisisatooltipwithnoindents. It has some spaces but no idents."""
)


def test_tooltip_text_with_dedent_on_widgets(app: Page):
    text_input_tooltip = app.get_by_test_id("stTextInput").get_by_test_id(
        "stTooltipIcon"
    )
    text_input_tooltip.click()
    expect(app.get_by_test_id("stMarkdown")).to_have_text(re.compile(DEFAULT_TOOLTIP))
