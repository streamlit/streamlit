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

from __future__ import annotations

import re
from typing import Pattern

from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import wait_for_app_run


def get_checkbox(locator: Locator, label: str | Pattern[str]) -> Locator:
    """Get a checkbox widget with the given label.

    Parameters
    ----------

    locator : Locator
        The locator to search for the element.

    label : str or Pattern[str]
        The label of the element to get.

    Returns
    -------
    Locator
        The element.
    """
    element = locator.get_by_test_id("stCheckbox").filter(has_text=label)
    expect(element).to_be_visible()
    return element


def get_button(locator: Locator, label: str | Pattern[str]) -> Locator:
    """Get a button widget with the given label.

    Parameters
    ----------

    locator : Locator
        The locator to search for the element.

    label : str or Pattern[str]
        The label of the element to get.

    Returns
    -------
    Locator
        The element.
    """
    element = (
        locator.get_by_test_id("stButton").filter(has_text=label).locator("button")
    )
    expect(element).to_be_visible()
    return element


def get_form_submit_button(locator: Locator, label: str | Pattern[str]) -> Locator:
    """Get a form submit button with the given label.

    Parameters
    ----------

    locator : Locator
        The locator to search for the element.

    label : str or Pattern[str]
        The label of the element to get.

    Returns
    -------
    Locator
        The element.
    """
    element = locator.get_by_test_id("baseButton-secondaryFormSubmit").filter(
        has_text=label
    )
    expect(element).to_be_visible()
    return element


def expect_prefixed_markdown(
    locator: Locator,
    expected_prefix: str,
    expected_markdown: str | Pattern[str],
    exact_match: bool = False,
) -> None:
    """Find the markdown with the prefix and then ensure that the
    `expected_markdown` is in the text as well.

    Splitting it into a `filter` and a `to_have_text` check has the advantage
    that we see the diff in case of a mismatch; this would not be the case if we
    just used the `filter`.

    Only one markdown-element must be returned, otherwise an error is thrown.

    Parameters
    ----------
    locator : Locator
        The locator to search for the markdown element.

    expected_prefix : str
        The prefix of the markdown element.

    expected_markdown : str or Pattern[str]
        The markdown content that should be found. If a pattern is provided,
        the text will be matched against this pattern.

    exact_match : bool, optional
        Whether the markdown should exactly match the `expected_markdown`, by default True.
        Otherwise, the `expected_markdown` must be contained in the markdown content.

    """
    selection_text = locator.get_by_test_id("stMarkdownContainer").filter(
        has_text=expected_prefix
    )
    if exact_match:
        text_to_match: str | Pattern[str]
        if isinstance(expected_markdown, Pattern):
            # Recompile the pattern with the prefix:
            text_to_match = re.compile(f"{expected_prefix} {expected_markdown.pattern}")
        else:
            text_to_match = f"{expected_prefix} {expected_markdown}"

        expect(selection_text).to_have_text(text_to_match)
    else:
        expect(selection_text).to_contain_text(expected_markdown)


def expect_exception(
    locator: Locator,
    expected_message: str | Pattern[str],
) -> None:
    """Expect an exception to be displayed in the app.

    Parameters
    ----------

    locator : Locator
        The locator to search for the exception element.

    expected_markdown : str or Pattern[str]
        The expected message to be displayed in the exception.
    """
    exception_el = locator.get_by_test_id("stException").filter(
        has_text=expected_message
    )
    expect(exception_el).to_be_visible()


def click_button(
    page: Page,
    label: str | Pattern[str],
) -> None:
    """Click a button with the given label
    and wait for the app to run.

    Parameters
    ----------

    page : Page
        The page to click the button on.

    label : str or Pattern[str]
        The label of the button to click.
    """
    button_element = get_button(page, label)
    button_element.click()
    wait_for_app_run(page)


def click_form_button(
    page: Page,
    label: str | Pattern[str],
) -> None:
    """Click a form submit button with the given label
    and wait for the app to run.

    Parameters
    ----------

    page : Page
        The page to click the button on.

    label : str or Pattern[str]
        The label of the button to click.
    """
    button_element = get_form_submit_button(page, label)
    button_element.click()
    wait_for_app_run(page)


def click_checkbox(
    page: Page,
    label: str | Pattern[str],
) -> None:
    """Click a checkbox with the given label
    and wait for the app to run.

    Parameters
    ----------

    page : Page
        The page to click the checkbox on.

    label : str or Pattern[str]
        The label of the checkbox to click.
    """
    checkbox_element = get_checkbox(page, label)
    checkbox_element.click()
    wait_for_app_run(page)


def expect_help_tooltip(
    app: Page, el_with_help_tooltip: Locator, tooltip_text: str | Pattern[str]
):
    """Expect a tooltip to be displayed when hovering over the help symbol of an element.

    This only works for elements that have our shared help tooltip implemented.
    It doesn't work for elements with a custom tooltip implementation, e.g. st.button.

    Parameters
    ----------
    app : Page
        The page to search for the tooltip.

    el_with_help_tooltip : Locator
        The locator of the element with the help tooltip.

    tooltip_text : str or Pattern[str]
        The text of the tooltip to expect.
    """
    hover_target = el_with_help_tooltip.get_by_test_id("stTooltipHoverTarget")
    expect(hover_target).to_be_visible()

    tooltip_content = app.get_by_test_id("stTooltipContent")
    expect(tooltip_content).not_to_be_attached()

    hover_target.hover()

    expect(tooltip_content).to_be_visible()
    expect(tooltip_content).to_have_text(tooltip_text)

    # reset the hovering in case this method is called multiple times in the same test
    app.get_by_test_id("stApp").hover(
        position={"x": 0, "y": 0}, no_wait_after=True, force=True
    )
    expect(tooltip_content).not_to_be_attached()
