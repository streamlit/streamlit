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

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from playwright.sync_api import Locator, Page

    from e2e_playwright.conftest import ImageCompareFunction


def wait_for_react_stability(page: Page, timeout_ms: int = 1000) -> None:
    """
    Wait for React 18 rendering to stabilize.

    This function waits for a short period and then ensures no new React
    rendering operations are in progress by checking for DOM mutations.

    Parameters
    ----------
    page : Page
        The Playwright page
    timeout_ms : int
        Maximum time to wait in milliseconds
    """
    # First wait a small amount of time to allow React to process
    page.wait_for_timeout(100)

    # Then set up a mutation observer and wait until no mutations occur for a period
    has_mutations = page.evaluate(
        """
        (timeout_ms) => {
            return new Promise(resolve => {
                let lastMutation = Date.now();
                const observer = new MutationObserver(() => {
                    lastMutation = Date.now();
                });

                observer.observe(document.body, {
                    childList: true,
                    attributes: true,
                    subtree: true
                });

                // Check every 50ms if mutations have stopped
                const interval = setInterval(() => {
                    if (Date.now() - lastMutation > 200) {
                        clearInterval(interval);
                        observer.disconnect();
                        resolve(false);  // No recent mutations
                    }
                }, 50);

                // Set timeout to avoid hanging
                setTimeout(() => {
                    clearInterval(interval);
                    observer.disconnect();
                    resolve(true);  // Still had mutations when timeout occurred
                }, timeout_ms);
            });
        }
        """,
        timeout_ms,
    )

    # If we still had mutations when the timeout occurred, add a final safety wait
    if has_mutations:
        page.wait_for_timeout(100)


def take_stable_snapshot(
    page: Page,
    locator: Locator | Page,
    assert_snapshot: ImageCompareFunction,
    name: str,
    pixel_threshold: float = 0.05,
) -> None:
    """
    Take a stable snapshot after waiting for React rendering to complete.

    Parameters
    ----------
    page : Page
        The Playwright page
    locator : Locator
        The element to snapshot
    assert_snapshot : function
        The snapshot assertion function
    name : str
        Name for the snapshot
    pixel_threshold : float
        Threshold for pixel differences
    """
    wait_for_react_stability(page)
    assert_snapshot(locator, name=name, pixel_threshold=pixel_threshold)
