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

"""Update the list of material icon names in `lib/streamlit/material_icon_names.py.

And download the latest material symbols font file to
./frontend/app/src/assets/fonts/MaterialSymbols/MaterialSymbols-Rounded.woff2
"""

from __future__ import annotations

import os
import re
import sys
import urllib.request

import requests

from streamlit.material_icon_names import ALL_MATERIAL_ICONS

MATERIAL_ICONS_CODEPOINTS_URL = "https://raw.githubusercontent.com/google/material-design-icons/master/variablefont/MaterialSymbolsRounded%5BFILL%2CGRAD%2Copsz%2Cwght%5D.codepoints"
MATERIAL_ICONS_FONT_URL = (
    "https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded"
)
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
NAMES_SET_REGEX = re.compile(
    r"### MATERIAL ICON NAMES START ###(.+?)### MATERIAL ICON NAMES END ###", re.DOTALL
)

PLAYWRIGHT_TEST_REGEX = re.compile(
    r"### LATEST MATERIAL ICON TEST START ###(.+?)### LATEST MATERIAL ICON TEST END ###",
    re.DOTALL,
)

FONT_FILE_URL_REGEX = (
    r"url\((https://fonts\.gstatic\.com/s/materialsymbolsrounded/[^\)]+)\)"
)

NAMES_MODULE_PATH = os.path.join(BASE_DIR, "lib", "streamlit", "material_icon_names.py")
FONT_FILE_PATH = os.path.join(
    BASE_DIR,
    "frontend",
    "app",
    "src",
    "assets",
    "fonts",
    "MaterialSymbols",
    "MaterialSymbols-Rounded.woff2",
)
PLAYWRIGHT_TEST_MODULE_PATH = os.path.join(BASE_DIR, "e2e_playwright", "st_alert.py")


# Fetch the content from the URL
with urllib.request.urlopen(MATERIAL_ICONS_CODEPOINTS_URL) as response:
    content = response.read().decode("utf-8")

# Split the content by lines
lines = content.splitlines()

# Create a set to store unique names
icon_names = set()

# Extract the first word from each line and add it to the set
for line in lines:
    name = line.split()[0]
    icon_names.add(name)

new_icon_names = icon_names.difference(ALL_MATERIAL_ICONS)

print(f"Existing number of icon names: {len(ALL_MATERIAL_ICONS)}")
print(f"New number of icon names:  {len(icon_names)}")
print(f"New icon names:  {new_icon_names}")


if len(icon_names) == len(ALL_MATERIAL_ICONS):
    print("No new icon names found. Exiting.")
    sys.exit(0)

generated_code = f"""### MATERIAL ICON NAMES START ###
ALL_MATERIAL_ICONS = {{{", ".join([f'"{icon_name}"' for icon_name in sorted(icon_names)])}}}
### MATERIAL ICON NAMES END ###"""

with open(NAMES_MODULE_PATH) as file:
    script_content = file.read()

updated_script_content = re.sub(NAMES_SET_REGEX, generated_code, script_content)

with open(NAMES_MODULE_PATH, "w") as file:
    file.write(updated_script_content)

# Fetch the content from the URL
# We use custom User-Agent header here to get .woff2 font instead of .ttf
response = requests.get(
    MATERIAL_ICONS_FONT_URL,
    headers={
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_1) AppleWebKit/605.1.15 "
        "(KHTML, like Gecko) Version/17.4.1 Safari/605.1.15"
    },
)


# Search for the font file URL in the response
match = re.search(FONT_FILE_URL_REGEX, response.text)

font_url = None

if match:
    font_url = match.group(1)
    print("Extracted URL:", font_url)
else:
    print("URL not found")
    sys.exit(1)

# Download the font file from the URL
if font_url is not None:
    font_file = requests.get(font_url)
    with open(FONT_FILE_PATH, "wb") as file:
        file.write(font_file.content)
        print("Font file downloaded and replaced successfully")
else:
    print("Font file not downloaded")
    sys.exit(1)


icon_from_latest_font = next(iter(new_icon_names))

generated_code = f"""### LATEST MATERIAL ICON TEST START ###
st.success(
    "Success message to test material icon from latest material symbols font",
    icon=":material/{icon_from_latest_font}:",
)
### LATEST MATERIAL ICON TEST END ###"""

with open(PLAYWRIGHT_TEST_MODULE_PATH) as file:
    script_content = file.read()

updated_script_content = re.sub(PLAYWRIGHT_TEST_REGEX, generated_code, script_content)
with open(PLAYWRIGHT_TEST_MODULE_PATH, "w") as file:
    file.write(updated_script_content)
