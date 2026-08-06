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

from __future__ import annotations

import json
from typing import TYPE_CHECKING

import pytest

from e2e_playwright.conftest import (
    ImageCompareFunction,
    build_app_url,
    start_app_server,
    wait_for_app_loaded,
)
from e2e_playwright.shared.app_utils import expect_no_skeletons

if TYPE_CHECKING:
    from collections.abc import Generator

    from playwright.sync_api import Page


# Disable the default module-scoped app_server so each test can start its own
# server with a different theme config via extra_env.
@pytest.fixture(scope="module", autouse=True)
def app_server():
    """Override to disable the default module-scoped app_server fixture."""
    return


@pytest.fixture
def app(
    page: Page,
    app_base_url: str,
    app_port: int,
    request: pytest.FixtureRequest,
    theme_env: dict[str, str],
) -> Generator[Page, None, None]:
    """Start a fresh server with the per-test theme_env, yield the page, then stop."""
    streamlit_proc = start_app_server(app_port, request.module, extra_env=theme_env)
    try:
        response = page.goto(build_app_url(app_base_url, path="/"))
        if response is None or response.status != 200:
            raise RuntimeError("Unable to load page")
        wait_for_app_loaded(page)
        yield page
    finally:
        streamlit_proc.terminate()


@pytest.fixture
def theme_env() -> dict[str, str]:
    """Default theme env — overridden per test via indirect parametrization or override."""
    return {}


_CUSTOM_WEIGHTS_ENV = {
    "STREAMLIT_THEME_BASE_FONT_WEIGHT": "200",
    "STREAMLIT_THEME_CODE_FONT_WEIGHT": "600",
    "STREAMLIT_THEME_HEADING_FONT_WEIGHTS": json.dumps([800, 700, 500, 400, 300, 200]),
    "STREAMLIT_THEME_SIDEBAR_CODE_FONT_WEIGHT": "200",
    "STREAMLIT_THEME_SIDEBAR_HEADING_FONT_WEIGHTS": json.dumps(
        [200, 300, 400, 500, 700, 800]
    ),
}

_50_STEP_WEIGHTS_ENV = {
    "STREAMLIT_THEME_BASE_FONT_WEIGHT": "550",
    "STREAMLIT_THEME_HEADING_FONT_WEIGHTS": json.dumps([550, 650, 700, 750, 800, 850]),
}


@pytest.fixture
def custom_weights_app(
    page: Page,
    app_base_url: str,
    app_port: int,
    request: pytest.FixtureRequest,
) -> Generator[Page, None, None]:
    streamlit_proc = start_app_server(
        app_port, request.module, extra_env=_CUSTOM_WEIGHTS_ENV
    )
    try:
        response = page.goto(build_app_url(app_base_url, path="/"))
        if response is None or response.status != 200:
            raise RuntimeError("Unable to load page")
        wait_for_app_loaded(page)
        yield page
    finally:
        streamlit_proc.terminate()


@pytest.fixture
def fifty_step_weights_app(
    page: Page,
    app_base_url: str,
    app_port: int,
    request: pytest.FixtureRequest,
) -> Generator[Page, None, None]:
    streamlit_proc = start_app_server(
        app_port, request.module, extra_env=_50_STEP_WEIGHTS_ENV
    )
    try:
        response = page.goto(build_app_url(app_base_url, path="/"))
        if response is None or response.status != 200:
            raise RuntimeError("Unable to load page")
        wait_for_app_loaded(page)
        yield page
    finally:
        streamlit_proc.terminate()


def test_custom_theme_font_weights(
    custom_weights_app: Page, assert_snapshot: ImageCompareFunction
):
    # Set bigger viewport to better show the charts
    custom_weights_app.set_viewport_size({"width": 1280, "height": 1000})
    # Make sure that all elements are rendered and no skeletons are shown:
    expect_no_skeletons(custom_weights_app, timeout=25000)
    # Add some additional timeout to ensure that fonts can load without
    # creating flakiness:
    custom_weights_app.wait_for_timeout(10000)

    assert_snapshot(
        custom_weights_app, name="custom_weights_app", image_threshold=0.0003
    )


def test_50_step_font_weights_applied(fifty_step_weights_app: Page):
    """Verify that 50-step font weight values (e.g. 550, 650) are applied correctly.

    These are intermediate values that are valid for variable fonts but were previously
    blocked by the increment-of-100 validation. We check computed CSS font-weight on
    rendered heading elements rather than using a snapshot so no baseline is needed.
    """
    expect_no_skeletons(fifty_step_weights_app, timeout=25000)

    h1_weight = fifty_step_weights_app.locator("h1").first.evaluate(
        "el => getComputedStyle(el).fontWeight"
    )
    h2_weight = fifty_step_weights_app.locator("h2").first.evaluate(
        "el => getComputedStyle(el).fontWeight"
    )

    # baseFontWeight=550 should produce normal=550, semiBold=650, bold=750, extrabold=850
    # headingFontWeights=[550, 650, ...] should produce h1=550, h2=650
    assert h1_weight == "550", f"Expected h1 font-weight 550, got {h1_weight}"
    assert h2_weight == "650", f"Expected h2 font-weight 650, got {h2_weight}"

    # Verify body text uses the 50-step base weight
    body_weight = fifty_step_weights_app.locator(".stMarkdown p").first.evaluate(
        "el => getComputedStyle(el).fontWeight"
    )
    assert body_weight == "550", f"Expected body font-weight 550, got {body_weight}"
