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

import re
from pathlib import Path

import pytest

from streamlit.elements.lib.color_util import CSS_NAMED_COLORS
from streamlit.elements.lib.theme_utils import populate_theme_override
from streamlit.errors import StreamlitInvalidParameterTypeError, StreamlitValueError
from streamlit.proto.NewSession_pb2 import CustomThemeConfig

_TEN_COLORS: list[str] = [
    "#111111",
    "#222222",
    "#333333",
    "#444444",
    "#555555",
    "#666666",
    "#777777",
    "#888888",
    "#999999",
    "#aaaaaa",
]


def test_none_and_empty_mapping_return_none() -> None:
    """None and empty mappings serialize to no override."""
    assert populate_theme_override(None) is None
    assert populate_theme_override({}) is None


def test_inherit_base_without_visual_keys_returns_none() -> None:
    """``base="inherit"`` with no tokens is equivalent to no overlay."""
    assert populate_theme_override({"base": "inherit"}) is None


def test_non_mapping_raises_invalid_parameter_type() -> None:
    """Non-mapping theme values raise StreamlitInvalidParameterTypeError."""
    with pytest.raises(StreamlitInvalidParameterTypeError, match="theme"):
        populate_theme_override(["primary_color", "green"])


def test_all_visual_keys_serialize() -> None:
    """Every supported visual key is copied onto the expected proto field."""
    override = populate_theme_override(
        {
            "primary_color": "#7C3AED",
            "background_color": "#FAFAFF",
            "secondary_background_color": "#F3F0FF",
            "text_color": "#1F1733",
            "link_color": "#5B21B6",
            "link_underline": False,
            "code_text_color": "#111111",
            "code_background_color": "#EEEEEE",
            "border_color": "#DDDDDD",
            "dataframe_border_color": "#CCCCCC",
            "dataframe_header_background_color": "#F5F5F5",
            "show_widget_border": False,
            "base_radius": "full",
            "button_radius": "8px",
            "chart_categorical_colors": ["green", "#00ff00"],
            "chart_sequential_colors": _TEN_COLORS,
            "chart_diverging_colors": _TEN_COLORS,
        }
    )
    assert override is not None
    values = override.values
    assert values.primary_color == "#7C3AED"
    assert values.background_color == "#FAFAFF"
    assert values.secondary_background_color == "#F3F0FF"
    assert values.text_color == "#1F1733"
    assert values.link_color == "#5B21B6"
    assert values.link_underline is False
    assert values.HasField("link_underline")
    assert values.code_text_color == "#111111"
    assert values.code_background_color == "#EEEEEE"
    assert values.border_color == "#DDDDDD"
    assert values.dataframe_border_color == "#CCCCCC"
    assert values.dataframe_header_background_color == "#F5F5F5"
    assert values.show_widget_border is False
    assert values.HasField("show_widget_border")
    assert values.base_radius == "full"
    assert values.button_radius == "8px"
    assert list(values.chart_categorical_colors) == ["green", "#00ff00"]
    assert list(values.chart_sequential_colors) == _TEN_COLORS
    assert list(values.chart_diverging_colors) == _TEN_COLORS
    assert not override.HasField("base")


@pytest.mark.parametrize(
    "mapping",
    [
        {"primary_color": "green"},
        {"primary_color": "green", "base": "inherit"},
    ],
    ids=["omitted", "inherit"],
)
def test_base_inherit_or_omitted_has_no_wrapper_base(mapping: dict[str, str]) -> None:
    """Omitted and inherit base leave the wrapper enum unset."""
    override = populate_theme_override(mapping)
    assert override is not None
    assert not override.HasField("base")


@pytest.mark.parametrize(
    ("base", "expected"),
    [
        ("light", CustomThemeConfig.LIGHT),
        ("dark", CustomThemeConfig.DARK),
    ],
    ids=["light", "dark"],
)
def test_base_light_and_dark_set_optional_enum(base: str, expected: int) -> None:
    """Explicit light/dark base sets the optional wrapper enum."""
    override = populate_theme_override({"base": base, "primary_color": "green"})
    assert override is not None
    assert override.HasField("base")
    assert override.base == expected


def test_invalid_base_raises() -> None:
    """Unsupported base values raise StreamlitValueError."""
    with pytest.raises(StreamlitValueError, match="base"):
        populate_theme_override({"base": "auto"})


def test_light_and_dark_sections() -> None:
    """Shared keys plus one-level light/dark sections serialize onto values."""
    override = populate_theme_override(
        {
            "primary_color": "#7C3AED",
            "light": {"background_color": "#FAFAFF", "text_color": "#1F1733"},
            "dark": {"background_color": "#171221", "text_color": "#F7F2FF"},
        }
    )
    assert override is not None
    assert override.values.primary_color == "#7C3AED"
    assert override.values.light.background_color == "#FAFAFF"
    assert override.values.light.text_color == "#1F1733"
    assert override.values.dark.background_color == "#171221"
    assert override.values.dark.text_color == "#F7F2FF"


@pytest.mark.parametrize("nested_key", ["base", "light", "dark"])
def test_rejects_recursive_variant_sections(nested_key: str) -> None:
    """Variant mappings cannot contain nested base/light/dark keys."""
    with pytest.raises(StreamlitValueError, match=nested_key):
        populate_theme_override({"light": {nested_key: {"primary_color": "green"}}})


def test_rejects_unknown_and_camel_case_keys() -> None:
    """Unknown keys fail fast; camelCase suggests snake_case."""
    with pytest.raises(StreamlitValueError, match="Unknown key"):
        populate_theme_override({"not_a_token": "green"})
    with pytest.raises(StreamlitValueError, match="primary_color"):
        populate_theme_override({"primaryColor": "green"})


@pytest.mark.parametrize("excluded", ["base_font_size", "sidebar", "red_color"])
def test_rejects_excluded_config_tokens(excluded: str) -> None:
    """config.toml-only tokens are not accepted by the API mapping."""
    with pytest.raises(StreamlitValueError, match=excluded):
        populate_theme_override({excluded: "#000000"})


@pytest.mark.parametrize(
    "color",
    ["green", "#7C3AED", "#abc", "rgb(0, 128, 0)", "rgba(0, 128, 0, 0.5)"],
)
def test_accepts_valid_colors(color: str) -> None:
    """Hex, rgb()/rgba(), and CSS named colors are accepted."""
    override = populate_theme_override({"primary_color": color})
    assert override is not None
    assert override.values.primary_color == color


@pytest.mark.parametrize(
    "color", ["hsl(120, 100%, 25%)", "transparent", "primary", "not-a-color"]
)
def test_rejects_invalid_colors(color: str) -> None:
    """hsl, transparent, semantic-only names, and unknown strings are rejected."""
    with pytest.raises(StreamlitValueError, match="primary_color"):
        populate_theme_override({"primary_color": color})


@pytest.mark.parametrize("radius", ["full", "8px", "0.5rem", "none", "12"])
def test_accepts_valid_radii(radius: str) -> None:
    """Radius literals, px/rem, and bare numbers are accepted."""
    override = populate_theme_override({"base_radius": radius})
    assert override is not None
    assert override.values.base_radius == radius


@pytest.mark.parametrize("radius", ["huge", "10em", "10%", ""])
def test_rejects_invalid_radii(radius: str) -> None:
    """Unsupported radius strings raise StreamlitValueError."""
    with pytest.raises(StreamlitValueError, match="base_radius"):
        populate_theme_override({"base_radius": radius})


def test_chart_palette_length_rules() -> None:
    """Categorical palettes must be non-empty; sequential and diverging need 10 colors."""
    with pytest.raises(StreamlitValueError, match="chart_categorical_colors"):
        populate_theme_override({"chart_categorical_colors": []})
    with pytest.raises(StreamlitValueError, match="chart_sequential_colors"):
        populate_theme_override({"chart_sequential_colors": ["#111111"]})
    with pytest.raises(StreamlitValueError, match="chart_diverging_colors"):
        populate_theme_override({"chart_diverging_colors": [*_TEN_COLORS, "#bbbbbb"]})


def _frontend_css_named_colors() -> set[str]:
    ts_path = None
    for parent in Path(__file__).resolve().parents:
        candidate = parent / "frontend" / "lib" / "src" / "theme" / "cssNamedColors.ts"
        if candidate.exists():
            ts_path = candidate
            break
    assert ts_path is not None, "Could not find frontend cssNamedColors.ts"
    text = ts_path.read_text()
    start = text.index("new Set([")
    end = text.index("])", start)
    return set(re.findall(r'"([a-z]+)"', text[start:end]))


def test_css_named_colors_include_rebeccapurple() -> None:
    """The CSS Color Module Level 4 set includes rebeccapurple and excludes transparent."""
    assert len(CSS_NAMED_COLORS) == 148
    assert "rebeccapurple" in CSS_NAMED_COLORS
    assert "transparent" not in CSS_NAMED_COLORS
    assert "currentcolor" not in CSS_NAMED_COLORS


def test_css_named_colors_match_frontend_allowlist() -> None:
    """Python and TypeScript CSS named-color allowlists stay in lockstep."""
    assert _frontend_css_named_colors() == set(CSS_NAMED_COLORS)
