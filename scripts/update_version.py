#!/usr/bin/env python
# Copyright 2018-2021 Streamlit Inc.
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

"""Update version number across the entire repo.

If the current version is 0.15.2 and I wanted to create a release for
local development, ie make a wheel file and make either a conda or pex
package to test on OSX or linux.  What should I call the next version?

If its a patch change, then only the third number being edited. If
its a minor change then its the second number.  In this example, we're
doing a patch change.

The public released dev version would be
0.15.3-dev0

For local development it would be
0.15.3-dev0+USERNAME0

If you iterate your local dev version it would then be
0.15.3-dev0+USERNAME1

You then release it for testing.
0.15.3-dev0

Someone finds a bug so you release a new internal version for testing.
0.15.3-dev1+USERNAME0

Then we can go to alpha, rc1, rc2, etc. but eventually its
0.15.3
"""
import fileinput
import logging
import os
import re
import sys

import packaging.version

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# Warning: Advanced regex foo.
# If another file has a version number that needs updating, add it here.
# These regex's are super greedy in that it actually matches everything
# but the version number so we can throw any valid PEP440 version in
# there.
PYTHON = {"lib/setup.py": r"(?P<pre>.*VERSION = \").*(?P<post>\"  # PEP-440$)"}

NODE = {"frontend/package.json": r'(?P<pre>^  "version": ").*(?P<post>",$)'}


def verify_pep440(version):
    """Verify if version is PEP440 compliant.

    https://github.com/pypa/packaging/blob/16.7/packaging/version.py#L191

    We might need pre, post, alpha, rc in the future so might as well
    use an object that does all that.  This verifies its a valid
    version.
    """

    try:
        return packaging.version.Version(version)
    except packaging.version.InvalidVersion as e:
        raise (e)


def update_files(data, python=True):
    """Update files with new version number."""

    if len(sys.argv) != 2:
        e = Exception('Specify PEP440 version: "%s 1.2.3"' % sys.argv[0])
        raise (e)

    version = verify_pep440(sys.argv[1])

    # Use normal sem versions for non python things ie node.
    if not python:
        version = version.base_version

    for filename, regex in data.items():
        filename = os.path.join(BASE_DIR, filename)
        matched = False
        pattern = re.compile(regex)
        for line in fileinput.input(filename, inplace=True):
            if pattern.match(line.rstrip()):
                matched = True
            line = re.sub(regex, r"\g<pre>%s\g<post>" % version, line.rstrip())
            print(line)
        if not matched:
            raise Exception('In file "%s", did not find regex "%s"' % (filename, regex))


def main():
    """Run main loop."""

    update_files(PYTHON)
    update_files(NODE, python=False)


if __name__ == "__main__":
    main()
