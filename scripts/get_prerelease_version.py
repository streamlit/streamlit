#!/usr/bin/env python
# Copyright 2022 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Calculate the next appropriate pre-release based on the target version.

- If the current version is the same as the target version, increment the pre-release only
- If the current version is less than the target version, first update the version to match, then
increment the pre-release version

A few examples:

- Target: 1.6.0
  Current: 1.5.1
  Output: 1.6.0-rc1

- Target: 1.6.0
  Current:1.6.0-rc1
  Output: 1.6.0-rc2

"""

import fileinput
import os
import re
import sys

import semver

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def get_current_version():
    """Retrieve the current version by searching for a matching regex ('VERSION=') in setup.py"""
    filename = os.path.join(BASE_DIR, "lib/setup.py")
    regex = r"(?P<pre>.*VERSION = \")(.*)(?P<post>\"  # PEP-440$)"
    pattern = re.compile(regex)

    for line in fileinput.input(filename):
        match = pattern.match(line.rstrip())
        if match:
            return match.groups()[1]

    raise Exception('Did not find regex "%s" for version in setup.py' % (regex))


def main():
    if len(sys.argv) != 2:
        raise Exception(
            'Specify target version as an argument: "%s 1.2.3"' % sys.argv[0]
        )

    target_version = semver.VersionInfo.parse(sys.argv[1])
    current_version = semver.VersionInfo.parse(get_current_version().replace("rc.", "-rc"))

    if current_version.finalize_version() < target_version:
        current_version = target_version

    print(str(current_version.bump_prerelease()).replace("-rc.", "rc"))


if __name__ == "__main__":
    main()
