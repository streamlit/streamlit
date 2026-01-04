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

"""Synchronize ruff version between dev-requirements.txt and pre-commit config.

This script ensures that the ruff version specified in lib/dev-requirements.txt
matches the version in .pre-commit-config.yaml. It can either check if the
versions are in sync or update the pre-commit config to match.

Examples
--------
Check if versions are in sync:

    $ python scripts/sync_ruff_version.py --check

Synchronize versions (update pre-commit config to match dev-requirements.txt):

    $ python scripts/sync_ruff_version.py
"""

from __future__ import annotations

import argparse
import os
import re
import sys


def _get_repo_root() -> str:
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _get_ruff_version_from_dev_requirements(repo_root: str) -> str | None:
    dev_requirements_path = os.path.join(repo_root, "lib", "dev-requirements.txt")
    try:
        with open(dev_requirements_path, encoding="utf-8") as f:
            for line in f:
                stripped_line = line.strip()
                match = re.match(r"^ruff==([0-9]+\.[0-9]+\.[0-9]+)$", stripped_line)
                if match:
                    return match.group(1)
    except FileNotFoundError:
        print(f"Error: File not found: {dev_requirements_path}")
        return None
    return None


def _get_ruff_version_from_pre_commit_config(repo_root: str) -> str | None:
    pre_commit_config_path = os.path.join(repo_root, ".pre-commit-config.yaml")
    try:
        with open(pre_commit_config_path, encoding="utf-8") as f:
            content = f.read()
            # Use re.DOTALL to handle variable number of lines between repo and rev
            match = re.search(
                r"repo:\s*https://github\.com/astral-sh/ruff-pre-commit.*?rev:\s*v([0-9]+\.[0-9]+\.[0-9]+)",
                content,
                re.DOTALL,
            )
            if match:
                return match.group(1)
    except FileNotFoundError:
        print(f"Error: File not found: {pre_commit_config_path}")
        return None
    return None


def _update_pre_commit_config(repo_root: str, new_version: str) -> bool:
    pre_commit_config_path = os.path.join(repo_root, ".pre-commit-config.yaml")
    try:
        with open(pre_commit_config_path, encoding="utf-8") as f:
            content = f.read()

        # Use re.DOTALL to handle variable number of lines between repo and rev
        pattern = r"(repo:\s*https://github\.com/astral-sh/ruff-pre-commit.*?rev:\s*v)[0-9]+\.[0-9]+\.[0-9]+"
        new_content = re.sub(pattern, rf"\g<1>{new_version}", content, flags=re.DOTALL)

        if new_content == content:
            print("Warning: No changes made to .pre-commit-config.yaml")
            return False

        with open(pre_commit_config_path, "w", encoding="utf-8") as f:
            f.write(new_content)

        print(f"Updated .pre-commit-config.yaml to ruff version v{new_version}")
        return True
    except OSError as e:
        print(f"Error updating .pre-commit-config.yaml: {e}")
        return False


def check_sync_status(repo_root: str) -> bool:
    """Check if ruff versions are in sync between config files.

    Parameters
    ----------
    repo_root : str
        Path to the repository root directory.

    Returns
    -------
    bool
        True if versions are in sync, False otherwise.
    """
    dev_req_version = _get_ruff_version_from_dev_requirements(repo_root)
    pre_commit_version = _get_ruff_version_from_pre_commit_config(repo_root)

    if dev_req_version is None:
        print("Error: Could not find ruff version in lib/dev-requirements.txt")
        return False

    if pre_commit_version is None:
        print("Error: Could not find ruff version in .pre-commit-config.yaml")
        return False

    if dev_req_version != pre_commit_version:
        print("❌ Ruff versions are out of sync:")
        print(f"   lib/dev-requirements.txt: {dev_req_version}")
        print(f"   .pre-commit-config.yaml: v{pre_commit_version}")
        return False

    print(f"✅ Ruff versions are in sync: {dev_req_version}")
    return True


def sync_versions(repo_root: str) -> bool:
    """Sync ruff version from dev-requirements.txt to pre-commit config.

    Parameters
    ----------
    repo_root : str
        Path to the repository root directory.

    Returns
    -------
    bool
        True if already in sync, False if modified or on error.
        Returns False after modifications so pre-commit hooks fail and
        prompt the user to stage the changes.
    """
    dev_req_version = _get_ruff_version_from_dev_requirements(repo_root)

    if dev_req_version is None:
        print("Error: Could not find ruff version in lib/dev-requirements.txt")
        return False

    pre_commit_version = _get_ruff_version_from_pre_commit_config(repo_root)

    if pre_commit_version is None:
        print("Error: Could not find ruff version in .pre-commit-config.yaml")
        return False

    if dev_req_version == pre_commit_version:
        print(f"✅ Ruff versions already in sync: {dev_req_version}")
        return True

    print(f"Syncing ruff version from {pre_commit_version} to {dev_req_version}...")
    if _update_pre_commit_config(repo_root, dev_req_version):
        # Return False after modifying so pre-commit fails and user stages changes
        print("Please stage the updated .pre-commit-config.yaml and commit again.")
        return False
    return False


def _parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Sync ruff version from lib/dev-requirements.txt to .pre-commit-config.yaml"
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Check if versions are in sync without modifying files.",
    )
    return parser.parse_args()


def main() -> None:
    """Entry point for the ruff version sync script.

    Parses command line arguments and executes the appropriate sync or check
    operation. Exits with status 0 on success, 1 on failure.
    """
    args = _parse_arguments()
    repo_root = _get_repo_root()

    if args.check:
        print("🔍 Checking ruff version sync...")
        success = check_sync_status(repo_root)
    else:
        print("🔄 Syncing ruff version...")
        success = sync_versions(repo_root)

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
