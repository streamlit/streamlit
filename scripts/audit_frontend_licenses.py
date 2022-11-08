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

"""Audit the licenses of all our frontend dependencies (as defined by our
`yarn.lock` file). If any dependency has an unacceptable license, print it
out and exit with an error code. If all dependencies have acceptable licenses,
exit normally.
"""

import json
import subprocess
import sys
from pathlib import Path
from typing import NoReturn, Set, Tuple, cast

from typing_extensions import TypeAlias

PackageInfo: TypeAlias = Tuple[str, str, str, str, str, str]

SCRIPT_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = SCRIPT_DIR.parent / "frontend"

# Set of acceptable licenses. If a library uses one of these licenses,
# we can include it as a dependency.
ACCEPTABLE_LICENSES = {
    "MIT",  # https://opensource.org/licenses/MIT
    "Apache-2.0",  # https://opensource.org/licenses/Apache-2.0
    "Apache-2.0 WITH LLVM-exception",  # https://spdx.org/licenses/LLVM-exception.html
    "0BSD",  # https://opensource.org/licenses/0BSD
    "BSD-2-Clause",  # https://opensource.org/licenses/BSD-2-Clause
    "BSD-3-Clause",  # https://opensource.org/licenses/BSD-3-Clause
    "ISC",  # https://opensource.org/licenses/ISC
    "CC0-1.0",  # https://creativecommons.org/publicdomain/zero/1.0/
    "CC-BY-3.0",  # https://creativecommons.org/licenses/by/3.0/
    "CC-BY-4.0",  # https://creativecommons.org/licenses/by/4.0/
    "Zlib",  # https://opensource.org/licenses/Zlib
    "Unlicense",  # https://unlicense.org/
    "WTFPL",  # http://www.wtfpl.net/about/
    "MPL-2.0",  # https://opensource.org/licenses/MPL-2.0
    # Dual-licenses are acceptable if at least one of the two licenses is
    # acceptable.
    "(MIT OR Apache-2.0)",
    "(MPL-2.0 OR Apache-2.0)",
    "(MIT OR CC0-1.0)",
    "(Apache-2.0 OR MPL-1.1)",
    "(BSD-3-Clause OR GPL-2.0)",
    "(MIT AND BSD-3-Clause)",
    "(MIT AND Zlib)",
    "(WTFPL OR MIT)",
}

# Some of our dependencies have licenses that yarn fails to parse, but that
# are still acceptable. This set contains all those exceptions. Each entry
# should include a comment about why it's an exception.
PACKAGE_EXCEPTIONS: Set[PackageInfo] = {
    (
        # MIT license: https://github.com/mapbox/jsonlint
        "@mapbox/jsonlint-lines-primitives",
        "2.0.2",
        "UNKNOWN",
        "git://github.com/mapbox/jsonlint.git",
        "http://zaa.ch",
        "Zach Carter",
    ),
    (
        # Apache 2.0 license: https://github.com/google/flatbuffers
        "flatbuffers",
        "2.0.4",
        "SEE LICENSE IN LICENSE.txt",
        "git+https://github.com/google/flatbuffers.git",
        "https://google.github.io/flatbuffers/",
        "The FlatBuffers project",
    ),
    (
        # Mapbox Web SDK license: https://github.com/mapbox/mapbox-gl-js/blob/main/LICENSE.txt
        "mapbox-gl",
        "1.13.0",
        "SEE LICENSE IN LICENSE.txt",
        "git://github.com/mapbox/mapbox-gl-js.git",
        "Unknown",
        "Unknown",
    ),
    (
        # Mapbox Web SDK license: https://github.com/mapbox/mapbox-gl-js/blob/main/LICENSE.txt
        "mapbox-gl",
        "1.10.1",
        "SEE LICENSE IN LICENSE.txt",
        "git://github.com/mapbox/mapbox-gl-js.git",
        "Unknown",
        "Unknown",
    ),
    (
        # MIT license: https://github.com/dy/image-palette
        "image-palette",
        "2.1.0",
        "MIT*",
        "https://github.com/dy/image-palette.git",
        "Unknown",
        "Dmitry Yv",
    ),
}


def get_license_type(package: PackageInfo) -> str:
    """Return the license type string for a dependency entry."""
    return package[2]


def main() -> NoReturn:
    # Run `yarn licenses list --json`.
    licenses_output = (
        subprocess.check_output(
            ["yarn", "licenses", "list", "--json", "--production", "--ignore-platform"],
            cwd=str(FRONTEND_DIR),
        )
        .decode()
        .splitlines()
    )

    # `yarn licenses` outputs a bunch of lines.
    # The last line contains the JSON object we care about
    licenses_json = json.loads(licenses_output[len(licenses_output) - 1])
    assert licenses_json["type"] == "table"

    # Pull out the list of package infos from the JSON.
    packages = [
        cast(PackageInfo, tuple(package)) for package in licenses_json["data"]["body"]
    ]

    # Discover dependency exceptions that are no longer used and can be
    # jettisoned, and print them out with a warning.
    unused_exceptions = PACKAGE_EXCEPTIONS.difference(set(packages))
    if len(unused_exceptions) > 0:
        for exception in sorted(list(unused_exceptions)):
            print(f"Unused package exception, please remove: {exception}")

    # Discover packages that don't have an acceptable license, and that don't
    # have an explicit exception. If we have any, we print them out and exit
    # with an error.
    bad_packages = [
        package
        for package in packages
        if (get_license_type(package) not in ACCEPTABLE_LICENSES)
        and (package not in PACKAGE_EXCEPTIONS)
    ]

    if len(bad_packages) > 0:
        for package in bad_packages:
            print(f"Unacceptable license: '{get_license_type(package)}' (in {package})")
        print(f"{len(bad_packages)} unacceptable licenses")
        sys.exit(1)

    print(f"No unacceptable licenses")
    sys.exit(0)


if __name__ == "__main__":
    main()
