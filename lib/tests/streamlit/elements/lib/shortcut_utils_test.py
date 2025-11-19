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

"""Tests for shortcut utils."""

from __future__ import annotations

import pytest

from streamlit.elements.lib.shortcut_utils import normalize_shortcut
from streamlit.errors import StreamlitAPIException


@pytest.mark.parametrize(
    ("shortcut", "expected"),
    [
        ("Ctrl+Shift+C", "Ctrl+Shift+C"),
        ("Alt+S", "Alt+S"),
        ("Mod+Enter", "Ctrl+Enter"),
        ("Meta+Enter", "Cmd+Enter"),
        ("Command+Enter", "Cmd+Enter"),
        ("Control+Enter", "Ctrl+Enter"),
        ("Option+Enter", "Alt+Enter"),
        ("Cmd+Shift+P", "Cmd+Shift+P"),
        ("Ctrl+Alt+Delete", "Ctrl+Alt+Delete"),
        ("Shift+Enter", "Shift+Enter"),
        ("Enter", "Enter"),
        ("Esc", "Escape"),
        ("Space", "Space"),
        ("Tab", "Tab"),
        ("Backspace", "Backspace"),
        ("Delete", "Delete"),
        ("Home", "Home"),
        ("End", "End"),
        ("PageUp", "PageUp"),
        ("PageDown", "PageDown"),
        ("Left", "Left"),
        ("ArrowLeft", "Left"),
        ("Right", "Right"),
        ("ArrowRight", "Right"),
        ("Up", "Up"),
        ("ArrowUp", "Up"),
        ("Down", "Down"),
        ("ArrowDown", "Down"),
        ("f1", "f1"),
        ("f12", "f12"),
        (" ctrl + shift + c ", "Ctrl+Shift+C"),
        (" alt + s ", "Alt+S"),
        (" cmd + shift + p ", "Cmd+Shift+P"),
        (" ctrl + alt + delete ", "Ctrl+Alt+Delete"),
        (" shift + enter ", "Shift+Enter"),
        (" enter ", "Enter"),
        (" esc ", "Escape"),
        (" space ", "Space"),
        (" tab ", "Tab"),
        (" backspace ", "Backspace"),
        (" delete ", "Delete"),
        (" home ", "Home"),
        (" end ", "End"),
        (" pageup ", "PageUp"),
        (" pagedown ", "PageDown"),
        (" left ", "Left"),
        (" arrowleft ", "Left"),
        (" right ", "Right"),
        (" arrowright ", "Right"),
        (" up ", "Up"),
        (" arrowup ", "Up"),
        (" down ", "Down"),
        (" arrowdown ", "Down"),
        (" f1 ", "f1"),
        (" f12 ", "f12"),
    ],
)
def test_normalize_shortcut_returns_normalized(shortcut: str, expected: str) -> None:
    """Test that normalize_shortcut returns the expected normalized string."""
    assert normalize_shortcut(shortcut) == expected


@pytest.mark.parametrize(
    "shortcut",
    [
        "",
        " ",
        "+",
        "++",
        " + ",
        "Ctrl+",
        "+C",
        "Ctrl+Shift+",
        "Ctrl++C",
        "Ctrl+Shift+Alt+",
        "Ctrl+Shift+Alt++",
    ],
)
def test_normalize_shortcut_rejects_invalid_format(shortcut: str) -> None:
    """Test that normalize_shortcut raises StreamlitAPIException for invalid format."""
    with pytest.raises(StreamlitAPIException):
        normalize_shortcut(shortcut)


@pytest.mark.parametrize(
    "shortcut",
    [
        "Ctrl+Shift",
        "Alt",
        "Cmd",
        "Shift",
        "Ctrl+Alt",
        "Ctrl+Cmd",
        "Ctrl+Shift+Alt",
    ],
)
def test_normalize_shortcut_rejects_modifiers_only(shortcut: str) -> None:
    """Test that normalize_shortcut raises StreamlitAPIException for modifiers only."""
    with pytest.raises(StreamlitAPIException):
        normalize_shortcut(shortcut)


@pytest.mark.parametrize(
    "shortcut",
    [
        "Ctrl+C+D",
        "A+B",
        "Ctrl+Shift+C+D",
        "Ctrl+Alt+Delete+Insert",
    ],
)
def test_normalize_shortcut_rejects_multiple_keys(shortcut: str) -> None:
    """Test that normalize_shortcut raises StreamlitAPIException for multiple keys."""
    with pytest.raises(StreamlitAPIException):
        normalize_shortcut(shortcut)


@pytest.mark.parametrize(
    "shortcut",
    [
        "Ctrl+C",
        "Cmd+R",
        "Alt+Shift+c",
        "r",
        "C",
    ],
)
def test_normalize_shortcut_rejects_reserved_keys(shortcut: str) -> None:
    """Test that normalize_shortcut raises StreamlitAPIException for reserved keys."""
    with pytest.raises(StreamlitAPIException):
        normalize_shortcut(shortcut)
