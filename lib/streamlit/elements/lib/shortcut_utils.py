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

from typing import (
    Final,
)

from streamlit.errors import (
    StreamlitAPIException,
)

_MODIFIER_ALIASES: Final[dict[str, str]] = {
    "ctrl": "ctrl",
    "control": "ctrl",
    "cmd": "cmd",
    "command": "cmd",
    "meta": "cmd",
    "alt": "alt",
    "option": "alt",
    "shift": "shift",
    "mod": "ctrl",
}

_MODIFIER_ORDER: Final[tuple[str, ...]] = ("ctrl", "cmd", "alt", "shift")

_KEY_ALIASES: Final[dict[str, str]] = {
    "enter": "enter",
    "return": "enter",
    "space": "space",
    "spacebar": "space",
    "tab": "tab",
    "escape": "escape",
    "esc": "escape",
    "backspace": "backspace",
    "delete": "delete",
    "del": "delete",
    "home": "home",
    "end": "end",
    "pageup": "pageup",
    "pagedown": "pagedown",
    "left": "left",
    "arrowleft": "left",
    "right": "right",
    "arrowright": "right",
    "up": "up",
    "arrowup": "up",
    "down": "down",
    "arrowdown": "down",
}

_RESERVED_KEYS: Final[set[str]] = {"c", "r"}


def _normalize_key_token(lower_token: str) -> str:
    """Normalize a key token to a format that can be used on the client side."""

    if lower_token in _KEY_ALIASES:
        return _KEY_ALIASES[lower_token]

    if len(lower_token) == 1 and lower_token.isalnum():
        return lower_token

    if lower_token.startswith("f") and lower_token[1:].isdigit():
        return lower_token

    raise StreamlitAPIException(
        "shortcut must include a single character or one of the supported keys "
        "(e.g. Enter, Space, Tab, Escape)."
    )


def normalize_shortcut(shortcut: str) -> str:
    """Normalize a shortcut string to a format that can be used on the client side.

    Parameters
    ----------
    shortcut : str
        The shortcut string to normalize.

    Returns
    -------
    str
        The normalized shortcut string.

    Raises
    ------
    StreamlitAPIException
        If the shortcut is not a string value.
        If the shortcut does not contain at least one key or modifier.
        If the shortcut contains a single non-modifier key.
        If the shortcut uses the keys 'C' or 'R', with or without modifiers.
        If the shortcut does not include a non-modifier key.
    """
    if not isinstance(shortcut, str):
        raise StreamlitAPIException("shortcut must be a string value.")

    tokens = [token.strip() for token in shortcut.split("+") if token.strip()]
    if not tokens:
        raise StreamlitAPIException(
            "The `shortcut` must contain at least one key or modifier."
        )

    modifiers: list[str] = []
    key: str | None = None

    for raw_token in tokens:
        lower_token = raw_token.lower()
        if lower_token in _MODIFIER_ALIASES:
            normalized_modifier = _MODIFIER_ALIASES[lower_token]
            if normalized_modifier not in modifiers:
                modifiers.append(normalized_modifier)
            continue

        if key is not None:
            raise StreamlitAPIException(
                "The `shortcut` may only specify a single non-modifier key."
            )

        normalized_key = _normalize_key_token(lower_token)
        if normalized_key in _RESERVED_KEYS:
            raise StreamlitAPIException(
                "The `shortcut` cannot use the keys 'C' or 'R', with or without modifiers."
            )

        key = normalized_key

    if key is None:
        raise StreamlitAPIException(
            "The `shortcut` must include a non-modifier key such as 'K' or 'Ctrl+K'."
        )

    normalized_tokens: list[str] = [
        modifier for modifier in _MODIFIER_ORDER if modifier in modifiers
    ]
    if key is not None:
        normalized_tokens.append(key)

    return "+".join(normalized_tokens)
