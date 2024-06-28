#!/usr/bin/env python

# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

Please only run this when updating the material symbols font to a later version.
"""

import os
import re
import urllib.request

from streamlit.material_icon_names import ALL_MATERIAL_ICONS

MATERIAL_ICONS_CODEPOINTS_URL = "https://raw.githubusercontent.com/google/material-design-icons/master/variablefont/MaterialSymbolsOutlined%5BFILL%2CGRAD%2Copsz%2Cwght%5D.codepoints"
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
NAMES_SET_REGEX = re.compile(
    r"### MATERIAL ICON NAMES START ###(.+?)### MATERIAL ICON NAMES END ###", re.DOTALL
)
NAMES_MODULE_PATH = os.path.join(BASE_DIR, "lib", "streamlit", "material_icon_names.py")

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

print(f"Existing number of icon names: {len(ALL_MATERIAL_ICONS)}")
print(f"New number of icon names:  {len(icon_names)}")
print(f"New icon names:  {icon_names.difference(ALL_MATERIAL_ICONS)}")


generated_code = f"""### MATERIAL ICON NAMES START ###
ALL_MATERIAL_ICONS = {{{", ".join([f'"{icon_name}"' for icon_name in sorted(icon_names)])}}}
### MATERIAL ICON NAMES END ###"""

with open(NAMES_MODULE_PATH, "r") as file:
    script_content = file.read()

updated_script_content = re.sub(NAMES_SET_REGEX, generated_code, script_content)

with open(NAMES_MODULE_PATH, "w") as file:
    file.write(updated_script_content)
