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

""" Checks for the latest release candidate for the current version.

Gets all releases from PyPI, filters for release candidates of the current streamlit version.
If there is an existing RC, prints that RC version. If there is no RC, returns None.
"""
import os

import requests


def check_last_rc():
    """Checks PyPI for existing release candidates"""

    current_version = os.getenv("DESIRED_VERSION")

    url = "https://pypi.org/pypi/streamlit/json"
    response = requests.get(url).json()
    all_releases = response["releases"].keys()

    current_version_candidates = sorted(
        [x for x in all_releases if "rc" in x and current_version in x]
    )

    if current_version_candidates:
        latest_release_candidate = current_version_candidates[-1]
        return latest_release_candidate
    else:
        return None


def main():

    print(check_last_rc())


if __name__ == "__main__":
    main()
