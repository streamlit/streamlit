#!/usr/bin/env python
# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

"""Verify that the git tag matches the package version.

This script replaces the VerifyVersionCommand in setup.py for use with
pyproject.toml-based builds.

Usage:
    TAG=1.53.0 python scripts/verify_version.py
    # or
    python scripts/verify_version.py --tag 1.53.0
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

# tomllib is available in Python 3.11+, use tomli as fallback for Python 3.10
try:
    import tomllib
except ImportError:
    import tomli as tomllib


def get_package_version() -> str:
    """Read the version from lib/pyproject.toml."""
    pyproject_path = Path(__file__).parent.parent / "lib" / "pyproject.toml"

    with open(pyproject_path, "rb") as f:
        pyproject = tomllib.load(f)

    version: str = pyproject["project"]["version"]
    return version


def main() -> None:
    """Verify git tag matches pyproject.toml version."""
    parser = argparse.ArgumentParser(
        description="Verify that the git tag matches the package version"
    )
    parser.add_argument(
        "--tag",
        help="The git tag to verify (defaults to TAG environment variable)",
    )
    args = parser.parse_args()

    # Get tag from argument or environment variable
    tag = args.tag or os.getenv("TAG")
    if not tag:
        sys.exit(
            "Error: No tag provided. Use --tag argument or set TAG environment variable."
        )

    version = get_package_version()

    if tag != version:
        sys.exit(f"Error: Git tag '{tag}' does not match package version '{version}'")

    print(f"Version verified: {version}")


if __name__ == "__main__":
    main()
