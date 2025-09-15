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
import json
import os
import subprocess
import sys
from typing import Any, cast

# Extensions to exclude from devcontainer configuration file
DEVCONTAINER_EXCLUDED_EXTENSIONS = [
    "anysphere.cursorpyright",
]


class DevcontainerSync:
    """Handles synchronization between VSCode and devcontainer configurations."""

    def __init__(self, repo_root: str | None = None) -> None:
        """Initialize with repository root path.

        Parameters
        ----------
        repo_root : str | None, default None
            Repository root directory. If None, auto-detected from script location.
        """
        self.repo_root = repo_root or self._get_repo_root()
        self.vscode_settings_path = os.path.join(
            self.repo_root, ".vscode", "settings.json"
        )
        self.vscode_extensions_path = os.path.join(
            self.repo_root, ".vscode", "extensions.json"
        )
        self.devcontainer_path = os.path.join(
            self.repo_root, ".devcontainer", "devcontainer.json"
        )

    @staticmethod
    def _get_repo_root() -> str:
        """Get repository root directory from script location.

        Returns
        -------
        str
            Absolute path to the repository root directory
        """
        return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    def _load_json_file(self, file_path: str) -> dict[str, Any]:
        """Load and parse a JSON file.

        Parameters
        ----------
        file_path : str
            Path to the JSON file

        Returns
        -------
        dict[str, Any]
            Parsed JSON content as dictionary

        Raises
        ------
        SystemExit
            If file cannot be loaded or parsed
        """
        try:
            with open(file_path, encoding="utf-8") as f:
                return cast("dict[str, Any]", json.load(f))
        except FileNotFoundError:
            print(f"Error: File not found: {file_path}")
            sys.exit(1)
        except json.JSONDecodeError as e:
            print(f"Error: Invalid JSON in {file_path}: {e}")
            sys.exit(1)

    def _save_json_file(self, file_path: str, data: dict[str, Any]) -> None:
        """Save data to a JSON file with proper formatting.

        Parameters
        ----------
        file_path : str
            Path to save the JSON file
        data : dict[str, Any]
            Data to save

        Raises
        ------
        SystemExit
            If file cannot be saved
        """
        try:
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
                f.write("\n")  # Add final newline
            print(f"Successfully updated: {file_path}")
        except Exception as e:
            print(f"Error: Failed to save {file_path}: {e}")
            sys.exit(1)

    @staticmethod
    def _filter_extensions(extensions: list[str]) -> list[str]:
        """Filter out extensions that should not be included in devcontainer.

        Parameters
        ----------
        extensions : list[str]
            List of VSCode extensions

        Returns
        -------
        list[str]
            Filtered list of extensions with excluded items removed
        """
        return [
            ext for ext in extensions if ext not in DEVCONTAINER_EXCLUDED_EXTENSIONS
        ]

    def _get_devcontainer_vscode_config(
        self, devcontainer_config: dict[str, Any]
    ) -> dict[str, Any]:
        """Get or create the VSCode configuration section in devcontainer config.

        Parameters
        ----------
        devcontainer_config : dict[str, Any]
            The devcontainer configuration dictionary

        Returns
        -------
        dict[str, Any]
            The VSCode configuration section
        """
        if "customizations" not in devcontainer_config:
            devcontainer_config["customizations"] = {}

        if "vscode" not in devcontainer_config["customizations"]:
            devcontainer_config["customizations"]["vscode"] = {}

        return cast("dict[str, Any]", devcontainer_config["customizations"]["vscode"])

    def _load_all_configs(
        self,
    ) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
        """Load all configuration files.

        Returns
        -------
        tuple[dict[str, Any], dict[str, Any], dict[str, Any]]
            Tuple containing (VSCode settings, VSCode extensions, devcontainer config)
        """
        vscode_settings = self._load_json_file(self.vscode_settings_path)
        vscode_extensions = self._load_json_file(self.vscode_extensions_path)
        devcontainer_config = self._load_json_file(self.devcontainer_path)
        return vscode_settings, vscode_extensions, devcontainer_config

    def _format_with_prettier(self, file_paths: list[str]) -> None:
        """Format JSON files using prettier.

        Parameters
        ----------
        file_paths : list[str]
            List of file paths to format
        """
        if not file_paths:
            return

        try:
            # Convert to relative paths from repo root
            relative_paths = [
                os.path.relpath(path, self.repo_root) if os.path.isabs(path) else path
                for path in file_paths
            ]

            cmd = [
                "./scripts/run_in_subdirectory.py",
                "frontend/app",
                "yarn",
                "prettier",
                "--write",
                "--config",
                "../.prettierrc",
            ]

            # Add file paths with proper relative path prefix
            cmd.extend(f"../../{relative_path}" for relative_path in relative_paths)

            print("Formatting JSON files with prettier...")
            result = subprocess.run(
                cmd, check=False, cwd=self.repo_root, capture_output=True, text=True
            )

            if result.returncode != 0:
                print(f"Warning: Prettier formatting failed: {result.stderr}")
                print(f"Command: {' '.join(cmd)}")
            else:
                print("✅ JSON files formatted successfully")

        except Exception as e:
            print(f"Warning: Failed to format files with prettier: {e}")

    def check_sync_status(self) -> bool:
        """Check if the files are in sync without modifying them.

        Returns
        -------
        bool
            True if files are in sync, False otherwise
        """
        try:
            vscode_settings, vscode_extensions, devcontainer_config = (
                self._load_all_configs()
            )
            vscode_config = self._get_devcontainer_vscode_config(devcontainer_config)

            # Check extensions sync
            expected_extensions = self._filter_extensions(
                vscode_extensions.get("recommendations", [])
            )
            actual_extensions = vscode_config.get("extensions", [])

            if expected_extensions != actual_extensions:
                print("❌ Extensions are out of sync:")
                print(f"   VSCode extensions: {len(expected_extensions)} items")
                print(f"   Devcontainer extensions: {len(actual_extensions)} items")
                return False

            # Check settings sync
            actual_settings = vscode_config.get("settings", {})
            if vscode_settings != actual_settings:
                print("❌ Settings are out of sync:")
                print(f"   VSCode settings: {len(vscode_settings)} items")
                print(f"   Devcontainer settings: {len(actual_settings)} items")
                return False

            print("✅ All files are in sync!")
            return True

        except Exception as e:
            print(f"❌ Error checking sync status: {e}")
            return False

    def sync_configurations(self) -> bool:
        """Sync VSCode settings and extensions with devcontainer configuration.

        Returns
        -------
        bool
            True if sync was successful, False otherwise
        """
        print("Loading source files...")
        vscode_settings, vscode_extensions, devcontainer_config = (
            self._load_all_configs()
        )

        # Validate extensions structure
        if "recommendations" not in vscode_extensions:
            print("Error: 'recommendations' key not found in .vscode/extensions.json")
            return False

        print("Syncing extensions and settings...")

        # Get filtered extensions
        extensions_list = self._filter_extensions(vscode_extensions["recommendations"])

        # Update devcontainer configuration
        vscode_config = self._get_devcontainer_vscode_config(devcontainer_config)
        vscode_config["extensions"] = extensions_list
        vscode_config["settings"] = vscode_settings

        print("Saving updated devcontainer configuration...")
        self._save_json_file(self.devcontainer_path, devcontainer_config)

        # Format with prettier
        self._format_with_prettier(
            [
                self.vscode_settings_path,
                self.vscode_extensions_path,
                self.devcontainer_path,
            ]
        )

        # Print summary
        original_count = len(vscode_extensions["recommendations"])
        excluded_count = original_count - len(extensions_list)

        print("✅ Synchronization complete!")
        print(
            f"   - Synced {len(extensions_list)} extensions (excluded {excluded_count} non-devcontainer extensions)"
        )
        print(f"   - Synced {len(vscode_settings)} settings")
        return True


def _parse_arguments() -> argparse.Namespace:
    """Parse command line arguments.

    Returns
    -------
    argparse.Namespace
        Parsed command line arguments containing check flag
    """
    parser = argparse.ArgumentParser(
        description="Sync VSCode settings and extensions with devcontainer configuration"
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Check if files are in sync without modifying them (useful for pre-commit hooks)",
    )
    return parser.parse_args()


def main() -> None:
    """Main entry point for the script.

    Parses command line arguments and executes the appropriate sync or check operation.
    Exits with status 0 on success, 1 on failure.
    """
    args = _parse_arguments()
    syncer = DevcontainerSync()

    if args.check:
        print("🔍 Checking VSCode/devcontainer configuration sync...")
        success = syncer.check_sync_status()
    else:
        print("🔄 Syncing VSCode configuration with devcontainer...")
        success = syncer.sync_configurations()

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
