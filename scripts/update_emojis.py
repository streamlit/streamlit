#!/usr/bin/env python

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

"""Update the list of emojis in `lib/streamlit/emojis.py`.

Downloads Unicode's latest emoji-test.txt and regenerates ALL_EMOJIS.
"""

from __future__ import annotations

import json
import os
import re
import sys
import urllib.request
from typing import Final

_BASE_DIR: Final[str] = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
_EMOJI_SET_REGEX: Final[re.Pattern[str]] = re.compile(
    r"### EMOJIS START ###(.+?)### EMOJIS END ###", re.DOTALL
)
_EMOJIS_MODULE_PATH: Final[str] = os.path.join(
    _BASE_DIR, "lib", "streamlit", "emojis.py"
)
_EMOJI_TEST_URL: Final[str] = (
    "https://www.unicode.org/Public/emoji/latest/emoji-test.txt"
)
# emoji-test.txt currently has ~5k sequences. A much smaller parse means a
# truncated or non-data response and must not overwrite the generated list.
_MIN_EMOJI_COUNT: Final[int] = 4000


def _parse_emoji_test(content: str) -> tuple[set[str], str]:
    """Parse all emoji sequences and the Unicode emoji version from emoji-test.txt."""
    emojis: set[str] = set()
    version = "unknown"

    for line in content.splitlines():
        if line.startswith("# Version:"):
            version = line.removeprefix("# Version:").strip()
            continue
        if not line or line.startswith("#"):
            continue

        # Keep every status (fully-/minimally-/unqualified and component).
        # is_emoji strips U+FE0F before lookup, so unqualified forms must stay
        # in the set; FE0F-containing forms are never looked up there.
        # Fully-qualified FE0F forms must also stay so extract_leading_emoji /
        # EMOJI_EXTRACTION_REGEX consumes the variation selector instead of
        # leaving it on the remaining text.
        codepoints = line.split(";", 1)[0].split()
        if codepoints:
            try:
                emojis.add("".join(chr(int(cp, base=16)) for cp in codepoints))
            except ValueError:
                print(f"Unexpected line in emoji-test.txt: {line!r}. Aborting.")
                sys.exit(1)

    return emojis, version


def _abort_if_invalid_parse(emojis: set[str], version: str) -> None:
    """Exit if emoji-test.txt looks truncated or malformed."""
    if version == "unknown":
        print("Failed to parse Unicode emoji version from emoji-test.txt. Aborting.")
        sys.exit(1)
    if len(emojis) < _MIN_EMOJI_COUNT:
        print(
            f"Parsed only {len(emojis)} emojis from emoji-test.txt; "
            f"expected at least {_MIN_EMOJI_COUNT}. Aborting."
        )
        sys.exit(1)


def _abort_if_unexpected_removals(removed: set[str]) -> None:
    """Exit if the parse dropped sequences from the committed set.

    Encoding stability does not un-assign code points, but UTS #51 does not
    freeze the RGI / emoji-test.txt set, so a sequence can leave the file
    without the download being truncated. Fail closed so unattended weekly
    runs cannot drop committed sequences; a non-empty removed set needs
    manual review rather than an automatic rewrite.
    """
    if removed:
        print(
            "Aborting: parse would remove committed emoji sequences. This "
            "needs manual review before changing ALL_EMOJIS. Removed "
            f"({len(removed)}): {''.join(sorted(removed))}"
        )
        sys.exit(1)


def _generated_emoji_set_block(emojis: set[str]) -> str:
    """Return the marked ALL_EMOJIS assignment to splice into emojis.py."""
    # json.dumps keeps double-quoted literals matching the committed file.
    literals = ", ".join(
        json.dumps(emoji, ensure_ascii=False) for emoji in sorted(emojis)
    )
    return f"""### EMOJIS START ###
ALL_EMOJIS = {{{literals}}}
### EMOJIS END ###"""


def _main() -> None:
    # Import here so unit tests can load this script without importing streamlit.
    from streamlit.emojis import ALL_EMOJIS

    try:
        with urllib.request.urlopen(_EMOJI_TEST_URL, timeout=30) as response:
            content = response.read().decode("utf-8")
    except OSError as exc:
        print(f"Failed to download {_EMOJI_TEST_URL}: {exc}")
        sys.exit(1)

    emojis, emoji_version = _parse_emoji_test(content)
    _abort_if_invalid_parse(emojis, emoji_version)

    added = emojis - ALL_EMOJIS
    removed = ALL_EMOJIS - emojis

    print(f"Unicode emoji version: {emoji_version}")
    print(f"Existing emoji collection: {len(ALL_EMOJIS)}")
    print(f"New emoji collection:  {len(emojis)}")
    print(f"Added: {len(added)}")
    print(f"Removed: {len(removed)}")

    if not added and not removed:
        print("No emoji changes. Exiting.")
        sys.exit(0)

    if added:
        print(f"New emojis: {''.join(sorted(added))}")
    _abort_if_unexpected_removals(removed)

    generated_code = _generated_emoji_set_block(emojis)

    with open(_EMOJIS_MODULE_PATH, encoding="utf-8") as file:
        script_content = file.read()

    updated_script_content = re.sub(
        _EMOJI_SET_REGEX, lambda _: generated_code, script_content
    )
    if updated_script_content == script_content:
        print(f"Could not find emoji markers in {_EMOJIS_MODULE_PATH}. Aborting.")
        sys.exit(1)

    with open(_EMOJIS_MODULE_PATH, "w", encoding="utf-8") as file:
        file.write(updated_script_content)


if __name__ == "__main__":
    _main()
