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

import json
import subprocess
import sys
from pathlib import Path
from typing import List

SCRIPT_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = SCRIPT_DIR.parent / "frontend"

ACCEPTABLE_LICENSES = {
    "MIT",  # https://opensource.org/licenses/MIT
    "Apache-2.0",  # https://opensource.org/licenses/Apache-2.0
    "BSD-3-Clause",  # https://opensource.org/licenses/BSD-3-Clause
    "ISC",  # https://opensource.org/licenses/ISC
    "BSD-2-Clause",  # https://opensource.org/licenses/BSD-2-Clause
    "CC0-1.0",  # https://creativecommons.org/publicdomain/zero/1.0/
    "0BSD",  # https://opensource.org/licenses/0BSD
    "CC-BY-3.0",  # https://creativecommons.org/licenses/by/3.0/
    "CC-BY-4.0",  # https://creativecommons.org/licenses/by/4.0/
    "Zlib",  # https://opensource.org/licenses/Zlib
    "Apache-2.0 WITH LLVM-exception",  # https://spdx.org/licenses/LLVM-exception.html
    "(MIT OR Apache-2.0)",
    "(MPL-2.0 OR Apache-2.0)",
    "(MIT OR CC0-1.0)",
    "(Apache-2.0 OR MPL-1.1)",
    "(BSD-3-Clause OR GPL-2.0)",
    "(MIT AND BSD-3-Clause)",
    "(MIT AND Zlib)",
    "(WTFPL OR MIT)",
}


def get_license_type(entry: List[str]) -> str:
    """Return the license type string for a dependency entry."""
    return entry[2]


def main() -> None:
    licenses_output = (
        subprocess.check_output(
            ["yarn", "licenses", "list", "--json"], cwd=str(FRONTEND_DIR)
        )
        .decode()
        .splitlines()
    )

    # `yarn licenses list --json` outputs a bunch of lines.
    # The last line contains the JSON object we care about
    licenses_json = json.loads(licenses_output[len(licenses_output) - 1])
    assert licenses_json["type"] == "table"

    # Each entry in the list contains info about a dependency's license.
    entries = licenses_json["data"]["body"]
    bad_entries = [
        entry for entry in entries if get_license_type(entry) not in ACCEPTABLE_LICENSES
    ]

    if len(bad_entries) > 0:
        for entry in bad_entries:
            print(f"Unacceptable license '{get_license_type(entry)}' (in {entry})")
        print(f"{len(bad_entries)} unacceptable licenses")
        sys.exit(1)

    print(f"No unacceptable licenses")


if __name__ == "__main__":
    main()
