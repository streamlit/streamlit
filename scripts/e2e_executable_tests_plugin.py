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
what a CI run executes (~250 test cases at the time of writing). Deselecting
them makes `--collect-only` output list exactly the tests that would run, which
is what the E2E test count check in `.github/workflows/playwright.yml` reports.

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

# The browsers Playwright can parametrize over, in the order it lists them.
_BROWSERS: Final = ("chromium", "firefox", "webkit")


def _would_run(item: pytest.Item) -> bool:
    """Return whether this test runs, rather than being skipped.

    Note that `skipif` conditions are not evaluated: doing so needs pytest
    internals, and no E2E test uses one today. Should that change, the reported
    count is too high by the number of tests that the condition skips.
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
    """Deselect every test Playwright would skip for its browser."""
    executable: list[pytest.Item] = []
    skipped: list[pytest.Item] = []
    for item in items:
        (executable if _would_run(item) else skipped).append(item)

    if skipped:
        config.hook.pytest_deselected(items=skipped)
        items[:] = executable
