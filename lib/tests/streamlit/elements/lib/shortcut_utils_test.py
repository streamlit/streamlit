"""Tests for shortcut utils."""

from __future__ import annotations

import pytest

from streamlit.elements.lib.shortcut_utils import normalize_shortcut
from streamlit.errors import StreamlitAPIException


@pytest.mark.parametrize(
    ("shortcut", "expected"),
    [
        ("Ctrl+Shift+K", "ctrl+shift+k"),
        (" command + option + Enter ", "cmd+alt+enter"),
        ("Alt+Spacebar", "alt+space"),
        ("Shift+F5", "shift+f5"),
        ("Cmd + ctrl + k", "ctrl+cmd+k"),
    ],
)
def test_normalize_shortcut_returns_normalized(shortcut: str, expected: str) -> None:
    """Test that valid shortcuts are normalized consistently."""

    assert normalize_shortcut(shortcut) == expected


@pytest.mark.parametrize(
    "shortcut",
    [
        "Ctrl+Ctrl+K",
        "cmd+Cmd+Shift+enter",
        "ctrl + alt + Alt + K",
    ],
)
def test_normalize_shortcut_deduplicates_modifiers(shortcut: str) -> None:
    """Test that duplicates modifiers are ignored in the returned shortcut."""

    normalized = normalize_shortcut(shortcut)
    tokens = normalized.split("+")
    modifiers = tokens[:-1]
    assert len(modifiers) == len(set(modifiers))


@pytest.mark.parametrize(
    "shortcut",
    [
        123,
        None,
        ["ctrl", "k"],
    ],
)
def test_normalize_shortcut_requires_string(shortcut: object) -> None:
    """Test that non-string inputs raise a StreamlitAPIException."""

    with pytest.raises(StreamlitAPIException, match="must be a string value"):
        normalize_shortcut(shortcut)  # type: ignore[arg-type]


@pytest.mark.parametrize(
    "shortcut",
    [
        "",
        "   ",
        "+ +",
    ],
)
def test_normalize_shortcut_requires_token(shortcut: str) -> None:
    """Test that shortcuts without tokens raise an error."""

    with pytest.raises(StreamlitAPIException, match="must contain at least one key"):
        normalize_shortcut(shortcut)


@pytest.mark.parametrize(
    "shortcut",
    [
        "Ctrl+Shift",
        "Alt",
    ],
)
def test_normalize_shortcut_requires_non_modifier(shortcut: str) -> None:
    """Test that shortcuts without final non-modifier keys raise an error."""

    with pytest.raises(
        StreamlitAPIException,
        match="must include a non-modifier key",
    ):
        normalize_shortcut(shortcut)


@pytest.mark.parametrize(
    "shortcut",
    [
        "Ctrl+Alt+A+B",
        "Shift+Enter+K",
    ],
)
def test_normalize_shortcut_rejects_multiple_keys(shortcut: str) -> None:
    """Test that shortcuts with multiple non-modifier keys raise an error."""

    with pytest.raises(
        StreamlitAPIException,
        match="may only specify a single non-modifier key",
    ):
        normalize_shortcut(shortcut)


@pytest.mark.parametrize(
    "shortcut",
    [
        "Ctrl+C",
        "Shift+R",
        "c",
        "r",
    ],
)
def test_normalize_shortcut_rejects_reserved_keys(shortcut: str) -> None:
    """Test that reserved keys raise an error."""

    with pytest.raises(
        StreamlitAPIException,
        match="cannot use the keys 'C' or 'R'",
    ):
        normalize_shortcut(shortcut)


@pytest.mark.parametrize(
    "shortcut",
    [
        "Ctrl+InvalidKey",
        "Alt+!",
    ],
)
def test_normalize_shortcut_rejects_unknown_keys(shortcut: str) -> None:
    """Test that unknown non-modifier keys raise an error."""

    with pytest.raises(StreamlitAPIException, match="supported keys"):
        normalize_shortcut(shortcut)
