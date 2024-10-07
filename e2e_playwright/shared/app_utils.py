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

import platform
import re
from typing import Literal, Pattern

from playwright.sync_api import Frame, Locator, Page, expect

from e2e_playwright.conftest import wait_for_app_run

# Meta = Apple's Command Key; for complete list see https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values#special_values
COMMAND_KEY = "Meta" if platform.system() == "Darwin" else "Control"


def get_checkbox(locator: Locator | Page, label: str | Pattern[str]) -> Locator:
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


def get_image(locator: Locator | Page, caption: str | Pattern[str]) -> Locator:
    """Get an image element with the given caption.

    Parameters
    ----------

    locator : Locator or Page
        The locator to search for the element.

    caption : str or Pattern[str]
        The caption of the image element to get.

    Returns
    -------
    Locator
        The element.
    """
    element = locator.get_by_test_id("stImage").filter(
        has=locator.get_by_test_id("stImageCaption").filter(has_text=caption)
    )
    expect(element).to_be_visible()

    return element


def get_button(locator: Locator | Page, label: str | Pattern[str]) -> Locator:
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


def get_form_submit_button(
    locator: Locator | Page, label: str | Pattern[str]
) -> Locator:
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
    element = (
        locator.get_by_test_id("stFormSubmitButton")
        .filter(has_text=label)
        .locator("button")
    )
    expect(element).to_be_visible()
    return element


def get_expander(locator: Locator | Page, label: str | Pattern[str]) -> Locator:
    """Get a expander container with the given label.

    Parameters
    ----------

    locator : Locator
        The locator to search for the expander.

    label : str or Pattern[str]
        The label of the expander to get.

    Returns
    -------
    Locator
        The expander container.
    """
    element = locator.get_by_test_id("stExpander").filter(
        has=locator.locator("summary").filter(has_text=label)
    )
    expect(element).to_be_visible()
    return element


def get_markdown(
    locator: Locator | Page, text_inside_markdown: str | Pattern[str]
) -> Locator:
    """Get a markdown element with the given text inside.

    Parameters
    ----------

    locator : Locator
        The locator to search for the expander.

    text_inside_markdown : str or Pattern[str]
        Some text to use to identify the markdown element. The text should be contained
        in the markdown content.

    Returns
    -------
    Locator
        The expander content.
    """
    if isinstance(text_inside_markdown, str):
        text_inside_markdown = re.compile(text_inside_markdown)

    markdown_element = locator.get_by_test_id("stMarkdownContainer").filter(
        has_text=text_inside_markdown
    )
    expect(markdown_element).to_be_visible()
    return markdown_element


def expect_prefixed_markdown(
    locator: Locator | Page,
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


def expect_markdown(
    locator: Locator | Page,
    expected_message: str | Pattern[str],
) -> None:
    """Expect markdown with the given message to be displayed in the app.

    Parameters
    ----------

    locator : Locator
        The locator to search for the exception element.

    expected_markdown : str or Pattern[str]
        The expected message to be displayed in the exception.
    """
    markdown_el = (
        locator.get_by_test_id("stMarkdown")
        .get_by_test_id("stMarkdownContainer")
        .filter(has_text=expected_message)
    )
    expect(markdown_el).to_be_visible()


def expect_exception(
    locator: Locator | Page,
    expected_message: str | Pattern[str] | None = None,
) -> None:
    """Expect an exception to be displayed in the app.

    Parameters
    ----------

    locator : Locator
        The locator to search for the exception element.

    expected_message : str or Pattern[str] or None
        The expected message to be displayed in the exception.
    """

    if expected_message is None:
        exception_el = locator.get_by_test_id("stException")
    else:
        exception_el = locator.get_by_test_id("stException").filter(
            has_text=expected_message
        )
    expect(exception_el).to_be_visible()


def expect_no_exception(locator: Locator | Page):
    exception_el = locator.get_by_test_id("stException")
    expect(exception_el).not_to_be_attached()


def expect_warning(
    locator: Locator | Page,
    expected_message: str | Pattern[str],
) -> None:
    """Expect a warning to be displayed in the app.

    Parameters
    ----------

    locator : Locator
        The locator to search for the warning element.

    expected_message : str or Pattern[str]
        The expected message to be displayed in the warning.
    """
    warning_el = locator.get_by_test_id("stAlert").filter(has_text=expected_message)
    expect(warning_el).to_be_visible()


def click_checkbox(
    page: Page,
    label: str | Pattern[str],
) -> None:
    """Click a checkbox with the given label
    and wait for the app to run.

    Parameters
    ----------

    page : Page
        The page to click the button on.

    label : str or Pattern[str]
        The label of the button to click.
    """
    checkbox_element = get_checkbox(page, label)
    #  Click the checkbox label to be more reliable
    checkbox_element.locator("label").click()
    wait_for_app_run(page)


def click_toggle(
    page: Page,
    label: str | Pattern[str],
) -> None:
    """Click a toggle with the given label
    and wait for the app to run.

    Parameters
    ----------

    page : Page
        The page to click the toggle on.

    label : str or Pattern[str]
        The label of the toggle to click.
    """
    click_checkbox(page, label)


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


def expect_help_tooltip(
    app: Locator | Page,
    element_with_help_tooltip: Locator,
    tooltip_text: str | Pattern[str],
):
    """Expect a tooltip to be displayed when hovering over the help symbol of an element.

    This only works for elements that have our shared help tooltip implemented.
    It doesn't work for elements with a custom tooltip implementation, e.g. st.button.

    The element gets unhovered after the tooltip is checked.

    Parameters
    ----------
    app : Page
        The page to search for the tooltip.

    element_with_help_tooltip : Locator
        The locator of the element with the help tooltip.

    tooltip_text : str or Pattern[str]
        The text of the tooltip to expect.
    """
    hover_target = element_with_help_tooltip.get_by_test_id("stTooltipHoverTarget")
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


def expect_script_state(
    page: Page,
    state: Literal[
        "initial",
        "running",
        "notRunning",
        "rerunRequested",
        "stopRequested",
        "compilationError",
    ],
) -> None:
    """Expect the app to be in a specific script state.

    Parameters
    ----------
    page : Page
        The page to search for the script state.

    state :
        The expected script state.
    """
    page.wait_for_selector(
        f"[data-testid='stApp'][data-test-script-state='{state}']",
        timeout=10000,
        state="attached",
    )


def get_element_by_key(locator: Locator | Page, key: str) -> Locator:
    """Get an element with the given user-defined key.

    Parameters
    ----------

    locator : Locator
        The locator to search for the element.

    key : str
        The user-defined key of the element

    Returns
    -------
    Locator
        The element.

    """
    class_name = re.sub(r"[^a-zA-Z0-9_-]", "-", key.strip())
    class_name = f"st-key-{class_name}"
    return locator.locator(f".{class_name}")


def expand_sidebar(app: Page) -> Locator:
    """Expands the sidebar.

    Returns
    -------
    Locator
        The sidebar element.
    """
    app.get_by_test_id("stSidebarCollapsedControl").click()
    sidebar = app.get_by_test_id("stSidebar")
    expect(sidebar).to_be_visible()
    return sidebar


def check_top_level_class(app: Page, test_id: str) -> None:
    """Check that the top level class is correctly set.

    It should be the same as the test id of the element
    and set on the same component.

    Parameters
    ----------
    app : Page
        The page to search for the element.

    test_id : str
        The test id of the element to check.
    """
    expect(app.get_by_test_id(test_id).first).to_have_class(re.compile(test_id))


def register_connection_status_observer(page_or_frame: Page | Frame | None) -> None:
    if page_or_frame is None:
        return None

    return page_or_frame.evaluate("""async () => {
        window.streamlitPlaywrightDebugConnectionStatuses = [];
        const callback = (mutationList, observer) => {
            if (!mutationList || mutationList.length === 0) {
                return
            }
            const target = mutationList[0].target
            if (!target) {
                return
            }
            let state = target
                            .getAttribute('data-test-connection-state')
                            .toUpperCase();
            window.streamlitPlaywrightDebugConnectionStatuses.push(state);
        }
        const observer = new MutationObserver(callback);
        // Observe app status for changes
        const targetNode = document.querySelector('[data-testid=stApp]')
        if (!targetNode) {
            console.log("stApp not found")
            return
        }
        const config = {
            childList: false,
            subtree: false,
            attributeFilter: ['data-test-connection-state']
        };
        observer.observe(targetNode, config);
    }""")


def get_observed_connection_statuses(page_or_frame: Page | Frame | None) -> list[str]:
    if page_or_frame is None:
        return []

    return page_or_frame.evaluate(
        "() => window.streamlitPlaywrightDebugConnectionStatuses"
    )


def expect_connection_status(
    page_or_frame: Page | Frame | None, expected_status: str, callable_action: str
) -> None:
    """Wait for the expected_status to appear in the app's connection-state attribute.

    Uses the browser's MutationObserver API to observe changes to the DOM. This way,
    we will never have a race condition between calling disconnect and checking the
    status.
    If the status is not observed within 1 second, the promise will resolved with an
    error message. We don't use reject because on Firefox this seem to cause an
    undefined error which is not as precise as our error message.
    Otherwise, the promise is resolved with the status.

    The resolved status will be uppercased.
    """

    if page_or_frame is None:
        return None

    status = page_or_frame.evaluate(
        """async ([expectedStatus]) => {
                // the first call to resolve will be the one returned to the caller
                // so its either the observed status or the timeout. Subsequent
                // calls are no-ops.
                const p = new Promise((resolve) => {
                    // Define a timeoutId so that we can cancel the timeout in the
                    // callback upon success
                    let timeoutId = null
                    let resolved = false
                    const callback = (mutationList, observer) => {
                        if (!mutationList || mutationList.length === 0) {
                            return
                        }
                        const target = mutationList[0].target
                        if (!target) {
                            return
                        }
                        let state = target
                                        .getAttribute('data-test-connection-state')
                                        .toUpperCase();
                        if (state.indexOf(expectedStatus.toUpperCase()) > -1) {
                            resolved = true
                            if (timeoutId) clearTimeout(timeoutId)
                            if (observer) observer.disconnect()
                            resolve(state)
                        }
                    }
                    const observer = new MutationObserver(callback);
                    // Observe app status for changes
                    const targetNode = document.querySelector('[data-testid=stApp]')
                    if (!targetNode) {
                        resolve("stApp not found")
                        return
                    }
                    const config = {
                        childList: false,
                        subtree: false,
                        attributeFilter: ['data-test-connection-state']
                    };
                    observer.observe(targetNode, config);
            """
        + callable_action
        + """
                    if (!resolved) {
                        timeoutId = setTimeout(() => {
                            if (observer) observer.disconnect()
                            resolve(`timeout: did not observe status '${expectedStatus}'`)
                            return
                        }, 1500);
                    }
                })

                const status = await p
                return status
            }
            """,
        [expected_status],
    )
    assert status == expected_status, status


def wait_for_all_images_to_be_loaded(page: Page) -> None:
    # Wait to make sure that the images have been loaded
    page.wait_for_function("""() => {
        const images = Array.from(document.querySelectorAll('img'));
        return images.every(img => img.complete);
    }
    """)
