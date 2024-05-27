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

import pytest
from playwright.sync_api import Page

from e2e_playwright.shared.app_utils import (
    click_checkbox,
    click_form_button,
    expect_prefixed_markdown,
)


@pytest.mark.parametrize(
    "form_key,is_checkbox_inside_form",
    [
        ["form_0", True],
        ["form_1", False],
        ["form_2", False],
        ["form_3", True],
        ["form_4", True],
        ["form_5", False],
        ["form_6", True],
        ["form_7", True],
        ["form_8", True],
        ["form_9", True],
    ],
)
def test_form_container_association(
    app: Page, form_key: str, is_checkbox_inside_form: bool
):
    """Test association of elements to a form with different cases
    with elements created in the form container and outside.
    """
    # Check the initial state of the checkbox to be False
    expect_prefixed_markdown(app, f"{form_key} value:", "False", exact_match=True)

    # Click on the checkbox
    click_checkbox(app, re.compile(f"in {form_key}"))

    # Check that only checkbox values have been updated that are outside a form
    expect_prefixed_markdown(
        app, f"{form_key} value:", str(not is_checkbox_inside_form), exact_match=True
    )

    # Submit the form
    click_form_button(app, f"{form_key} submit")

    # Check the checkbox value has been updated to True for all cases
    expect_prefixed_markdown(app, f"{form_key} value:", "True", exact_match=True)

    # # Form id mapping whether a checkbox is inside a form
    # checkbox_inside_form = {
    #     "form_0": True,
    #     "form_1": False,
    #     "form_2": False,
    #     "form_3": True,
    #     "form_4": True,
    #     "form_5": False,
    #     "form_6": True,
    #     "form_7": True,
    #     "form_8": True,
    #     "form_9": True,
    # }

    # for form_id, is_checkbox_inside_form in checkbox_inside_form.items():
