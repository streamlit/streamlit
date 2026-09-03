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

import importlib.util
from pathlib import Path
from typing import TYPE_CHECKING

import pytest

if TYPE_CHECKING:
    from types import ModuleType

_REPO_ROOT = Path(__file__).resolve().parents[3]
_UPDATE_EMOJIS_SCRIPT = _REPO_ROOT / "scripts" / "update_emojis.py"

_SAMPLE_EMOJI_TEST = """\
# emoji-test.txt
# Version: 17.0
#
1F600 ; fully-qualified # 😀 E1.0 grinning face
263A FE0F ; fully-qualified # ☺️ E0.6 smiling face
263A ; unqualified # ☺ E0.6 smiling face
1F44D 1F3FD ; fully-qualified # 👍🏽 E1.0 thumbs up: medium skin tone
1F468 200D 1F469 200D 1F467 ; fully-qualified # 👨‍👩‍👧 E2.0 family
1F3FB ; component # 🏻 E1.0 light skin tone
"""


def _load_update_emojis() -> ModuleType:
    """Load ``scripts/update_emojis.py`` without executing its ``__main__`` block."""
    spec = importlib.util.spec_from_file_location(
        "update_emojis", _UPDATE_EMOJIS_SCRIPT
    )
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="module")
def update_emojis() -> ModuleType:
    """Parsed ``update_emojis`` script module."""
    return _load_update_emojis()


def test_parse_emoji_test_keeps_every_status(update_emojis: ModuleType) -> None:
    """Parser keeps fully-qualified, unqualified, ZWJ, and component sequences."""
    emojis, version = update_emojis._parse_emoji_test(_SAMPLE_EMOJI_TEST)

    assert version == "17.0"
    assert "😀" in emojis
    assert "☺️" in emojis
    assert "☺" in emojis
    assert "👍🏽" in emojis
    assert "👨‍👩‍👧" in emojis
    assert "🏻" in emojis
    assert len(emojis) == 6


def test_parse_emoji_test_skips_comments_and_blank_lines(
    update_emojis: ModuleType,
) -> None:
    """Header comments and empty lines are not treated as emoji sequences."""
    emojis, version = update_emojis._parse_emoji_test(_SAMPLE_EMOJI_TEST)

    assert "emoji-test.txt" not in emojis
    assert all(";" not in emoji for emoji in emojis)
    assert version != "unknown"


def test_parse_emoji_test_missing_version(update_emojis: ModuleType) -> None:
    """A file with no Version header reports unknown."""
    emojis, version = update_emojis._parse_emoji_test(
        "1F600 ; fully-qualified # 😀 E1.0 grinning face\n"
    )

    assert version == "unknown"
    assert emojis == {"😀"}


def test_abort_if_invalid_parse_rejects_unknown_version(
    update_emojis: ModuleType,
) -> None:
    """A missing version header must not rewrite emojis.py."""
    with pytest.raises(SystemExit, match="1"):
        update_emojis._abort_if_invalid_parse({"😀"}, "unknown")


def test_abort_if_invalid_parse_rejects_truncated_list(
    update_emojis: ModuleType,
) -> None:
    """A truncated download must not rewrite emojis.py."""
    with pytest.raises(SystemExit, match="1"):
        update_emojis._abort_if_invalid_parse({"😀"}, "17.0")
