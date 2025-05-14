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

from playwright.sync_api import Locator, Page

from e2e_playwright.conftest import wait_until


def check_if_offscreen(app: Page, img: Locator) -> bool:
    """
    Determines if an element is rendered but outside the viewport.

    Parameters
    ----------
    app : Page
        The Playwright Page object representing the browser page.
    img : Locator
        The Playwright Locator object for the element to check.

    Returns
    -------
    bool
        True if the element is offscreen (outside the viewport),
        False if it's onscreen or not rendered.

    Notes
    -----
    The function checks if the element's bounding box is entirely
    outside the current viewport dimensions.
    """
    viewport = app.viewport_size
    # If viewport_size is None, we can't determine offscreen status reliably
    # Treat as not offscreen in this case, maybe log a warning?
    if viewport is None:
        print(
            "Warning: Viewport size is None, cannot definitively check offscreen status."
        )
        return False

    bbox = img.bounding_box()
    # If no bounding box, it's not rendered or detached. Not considered offscreen.
    if bbox is None:
        return False

    # Check if the bounding box is entirely outside the viewport
    return (
        bbox["x"] + bbox["width"] <= 0  # Left of viewport
        or bbox["x"] >= viewport["width"]  # Right of viewport
        or bbox["y"] + bbox["height"] <= 0  # Above viewport
        or bbox["y"] >= viewport["height"]  # Below viewport
    )


def check_if_onscreen(app: Page, img: Locator) -> bool:
    """
    Determines if an element is visible within the viewport.

    Parameters
    ----------
    app : Page
        The Playwright Page object representing the browser page.
    img : Locator
        The Playwright Locator object for the element to check.

    Returns
    -------
    bool
        True if the element is onscreen (inside the viewport),
        False if it's offscreen or not rendered.

    Notes
    -----
    This is the logical inverse of check_if_offscreen().
    """
    return not check_if_offscreen(app, img)


def wait_for_animation_to_be_hidden(
    app: Page, animation_images: Locator, timeout: int = 5000
) -> None:
    """
    Waits for all animation elements to move outside the viewport.

    Parameters
    ----------
    app : Page
        The Playwright Page object representing the browser page.
    animation_images : Locator
        The Playwright Locator that matches multiple animation elements.
    timeout : int
        The timeout for the wait operation. Defaults to 5000ms.
    """
    for img in animation_images.all():
        wait_until(
            app,
            lambda current_img=img: check_if_offscreen(app, current_img),
            timeout=timeout,
        )


def assert_animation_is_hidden(app: Page, animation_images: Locator) -> None:
    """
    Asserts that all animation elements are outside the viewport.

    Parameters
    ----------
    app : Page
        The Playwright Page object representing the browser page.
    animation_images : Locator
        The Playwright Locator that matches multiple animation elements.

    Raises
    ------
    AssertionError
        If any animation element is found to be visible within the viewport.
    """
    for img in animation_images.all():
        assert check_if_offscreen(app, img) is True
