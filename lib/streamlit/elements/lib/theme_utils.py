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

"""Theme override mapping types and serialization for public theme APIs."""

from __future__ import annotations

import math
import re
from collections.abc import Mapping, Sequence
from typing import Final, Literal, TypedDict

from streamlit.elements.lib.color_util import is_theme_api_color
from streamlit.errors import StreamlitInvalidParameterTypeError, StreamlitValueError
from streamlit.proto.NewSession_pb2 import CustomThemeConfig, ThemeOverride
from streamlit.string_util import to_snake_case

# Accepted radius literals match frontend parseRadius in theme/utils.ts.
_RADIUS_LITERALS: Final[frozenset[str]] = frozenset(
    {"none", "small", "medium", "large", "full"}
)
_BASE_VALUES: Final[tuple[str, ...]] = ("inherit", "light", "dark")
_QUOTED_BASE_VALUES: Final[tuple[str, ...]] = tuple(
    f"'{item}'" for item in _BASE_VALUES
)
_COLOR_FORMAT_VALUES: Final[tuple[str, ...]] = (
    "a hex color",
    "an rgb()/rgba() color",
    "a CSS named color",
)
_RADIUS_FORMAT_VALUES: Final[tuple[str, ...]] = (
    "'none'",
    "'small'",
    "'medium'",
    "'large'",
    "'full'",
    "a px or rem size",
)
_CHART_PALETTE_EXACT_LENGTH: Final[int] = 10
_RADIUS_NUMBER_RE: Final[re.Pattern[str]] = re.compile(r"-?(?:\d+\.\d*|\.\d+|\d+)$")


class ThemeVariantConfig(TypedDict, total=False):
    """Visual tokens for a theme override, shared or inside ``light`` / ``dark``."""

    primary_color: str
    background_color: str
    secondary_background_color: str
    text_color: str
    link_color: str
    link_underline: bool
    code_text_color: str
    code_background_color: str
    border_color: str
    dataframe_border_color: str
    dataframe_header_background_color: str
    show_widget_border: bool
    base_radius: str
    button_radius: str
    chart_categorical_colors: Sequence[str]
    chart_sequential_colors: Sequence[str]
    chart_diverging_colors: Sequence[str]


class ThemeConfig(ThemeVariantConfig, total=False):
    """Theme override mapping for ``st.container`` and ``st.set_page_config``."""

    base: Literal["inherit", "light", "dark"]
    light: ThemeVariantConfig
    dark: ThemeVariantConfig


_VARIANT_KEYS: Final[frozenset[str]] = frozenset(ThemeVariantConfig.__annotations__)
_ROOT_ONLY_KEYS: Final[frozenset[str]] = frozenset({"base", "light", "dark"})
_ALLOWED_ROOT_KEYS: Final[frozenset[str]] = _VARIANT_KEYS | _ROOT_ONLY_KEYS
_COLOR_KEYS: Final[frozenset[str]] = frozenset(
    {
        "primary_color",
        "background_color",
        "secondary_background_color",
        "text_color",
        "link_color",
        "code_text_color",
        "code_background_color",
        "border_color",
        "dataframe_border_color",
        "dataframe_header_background_color",
    }
)
_BOOL_KEYS: Final[frozenset[str]] = frozenset({"link_underline", "show_widget_border"})
_RADIUS_KEYS: Final[frozenset[str]] = frozenset({"base_radius", "button_radius"})
_CHART_KEYS: Final[frozenset[str]] = frozenset(
    {
        "chart_categorical_colors",
        "chart_sequential_colors",
        "chart_diverging_colors",
    }
)
_QUOTED_VARIANT_KEYS: Final[tuple[str, ...]] = tuple(
    f"'{key}'" for key in sorted(_VARIANT_KEYS)
)
_QUOTED_ROOT_KEYS: Final[tuple[str, ...]] = tuple(
    f"'{key}'" for key in sorted(_ALLOWED_ROOT_KEYS)
)


def populate_theme_override(mapping: object) -> ThemeOverride | None:
    """Validate a theme mapping and copy it onto a ``ThemeOverride`` proto.

    Returns ``None`` when ``mapping`` is ``None``, empty, or equivalent to no
    overlay (for example ``{"base": "inherit"}`` with no visual keys).
    """
    if mapping is None:
        return None
    if not isinstance(mapping, Mapping):
        raise StreamlitInvalidParameterTypeError(
            "theme",
            type(mapping).__name__,
            ["mapping"],
        )
    if len(mapping) == 0:
        return None

    override = ThemeOverride()
    for raw_key, value in mapping.items():
        key = _require_string_key("theme", raw_key)
        _validate_mapping_key("theme", key, _ALLOWED_ROOT_KEYS, _QUOTED_ROOT_KEYS)
        if key == "base":
            _set_override_base(override, value)
        elif key in {"light", "dark"}:
            _populate_variant_section(override, key, value)
        else:
            _set_variant_field(override.values, key, value)

    if not override.HasField("base") and not override.HasField("values"):
        return None
    return override


def _require_string_key(parameter: str, key: object) -> str:
    if not isinstance(key, str):
        raise StreamlitInvalidParameterTypeError(
            parameter,
            type(key).__name__,
            ["str"],
            detail="Theme mapping keys must be strings.",
        )
    return key


def _validate_mapping_key(
    parameter: str, key: str, allowed: frozenset[str], quoted: tuple[str, ...]
) -> None:
    if key in allowed:
        return
    snake = to_snake_case(key)
    if snake != key and snake in allowed:
        raise StreamlitValueError(
            parameter,
            quoted,
            detail=f"Unknown key `{key}`. Did you mean `{snake}`?",
        )
    raise StreamlitValueError(
        parameter,
        quoted,
        detail=f"Unknown key `{key}`.",
    )


def _set_override_base(override: ThemeOverride, value: object) -> None:
    if value not in _BASE_VALUES:
        raise StreamlitValueError("base", _QUOTED_BASE_VALUES)
    if value == "light":
        override.base = CustomThemeConfig.LIGHT
    elif value == "dark":
        override.base = CustomThemeConfig.DARK


def _populate_variant_section(
    override: ThemeOverride, section_name: str, value: object
) -> None:
    if not isinstance(value, Mapping):
        raise StreamlitInvalidParameterTypeError(
            section_name,
            type(value).__name__,
            ["mapping"],
        )
    section_msg = getattr(override.values, section_name)
    for raw_key, field_value in value.items():
        key = _require_string_key(section_name, raw_key)
        if key in _ROOT_ONLY_KEYS:
            raise StreamlitValueError(
                key,
                _QUOTED_VARIANT_KEYS,
                detail=(f"`{key}` is not allowed inside the `{section_name}` section."),
            )
        _validate_mapping_key(section_name, key, _VARIANT_KEYS, _QUOTED_VARIANT_KEYS)
        _set_variant_field(section_msg, key, field_value)


def _set_variant_field(msg: CustomThemeConfig, key: str, value: object) -> None:
    if key in _COLOR_KEYS:
        _validate_color(key, value)
        setattr(msg, key, value)
        return
    if key in _BOOL_KEYS:
        if not isinstance(value, bool):
            raise StreamlitInvalidParameterTypeError(
                key,
                type(value).__name__,
                ["bool"],
            )
        setattr(msg, key, value)
        return
    if key in _RADIUS_KEYS:
        _validate_radius(key, value)
        setattr(msg, key, value)
        return
    if key in _CHART_KEYS:
        colors = _validate_chart_palette(key, value)
        getattr(msg, key).extend(colors)
        return
    raise StreamlitValueError(  # pragma: no cover - defensive, keys are allowlisted
        key,
        _QUOTED_VARIANT_KEYS,
        detail=f"Unknown key `{key}`.",
    )


def _validate_color(key: str, value: object) -> None:
    if not isinstance(value, str) or not is_theme_api_color(value):
        raise StreamlitValueError(
            key,
            _COLOR_FORMAT_VALUES,
            detail=(
                f"Invalid color for `{key}`: {value!r}. "
                "Accepted: hex, rgb()/rgba(), CSS named colors."
            ),
        )


def _validate_radius(key: str, value: object) -> None:
    if not isinstance(value, str) or not _is_valid_radius(value):
        raise StreamlitValueError(key, _RADIUS_FORMAT_VALUES)


def _is_valid_radius(value: str) -> bool:
    """Return whether ``value`` matches frontend ``parseRadius`` accepted input.

    Literals are ``none`` / ``small`` / ``medium`` / ``large`` / ``full``
    (case-insensitive). Otherwise a ``px`` or ``rem`` size, or a bare number
    treated as pixels.
    """
    processed = value.strip().lower()
    if processed in _RADIUS_LITERALS:
        return True
    if processed.endswith("rem"):
        return _is_parseable_number(processed[:-3])
    if processed.endswith("px"):
        return _is_parseable_number(processed[:-2])
    return _is_parseable_number(processed)


def _is_parseable_number(value: str) -> bool:
    if not _RADIUS_NUMBER_RE.fullmatch(value):
        return False
    try:
        number = float(value)
    except ValueError:
        return False
    return math.isfinite(number)


def _validate_chart_palette(key: str, value: object) -> list[str]:
    if isinstance(value, str) or not isinstance(value, Sequence):
        raise StreamlitInvalidParameterTypeError(
            key,
            type(value).__name__,
            ["sequence of colors"],
        )
    colors = list(value)
    if key == "chart_categorical_colors":
        if len(colors) == 0:
            raise StreamlitValueError(
                key,
                ["a non-empty sequence of colors"],
            )
    elif len(colors) != _CHART_PALETTE_EXACT_LENGTH:
        raise StreamlitValueError(
            key,
            [f"a sequence of exactly {_CHART_PALETTE_EXACT_LENGTH} colors"],
        )
    for color in colors:
        _validate_color(key, color)
    return colors
