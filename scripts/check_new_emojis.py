#!/usr/bin/env python

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

"""Update the list of emojis in `lib/streamlit/emojis.py.

This script requires the emoji package to be installed: pip install emoji.
"""

from __future__ import annotations

import sys

from emoji.unicode_codes import EMOJI_DATA

from streamlit.emojis import ALL_EMOJIS

emoji_unicodes = set(EMOJI_DATA.keys())


if len(ALL_EMOJIS) == len(emoji_unicodes):
    print("No new emojis to add.")
    sys.exit(0)
else:
    print("New emojis found. Please update emojis.py")
    sys.exit(1)
