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

"""Retrieve the branch name from the release PR"""
import requests


# Assumes there is only one open pull request with a release/ branch
def check_for_release_pr(pull):
    label = pull["head"]["label"]

    if label.find("release/") != -1:
        return pull["head"]["ref"]


def get_release_branch():
    """Retrieve the release branch from the release PR"""

    url = "https://api.github.com/repos/streamlit/streamlit/pulls"
    response = requests.get(url).json()

    # Response is in an array, must map over each pull (dict)
    for pull in response:
        ref = check_for_release_pr(pull)
        if ref != None:
            return ref


def main():

    print(get_release_branch())


if __name__ == "__main__":
    main()
