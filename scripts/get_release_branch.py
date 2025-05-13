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

"""Retrieve the branch name from the release PR."""

from __future__ import annotations

from typing import Any, cast

import requests


# Assumes there is only one open pull request with a release/ branch
def check_for_release_pr(pull: dict[str, Any]) -> str | None:
    label = pull["head"]["label"]

    if label.find("release/") != -1:
        return cast("str", pull["head"]["ref"])
    return None


def get_release_branch() -> str | None:
    """Retrieve the release branch from the release PR."""

    url = "https://api.github.com/repos/streamlit/streamlit/pulls"
    response = requests.get(url).json()

    # Response is in an array, must map over each pull (dict)
    for pull in response:
        ref = check_for_release_pr(pull)
        if ref is not None:
            return ref
    return None


def main():
    print(get_release_branch())


if __name__ == "__main__":
    main()
