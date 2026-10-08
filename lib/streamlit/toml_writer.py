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

"""Serialize the TOML documents Streamlit writes.

The credentials file and each ``streamlit config show`` assignment use
strings, booleans, integers, floats, arrays, and tables. ``streamlit config show``
prints the ``[theme]`` header itself, so a font-face array is one inline-table
assignment and stays under that header. Dates and other TOML types raise
``TypeError``.
"""

from __future__ import annotations

import re
from typing import TYPE_CHECKING, Any, Final

if TYPE_CHECKING:
    from collections.abc import Iterator

# Short escapes for characters a basic string cannot contain raw.
# Leave tab unescaped; TOML allows a raw tab. Write other C0 controls and DEL
# as ``\u00XX``.
_COMPACT_ESCAPES: Final[dict[str, str]] = {
    "\b": "\\b",
    "\n": "\\n",
    "\f": "\\f",
    "\r": "\\r",
    '"': '\\"',
    "\\": "\\\\",
}
# TOML bare keys are ASCII letters, digits, underscores, and dashes.
_BARE_KEY_RE: Final = re.compile(r"[A-Za-z0-9_-]+")
_INDENT: Final = "    "
# str.splitlines() breaks on these even though they are not C0 controls.
# Escaping them keeps a config-show comment on one physical line.
_UNICODE_LINE_SEPARATORS: Final = frozenset({0x85, 0x2028, 0x2029})


def dumps(document: dict[str, Any]) -> str:
    """Return ``document`` as TOML text.

    Supports strings, booleans, integers, floats, lists, tuples, and dicts. A non-empty
    result ends with a newline. An empty document is ``""``.

    Raises
    ------
    TypeError
        If a value or key uses an unsupported type.
    """
    if not isinstance(document, dict):
        raise TypeError(
            f"TOML document must be a dict, got {type(document).__qualname__}."
        )
    return "".join(_iter_table(document, name=""))


def _iter_table(table: dict[Any, Any], *, name: str) -> Iterator[str]:
    """Yield a header, then assignments, then nested tables.

    TOML requires a table's keys before its child tables, so dict values are
    deferred. Those dicts become ``[section]`` tables. Dicts inside arrays
    never reach here; ``_format_value`` writes them inline.
    """
    if name:
        yield f"[{name}]\n"

    subtables: list[tuple[Any, dict[Any, Any]]] = []
    for key, value in table.items():
        if isinstance(value, dict):
            subtables.append((key, value))
            continue
        yield f"{_format_key(key)} = {_format_value(value)}\n"

    for key, value in subtables:
        key_part = _format_key(key)
        child_name = f"{name}.{key_part}" if name else key_part
        yield from _iter_table(value, name=child_name)


def _format_value(value: Any, *, nest_level: int = 0) -> str:
    """Serialize one assignment value. Dicts that reach here are inline tables."""
    # bool is a subclass of int, so it has to be handled before int.
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        return str(value)
    if isinstance(value, str):
        return _format_string(value)
    if isinstance(value, list | tuple):
        return _format_array(value, nest_level=nest_level)
    if isinstance(value, dict):
        return _format_inline_table(value)
    raise TypeError(
        f"Cannot write {type(value).__qualname__} as TOML. "
        "Expected a str, bool, int, float, list, tuple, or dict."
    )


def _format_array(items: list[Any] | tuple[Any, ...], *, nest_level: int) -> str:
    """Serialize an array one item per line, so config comments can wrap it."""
    if not items:
        return "[]"

    item_indent = _INDENT * (nest_level + 1)
    closing_indent = _INDENT * nest_level
    body = ",\n".join(
        item_indent + _format_value(item, nest_level=nest_level + 1) for item in items
    )
    return f"[\n{body},\n{closing_indent}]"


def _format_inline_table(table: dict[Any, Any]) -> str:
    """Serialize a dict as a TOML inline table."""
    if not table:
        return "{}"

    parts: list[str] = []
    for key, value in table.items():
        rendered = _format_value(value)
        # TOML inline tables must be a single line. Reject a value whose
        # serialization contains a newline, such as a nested array.
        if "\n" in rendered:
            raise TypeError(
                "Inline tables cannot contain multiline values. "
                f"Key {key!r} is a list or other multiline value."
            )
        parts.append(f"{_format_key(key)} = {rendered}")
    return "{ " + ", ".join(parts) + " }"


def _format_key(key: object) -> str:
    if not isinstance(key, str):
        raise TypeError(f"TOML keys must be strings, got {type(key).__qualname__}.")
    if key and _BARE_KEY_RE.fullmatch(key):
        return key
    return _format_string(key)


def _format_string(value: str) -> str:
    parts = ['"']
    for char in value:
        replacement = _COMPACT_ESCAPES.get(char)
        codepoint = ord(char)
        if replacement is not None:
            parts.append(replacement)
        elif char == "\t" or (
            codepoint >= 0x20
            and codepoint != 0x7F
            and codepoint not in _UNICODE_LINE_SEPARATORS
        ):
            parts.append(char)
        else:
            parts.append(f"\\u{codepoint:04x}")
    parts.append('"')
    return "".join(parts)
