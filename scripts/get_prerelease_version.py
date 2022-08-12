#!/usr/bin/env python
"""Calculate the next pre-release semver based on the target version and store in a version file.

This has a small hack to get the pipeline on CircleCI to work properly. The command may run
multiple times, so this file is idempotent for each release build. To accomplish this, we store the
version into a file on the first run. Any subsequent calls will return the file contents if the file
exists instead of recalculating the release version.

- If a version exists in the version file, return the file contents.
- If the current version is the same as the target version, increment the pre-release only
- If the current version is less than the target version, first update the version to match, then
increment the pre-release version

A few examples:

- Target:   1.6.0
  Current:  1.5.1
  Output:   1.6.0-rc1

- Target:   1.6.0
  Current:  1.6.0-rc1
  Output:   1.6.0-rc2
"""

import fileinput
import os
import re
import sys

import semver

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
VERSION_FILE = ".prerelease-version"


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
    if os.path.exists(VERSION_FILE):
        with open(VERSION_FILE) as f:
            print(f.read())
            return

    if len(sys.argv) != 2:
        raise Exception(
            'Specify target version as an argument: "%s 1.2.3"' % sys.argv[0]
        )

    target_version = semver.VersionInfo.parse(sys.argv[1])
    # Ensure that current version is semver-compliant (it's stored as PEP440-compliant in setup.py)
    current_version = semver.VersionInfo.parse(
        get_current_version().replace("rc", "-rc.")
    )

    if current_version.finalize_version() < target_version:
        current_version = target_version

    new_version = str(current_version.bump_prerelease())
    with open(VERSION_FILE, "w") as f:
        f.write(new_version)

    print(new_version)


if __name__ == "__main__":
    main()
