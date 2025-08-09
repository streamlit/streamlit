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

"""Utilities for flexible theme configuration in e2e tests."""

from __future__ import annotations

import json
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from playwright.sync_api import Page


def apply_theme_via_window(
    page: Page, base: str = "light", **theme_options: Any
) -> None:
    """Apply custom theme via window.__streamlit injection.

    This approach works per-test and doesn't require environment variable isolation.

    Args:
        page: Playwright Page object
        base: Base theme to use ('light' or 'dark')
        **theme_options: Theme configuration options (e.g., textColor, backgroundColor, etc.)

    Example:
        apply_theme_via_window(
            page,
            base="light",
            textColor="#301934",
            backgroundColor="#CBC3E3"
        )
    """
    theme_key = "LIGHT_THEME" if base == "light" else "DARK_THEME"

    # Build theme configuration
    theme_config = {"base": base}
    theme_config.update(theme_options)

    # Inject theme configuration into window.__streamlit
    page.add_init_script(f"""
        window.__streamlit = {{
            {theme_key}: {json.dumps(theme_config)}
        }}
    """)
