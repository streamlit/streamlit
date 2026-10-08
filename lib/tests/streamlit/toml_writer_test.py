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

"""Tests for the TOML writer used by credentials and config show."""

from __future__ import annotations

import tomllib
from datetime import date

import pytest

from streamlit import toml_writer


@pytest.mark.parametrize(
    ("value", "rendered"),
    [
        (True, "value = true\n"),
        (False, "value = false\n"),
        (0, "value = 0\n"),
        (8501, "value = 8501\n"),
        (-1, "value = -1\n"),
        (2.0, "value = 2.0\n"),
        (10000.0, "value = 10000.0\n"),
        (-1.5, "value = -1.5\n"),
        ("", 'value = ""\n'),
        ("localhost", 'value = "localhost"\n'),
        ('say "hi"', 'value = "say \\"hi\\""\n'),
        ("a\\b", 'value = "a\\\\b"\n'),
        ("a\nb", 'value = "a\\nb"\n'),
        ("a\tb", 'value = "a\tb"\n'),
        ("café", 'value = "café"\n'),
        ("\u0001", 'value = "\\u0001"\n'),
        ("\u007f", 'value = "\\u007f"\n'),
    ],
    ids=[
        "true",
        "false",
        "zero",
        "positive-int",
        "negative-int",
        "float",
        "whole-float",
        "negative-float",
        "empty-string",
        "string",
        "quotes",
        "backslash",
        "newline",
        "tab",
        "non-ascii",
        "control",
        "delete",
    ],
)
def test_dumps_scalar(value: object, rendered: str) -> None:
    """Scalars use the TOML spelling config show prints."""
    assert toml_writer.dumps({"value": value}) == rendered


@pytest.mark.parametrize(
    ("char", "escape"),
    [("\u0085", "\\u0085"), ("\u2028", "\\u2028"), ("\u2029", "\\u2029")],
    ids=["next-line", "line-separator", "paragraph-separator"],
)
def test_dumps_unicode_line_separators_stay_one_line(char: str, escape: str) -> None:
    """Unicode line separators stay escaped so config comments do not split them."""
    rendered = toml_writer.dumps({"value": f"a{char}b"})
    assert rendered == f'value = "a{escape}b"\n'
    assert rendered.splitlines() == [f'value = "a{escape}b"']
    assert tomllib.loads(rendered)["value"] == f"a{char}b"


def test_dumps_credentials_document() -> None:
    """The credentials file is a ``[general]`` table with one email assignment."""
    rendered = toml_writer.dumps({"general": {"email": "some_email"}})
    assert rendered == '[general]\nemail = "some_email"\n'
    assert tomllib.loads(rendered)["general"]["email"] == "some_email"


def test_dumps_email_with_quotes_and_backslashes_round_trips() -> None:
    """An email that needs escapes is still the same string after parsing."""
    email = 'weird"email\\name@example.com'
    parsed = tomllib.loads(toml_writer.dumps({"general": {"email": email}}))
    assert parsed["general"]["email"] == email


def test_dumps_empty_containers() -> None:
    """Empty documents, arrays, and tables each have one spelling."""
    assert toml_writer.dumps({}) == ""
    assert toml_writer.dumps({"folderWatchList": []}) == "folderWatchList = []\n"
    assert toml_writer.dumps({"trustedUserHeaders": {}}) == "[trustedUserHeaders]\n"


def test_dumps_string_array_matches_config_show_layout() -> None:
    """Multiline arrays use the layout ``streamlit config show`` comments out."""
    rendered = toml_writer.dumps(
        {"origins": ["https://example.com", "https://streamlit.io"]}
    )
    assert rendered == (
        'origins = [\n    "https://example.com",\n    "https://streamlit.io",\n]\n'
    )


def test_dumps_integer_array() -> None:
    """Integer arrays, such as heading font weights, stay multiline."""
    rendered = toml_writer.dumps({"headingFontWeights": [800, 700]})
    assert rendered == ("headingFontWeights = [\n    800,\n    700,\n]\n")
    assert tomllib.loads(rendered)["headingFontWeights"] == [800, 700]


def test_dumps_font_faces_stay_inside_theme_section() -> None:
    """Inline font faces stay under the ``[theme]`` header config show prints.

    A long face must not become ``[[fontFaces]]``, which would close ``[theme]``.
    """
    rendered = toml_writer.dumps(
        {
            "fontFaces": [
                {
                    "family": "A very long family name that might exceed one line",
                    "url": "https://example.com/fonts/extremely/long/path/font_file.woff2",
                    "unicodeRange": "U+0000-00FF",
                    "style": "normal",
                    "weight": "400",
                }
            ]
        }
    )
    parsed = tomllib.loads("[theme]\n" + rendered)
    assert "fontFaces" not in parsed
    assert parsed["theme"]["fontFaces"][0]["weight"] == "400"


def test_dumps_empty_dict_inside_array_is_inline() -> None:
    """An empty font-face table is ``{}``, not its own table header."""
    assert toml_writer.dumps({"fontFaces": [{}]}) == ("fontFaces = [\n    {},\n]\n")


def test_dumps_short_font_face_is_an_inline_table() -> None:
    """A font face is one inline table inside the multiline array."""
    rendered = toml_writer.dumps(
        {
            "fontFaces": [
                {
                    "family": "font_name",
                    "url": "app/static/font_file.woff",
                    "weight": "400",
                    "style": "normal",
                }
            ]
        }
    )
    assert rendered == (
        "fontFaces = [\n"
        '    { family = "font_name", url = "app/static/font_file.woff",'
        ' weight = "400", style = "normal" },\n'
        "]\n"
    )


def test_dumps_quoted_key_round_trips() -> None:
    """Keys that are not bare TOML identifiers are quoted."""
    rendered = toml_writer.dumps({"headers": {"X-User Name": "email"}})
    assert rendered == '[headers]\n"X-User Name" = "email"\n'
    assert tomllib.loads(rendered)["headers"]["X-User Name"] == "email"


@pytest.mark.parametrize(
    "value",
    [None, date(2020, 1, 1), b"abc", {1, 2}, object()],
    ids=["none", "date", "bytes", "set", "object"],
)
def test_dumps_rejects_unsupported_values(value: object) -> None:
    """Values outside the credentials and config shapes are rejected."""
    with pytest.raises(TypeError, match="Cannot write"):
        toml_writer.dumps({"value": value})


def test_dumps_rejects_non_dict_document() -> None:
    """A list is not a TOML document."""
    with pytest.raises(TypeError, match="dict"):
        toml_writer.dumps(["not", "a", "dict"])  # type: ignore[arg-type]


def test_dumps_rejects_non_string_key() -> None:
    """Mapping keys have to be strings."""
    with pytest.raises(TypeError, match="strings"):
        toml_writer.dumps({1: "value"})  # type: ignore[dict-item]


def test_dumps_rejects_multiline_value_inside_inline_table() -> None:
    """A list inside a font-face table cannot be written on one line."""
    with pytest.raises(TypeError, match="Key 'family' serializes with a newline"):
        toml_writer.dumps({"fontFaces": [{"family": ["sans", "serif"]}]})


def test_dumps_tuple_array_round_trips() -> None:
    """A tuple is written as an array and parses back as a list."""
    parsed = tomllib.loads(toml_writer.dumps({"weights": (800, 700)}))
    assert parsed["weights"] == [800, 700]


def test_dumps_dict_value_becomes_table_section() -> None:
    """A dict value is a table section that can hold a scalar and an array."""
    rendered = toml_writer.dumps({"server": {"port": 8501, "folderWatchList": ["."]}})
    assert rendered == ('[server]\nport = 8501\nfolderWatchList = [\n    ".",\n]\n')
