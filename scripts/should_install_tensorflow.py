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

# Used by our Makefile to check if Python.version <= 3.9
# There are surely better ways to do this, but Make is a beast I can't tame.

import os
import sys
from pathlib import Path

is_docker = Path("/.dockerenv").exists() or "IS_DOCKER" in os.environ
is_m1_mac = (os.uname().sysname, os.uname().machine) == ("Darwin", "arm64")
is_python_39_or_earlier = (sys.version_info.major, sys.version_info.minor) <= (3, 9)

if is_python_39_or_earlier and not is_m1_mac and not is_docker:
    print("true")
else:
    print("false")
