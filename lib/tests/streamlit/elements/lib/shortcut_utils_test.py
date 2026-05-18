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

"""Tests for shortcut utils."""

from __future__ import annotations

import logging

import pytest

from streamlit.elements.lib.shortcut_utils import normalize_shortcut
from streamlit.errors import StreamlitAPIException


@pytest.mark.parametrize(
    ("shortcut", "expected"),
    [
        ("Alt+S", "alt+s"),
        ("Mod+Enter", "ctrl+enter"),
        ("Meta+Enter", "cmd+enter"),
        ("Command+Enter", "cmd+enter"),
        ("Control+Enter", "ctrl+enter"),
        ("Option+Enter", "alt+enter"),
        ("Cmd+Shift+P", "cmd+shift+p"),
        ("Ctrl+Alt+Delete", "ctrl+alt+delete"),
        ("Shift+Enter", "shift+enter"),
        ("Enter", "enter"),
        ("Esc", "escape"),
        ("Space", "space"),
        ("Tab", "tab"),
        ("Backspace", "backspace"),
        ("Delete", "delete"),
        ("Home", "home"),
        ("End", "end"),
        ("PageUp", "pageup"),
        ("PageDown", "pagedown"),
        ("Left", "left"),
        ("ArrowLeft", "left"),
        ("Right", "right"),
        ("ArrowRight", "right"),
        ("Up", "up"),
        ("ArrowUp", "up"),
        ("Down", "down"),
        ("ArrowDown", "down"),
        ("f1", "f1"),
        ("f12", "f12"),
        (" alt + s ", "alt+s"),
        (" cmd + shift + p ", "cmd+shift+p"),
        (" ctrl + alt + delete ", "ctrl+alt+delete"),
        (" shift + enter ", "shift+enter"),
        (" enter ", "enter"),
        (" esc ", "escape"),
        (" space ", "space"),
        (" tab ", "tab"),
        (" backspace ", "backspace"),
        (" delete ", "delete"),
        (" home ", "home"),
        (" end ", "end"),
        (" pageup ", "pageup"),
        (" pagedown ", "pagedown"),
        (" left ", "left"),
        (" arrowleft ", "left"),
        (" right ", "right"),
        (" arrowright ", "right"),
        (" up ", "up"),
        (" arrowup ", "up"),
        (" down ", "down"),
        (" arrowdown ", "down"),
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


@pytest.fixture
def shortcut_logger_propagates(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Allow caplog to capture warnings from the shortcut_utils logger."""
    logger = logging.getLogger("streamlit.elements.lib.shortcut_utils")
    monkeypatch.setattr(logger, "propagate", True)


@pytest.mark.parametrize(
    "shortcut",
    [
        "Ctrl+T",
        "Cmd+T",
        "Ctrl+W",
        "Cmd+W",
        "Ctrl+N",
        "Cmd+N",
        "Ctrl+Shift+T",
        "Cmd+Shift+T",
        "Ctrl+Shift+N",
        "Cmd+Shift+N",
        "Ctrl+Shift+W",
        "Cmd+Shift+W",
        "Ctrl+Tab",
        "Ctrl+Shift+Tab",
        "Cmd+Tab",
        "Cmd+Shift+Tab",
        "Ctrl+PageUp",
        "Ctrl+PageDown",
        "Ctrl+L",
        "Cmd+L",
        "F11",
        "Mod+T",
        "Mod+PageDown",
    ],
)
def test_normalize_shortcut_warns_for_browser_reserved(
    shortcut: str,
    caplog: pytest.LogCaptureFixture,
    shortcut_logger_propagates: None,
) -> None:
    """Browser-reserved combos produce a logger warning but still normalize."""
    with caplog.at_level(
        logging.WARNING, logger="streamlit.elements.lib.shortcut_utils"
    ):
        result = normalize_shortcut(shortcut)
    assert result
    assert any("reserved by the browser" in record.message for record in caplog.records)


@pytest.mark.parametrize("shortcut", ["Ctrl+K", "Alt+S", "Cmd+Shift+P", "Enter", "F1"])
def test_normalize_shortcut_does_not_warn_for_safe(
    shortcut: str,
    caplog: pytest.LogCaptureFixture,
    shortcut_logger_propagates: None,
) -> None:
    """Non-reserved combos must not emit the browser-reserved warning."""
    with caplog.at_level(
        logging.WARNING, logger="streamlit.elements.lib.shortcut_utils"
    ):
        normalize_shortcut(shortcut)
    assert not any(
        "reserved by the browser" in record.message for record in caplog.records
    )
