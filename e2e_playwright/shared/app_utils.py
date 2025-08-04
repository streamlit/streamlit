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

from __future__ import annotations

import platform
import re
from re import Pattern
from typing import Literal, cast

from playwright.sync_api import Frame, FrameLocator, Locator, Page, expect

from e2e_playwright.conftest import wait_for_app_loaded, wait_for_app_run

# Meta = Apple's Command Key; for complete list see https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values#special_values
COMMAND_KEY = "Meta" if platform.system() == "Darwin" else "Control"  # ty: ignore[unresolved-attribute]


def get_text_input(locator: Locator | Page, label: str | Pattern[str]) -> Locator:
    """Get a text input with the given label.

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
    element = locator.get_by_test_id("stTextInput").filter(has_text=label)
    expect(element).to_be_visible()
    return element


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


def get_radio_option(locator: Locator | Page, label: str | Pattern[str]) -> Locator:
    """Get a radio button widget with the given label.

    Parameters
    ----------
    locator : Locator
        The locator to search for the 'radio' element.

    label : str or Pattern[str]
        The label of the radio element to get.

    Returns
    -------
    Locator
        The element.
    """
    element = locator.locator('[data-baseweb="radio"]').filter(has_text=label)
    expect(element).to_be_visible()
    return element


def get_radio(locator: Locator | Page, label: str | Pattern[str]) -> Locator:
    """Get a radio widget with the given label.

    Parameters
    ----------
    locator : Locator
        The locator to search for the element.

    label : str or Pattern[str]
        The label of the element to get.
    """
    element = locator.get_by_test_id("stRadio").filter(has_text=label)
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


def get_popover(locator: Locator | Page, label: str | Pattern[str]) -> Locator:
    """Get a popover with the given label.

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
    element = locator.get_by_test_id("stPopover").filter(has_text=label)
    expect(element).to_be_visible()
    return element


def open_popover(locator: Locator | Page, label: str | Pattern[str]) -> Locator:
    """Open a popover with the given label and return the popover container.

    Parameters
    ----------
    locator : Locator
        The locator to search for the element.

    label : str or Pattern[str]
        The label of the element to get.

    Returns
    -------
    Locator
        The popover container.
    """
    get_popover(locator, label).get_by_role("button").first.click()
    popover_container = locator.get_by_test_id("stPopoverBody")
    expect(popover_container).to_be_visible()
    return popover_container


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


def get_number_input(locator: Locator | Page, label: str | Pattern[str]) -> Locator:
    """Get a number input with the given label.

    Parameters
    ----------
    locator : Locator
        The locator to search for the element.

    label : str or Pattern[str]
        The label of the element to get.

    Returns
    -------
    Locator
        The number input element.
    """
    element = locator.get_by_test_id("stNumberInput").filter(has_text=label)
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
    locator: FrameLocator | Locator | Page,
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


def expect_no_exception(locator: Locator | Page) -> None:
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


def fill_number_input(
    locator: Locator | Page,
    label: str | Pattern[str],
    value: int,
) -> None:
    """Set the value of a number input.

    Parameters
    ----------
    locator : Locator
        The locator to search for the number input.

    label : str or Pattern[str]
        The label of the number input.

    value : int
        The value to set the number input to.
    """

    number_input_element = get_number_input(locator, label)
    number_input_element.locator("input").fill(str(value))
    # Submit value:
    number_input_element.press("Enter")
    wait_for_app_run(locator)


def select_radio_option(
    page: Page,
    option: str | Pattern[str],
    label: str | Pattern[str] | None = None,
) -> None:
    """Click a radio option with the given option label
    and wait for the app to run.

    Parameters
    ----------
    page : Page
        The page to click the radio option on.

    option : str or Pattern[str]
        The option label of the radio option to click.

    label : str or Pattern[str] or None
        The label of the radio group. If None, the radio option
        is searched on the full page.
    """
    locator: Page | Locator = page

    if label is not None:
        # Get the radio group widget:
        locator = get_radio(page, label)

    get_radio_option(locator, option).click()
    wait_for_app_run(page)


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
) -> None:
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
    reset_hovering(app)
    expect(tooltip_content).not_to_be_attached()


def reset_hovering(locator: Locator | Page) -> None:
    """Reset the hovering of the app.

    This can be used to ensure that there aren't unexpected UI elements visible
    based on the current mouse position.
    """
    page = locator.page if isinstance(locator, Locator) else locator

    page.get_by_test_id("stApp").hover(
        position={"x": 0, "y": 0}, no_wait_after=True, force=True
    )


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
    app.get_by_test_id("stExpandSidebarButton").click()
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
        return

    page_or_frame.evaluate("""async () => {
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

    return cast(
        "list[str]",
        page_or_frame.evaluate(
            "() => window.streamlitPlaywrightDebugConnectionStatuses"
        ),
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
        return

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


def expect_no_skeletons(
    locator: Locator | Page | FrameLocator, timeout: int = 10000
) -> None:
    """Expect no skeletons to be visible on the page.

    This is useful to check that all elements have fully loaded.
    """
    expect(locator.get_by_test_id("stSkeleton")).to_have_count(0, timeout=timeout)


def wait_for_all_images_to_be_loaded(page: Page) -> None:
    # Wait to make sure that the images have been loaded
    page.wait_for_function("""() => {
        const images = Array.from(document.querySelectorAll('img'));
        return images.every(img => img.complete && img.naturalHeight !== 0);
    }
    """)


def expect_font(
    page: Page,
    font_family: str,
    style: str = "normal",
    weight: str = "normal",
    timeout: int = 20000,
) -> None:
    """
    Wait until the given font_family is recognized as available by the browser.
    Uses document.fonts.check within a wait_for_function call.

    Only check if the browser supports the Font Loading API.
    If the browser can render 'fontName' at 16px, it returns true.

    Parameters
    ----------
        page: Page
            The Playwright Page object.
        font_family: str
            The name of the font family to check.
        style: str
            The style of the font to check (default: "normal").
        weight: str
            The weight of the font to check (default: "normal").
        timeout: int
            How long to wait in milliseconds (default: 20000).

    Raises
    ------
        TimeoutError: If the font isn't recognized in time
    """
    font = f"{style} {weight} 16px '{font_family}'"
    # Remove single quotes if the font name has a space in it
    if " " in font_family:
        font = font.replace("'", "")

    check_script = """
    (font) => {
    if (!('fonts' in document)) return false;
    return document.fonts.ready.then(() => document.fonts.check(font));
    }
    """
    page.wait_for_function(check_script, arg=font, timeout=timeout)


def is_child_bounding_box_inside_parent(
    child_locator: Locator, parent_locator: Locator
) -> bool:
    """
    Checks if the bounding box of child_locator is fully within
    the bounding box of parent_locator.

    Parameters
    ----------
    child_locator : Locator
        The locator of the child element.

    parent_locator : Locator
        The locator of the parent element.

    Returns
    -------
    bool
        True if the child's bounding box lies completely within
        the parent's bounding box; otherwise, False.
    """
    parent_box = parent_locator.bounding_box()
    child_box = child_locator.bounding_box()

    # bounding_box() can return None if the element is invisible or not rendered.
    if parent_box is None or child_box is None:
        return False

    return (
        child_box["x"] >= parent_box["x"]
        and child_box["y"] >= parent_box["y"]
        and (child_box["x"] + child_box["width"])
        <= (parent_box["x"] + parent_box["width"])
        and (child_box["y"] + child_box["height"])
        <= (parent_box["y"] + parent_box["height"])
    )


def get_button_group(app: Page, key: str) -> Locator:
    """Get a button group with the given key.

    Parameters
    ----------
    app : Page
        The page to search for the button group.

    key : str
        The key of the button group to get.

    Returns
    -------
    Locator
        The button group.
    """
    return get_element_by_key(app, key).get_by_test_id("stButtonGroup").first


def get_segment_button(locator: Locator, text: str) -> Locator:
    """Get a segment button with the given button group.

    Parameters
    ----------
    locator : Locator
        The locator of the button groupto search for the segment button.

    text : str
        The text of the segment button to get.

    Returns
    -------
    Locator
        The segment button.
    """
    return locator.get_by_test_id(
        re.compile("stBaseButton-segmented_control(Active)?")
    ).filter(has_text=text)


def goto_app(page: Page, url: str) -> None:
    """Navigate to an app based on a given URL and wait for the app to be loaded.

    Parameters
    ----------
    page : Page
        The page to navigate to the given URL.

    url : str
        The URL to navigate to.
    """
    page.goto(url)
    wait_for_app_loaded(page)
