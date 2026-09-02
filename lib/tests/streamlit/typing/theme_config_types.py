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

"""Type tests for ThemeConfig and ThemeVariantConfig public exports."""

from __future__ import annotations

from typing import TYPE_CHECKING

from typing_extensions import assert_type

if TYPE_CHECKING:
    from streamlit import ThemeConfig as TopLevelThemeConfig
    from streamlit import ThemeVariantConfig as TopLevelThemeVariantConfig
    from streamlit.typing import ThemeConfig, ThemeVariantConfig

    mapping: ThemeConfig = {
        "primary_color": "green",
        "base": "inherit",
        "light": {"background_color": "#FAFAFF"},
        "dark": {"background_color": "#171221"},
    }
    variant: ThemeVariantConfig = {"text_color": "#1F1733", "show_widget_border": False}
    top_level: TopLevelThemeConfig = mapping
    top_level_variant: TopLevelThemeVariantConfig = variant
    assert_type(top_level["primary_color"], str)
    assert_type(top_level_variant["show_widget_border"], bool)
