#!/usr/bin/env python

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
