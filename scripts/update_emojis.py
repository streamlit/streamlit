#!/usr/bin/env python

# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import os
import re

from emoji.unicode_codes.data_dict import EMOJI_DATA  # type: ignore

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
EMOJI_SET_REGEX = re.compile(r"ALL_EMOJIS.+?}", re.DOTALL)
EMOJIS_SCRIPT_PATH = os.path.join(BASE_DIR, "lib", "streamlit", "emojis.py")

emoji_unicodes = set(EMOJI_DATA.keys())


generated_code = 'ALL_EMOJIS = {"' + '","'.join(sorted(emoji_unicodes)) + '"}'

with open(EMOJIS_SCRIPT_PATH, "r") as file:
    script_content = file.read()

updated_script_content = re.sub(EMOJI_SET_REGEX, generated_code, script_content)

with open(EMOJIS_SCRIPT_PATH, "w") as file:
    file.write(updated_script_content)
