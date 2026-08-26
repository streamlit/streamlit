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

"""Helpers for interacting with the Streamlit app under test.

This module defines `AppTarget`, a core e2e abstraction that wraps Playwright's
`Page` and `FrameLocator` APIs into a single, stable interface. The goal is to
centralize (and hide) the "where does the app DOM live?" details so tests and
shared helpers don't need to branch on local vs external/iframe-hosted modes,
which keeps cyclomatic complexity low across the suite.

In e2e tests, prefer using the `app_target` fixture (from
`e2e_playwright/conftest.py`) and call `locator()`, `get_by_test_id()`, etc., on
the returned `AppTarget` instead of accessing `Page`/`FrameLocator` directly.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Literal, cast

if TYPE_CHECKING:
    from playwright.sync_api import FrameLocator, Locator, Page


@dataclass(frozen=True)
class AppTarget:
    """A stable abstraction for interacting with the app under test.

    - `page` is the top-level Playwright Page we control (for routing, events,
      reload, timeouts, tracing, etc).
    - `dom` is where app selectors should run (Page in local mode; FrameLocator
      in external host mode).
    - `base_url` is the canonical base URL of the app (not the host page).
    """

    page: Page
    dom: Page | FrameLocator
    base_url: str
    mode: Literal["local", "external_direct", "external_host"]

    def locator(self, selector: str) -> Locator:
        return self.dom.locator(selector)

    def get_by_test_id(self, test_id: str) -> Locator:
        return self.dom.get_by_test_id(test_id)

    def get_by_role(self, role: str, **kwargs: Any) -> Locator:
        # Playwright's `get_by_role` is typed with a Literal union of valid ARIA
        # roles. We accept `str` here for convenience and cast at the call site.
        return self.dom.get_by_role(cast("Any", role), **kwargs)

    def get_by_text(self, text: str, **kwargs: Any) -> Locator:
        return self.dom.get_by_text(text, **kwargs)

    def wait_for_run(self, *, wait_delay: int = 100, initial_wait: int = 210) -> None:
        wait_for_app_target_run(self, wait_delay=wait_delay, initial_wait=initial_wait)

    def wait_for_loaded(self) -> None:
        wait_for_app_target_loaded(self)

    @property
    def locator_context(self) -> Page | FrameLocator:
        return self.dom


def wait_for_app_target_run(
    app: AppTarget,
    *,
    wait_delay: int = 100,
    initial_wait: int = 210,
) -> None:
    """Wait for the given app target to finish running.

    This intentionally reuses the existing `wait_for_app_run` implementation so
    we have a single place to maintain the core "app is connected and idle"
    detection logic.
    """
    # Import lazily to avoid introducing import-time circular dependencies.
    from e2e_playwright.conftest import wait_for_app_run

    wait_for_app_run(app.dom, wait_delay=wait_delay, initial_wait=initial_wait)


def wait_for_app_target_loaded(app: AppTarget) -> None:
    """Wait for initial app load (works when hosted in an iframe)."""
    app.dom.locator("[data-testid='stAppViewContainer']").wait_for(
        timeout=30000, state="attached"
    )
    wait_for_app_target_run(app)
