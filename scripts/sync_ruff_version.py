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
            match = re.search(
                r"repo:\s*https://github\.com/astral-sh/ruff-pre-commit\s*\n\s*.*\n\s*rev:\s*v([0-9]+\.[0-9]+\.[0-9]+)",
                content,
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

        pattern = r"(repo:\s*https://github\.com/astral-sh/ruff-pre-commit\s*\n\s*.*\n\s*rev:\s*v)[0-9]+\.[0-9]+\.[0-9]+"
        new_content = re.sub(pattern, rf"\g<1>{new_version}", content)

        if new_content == content:
            print("Warning: No changes made to .pre-commit-config.yaml")
            return False

        with open(pre_commit_config_path, "w", encoding="utf-8") as f:
            f.write(new_content)

        print(f"Updated .pre-commit-config.yaml to ruff version v{new_version}")
        return True
    except Exception as e:
        print(f"Error updating .pre-commit-config.yaml: {e}")
        return False


def check_sync_status(repo_root: str) -> bool:
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
    return _update_pre_commit_config(repo_root, dev_req_version)


def _parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Sync ruff version from lib/dev-requirements.txt to .pre-commit-config.yaml"
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Check if versions are in sync without modifying files (useful for pre-commit hooks)",
    )
    return parser.parse_args()


def main() -> None:
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
