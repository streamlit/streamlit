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

"""A pytest plugin that deselects E2E tests which would be skipped anyway.

Usage:
    PYTHONPATH=scripts pytest -p e2e_executable_tests_plugin --collect-only -q

Tests marked with `only_browser` or `skip_browser` are collected for every
browser and then skipped during setup, so a plain `--collect-only` over-reports
what a CI run executes (by ~250 test cases at the time of writing). Deselecting
them makes `--collect-only` output list the tests that would run, up to the
runtime skips noted in `_would_run`, which is what the E2E test count check in
`.github/workflows/playwright.yml` reports.

This plugin lives in `scripts/` rather than in `e2e_playwright/` on purpose: the
test count check swaps `e2e_playwright/` to the PR's merge base, so a plugin in
there would disappear with it, and older revisions would apply older rules.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Final

# Reuse Playwright's own skip logic instead of reimplementing it, so that the
# reported count cannot quietly drift away from what the plugin does at runtime.
# If a Playwright upgrade renames this, the import fails loudly, which is much
# better than silently counting tests that never run.
from pytest_playwright.pytest_playwright import _get_skiplist

if TYPE_CHECKING:
    import pytest

# Mirrors the browser list Playwright hardcodes in `pytest_runtest_setup`. Only
# membership matters, not order, and a superset is fine: a test's `browser_name`
# is always one that `--browser` selected.
_BROWSERS: Final = ("chromium", "firefox", "webkit")


def _would_run(item: pytest.Item) -> bool:
    """Return whether this test survives the skips known at collection time.

    That covers `skip` markers and Playwright's browser skiplist. `skipif`
    conditions and `pytest.skip()` calls in a test body are not evaluated, since
    doing so needs pytest internals or running the test itself, so a PR that
    adds or changes those moves what CI runs without a matching delta here.
    """
    if item.get_closest_marker("skip") is not None:
        return False

    callspec = getattr(item, "callspec", None)
    if callspec is None:
        return True

    browser_name = callspec.params.get("browser_name")
    if not browser_name:
        return True

    # `_get_skiplist` mutates the list of browsers it is handed, so pass a copy.
    return browser_name not in _get_skiplist(item, list(_BROWSERS), "browser")


def pytest_collection_modifyitems(
    config: pytest.Config, items: list[pytest.Item]
) -> None:
    """Deselect every test CI would skip: `skip`-marked ones, and the ones
    Playwright skips for their browser.
    """
    executable: list[pytest.Item] = []
    skipped: list[pytest.Item] = []
    for item in items:
        (executable if _would_run(item) else skipped).append(item)

    if skipped:
        config.hook.pytest_deselected(items=skipped)
        items[:] = executable
