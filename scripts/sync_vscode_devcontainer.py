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


import argparse
import json
import os
import subprocess
import sys
from typing import Any, cast


def load_json_file(file_path: str) -> dict[str, Any]:
    """Load and parse a JSON file.

    Args:
        file_path: Path to the JSON file

    Returns
    -------
        Parsed JSON content as dictionary

    Raises
    ------
        FileNotFoundError: If the file doesn't exist
        json.JSONDecodeError: If the file contains invalid JSON
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


def save_json_file(file_path: str, data: dict[str, Any]) -> None:
    """Save data to a JSON file with proper formatting.

    Args:
        file_path: Path to save the JSON file
        data: Data to save
    """
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write("\n")  # Add final newline
        print(f"Successfully updated: {file_path}")
    except Exception as e:
        print(f"Error: Failed to save {file_path}: {e}")
        sys.exit(1)


def format_json_files_with_prettier(repo_root: str, file_paths: list[str]) -> None:
    """Format JSON files using prettier.

    Args:
        repo_root: Repository root directory
        file_paths: List of file paths to format
    """
    if not file_paths:
        return

    try:
        # Convert absolute paths to relative paths from repo root
        relative_paths = []
        for file_path in file_paths:
            if os.path.isabs(file_path):
                relative_paths.append(os.path.relpath(file_path, repo_root))
            else:
                relative_paths.append(file_path)

        # Use the same approach as the pre-commit hooks
        cmd = [
            "./scripts/run_in_subdirectory.py",
            "frontend/app",
            "yarn",
            "prettier",
            "--write",
            "--config",
            "../.prettierrc",
        ]

        # Add each file path
        for relative_path in relative_paths:
            cmd.append(f"../../{relative_path}")

        print("Formatting JSON files with prettier...")
        result = subprocess.run(
            cmd, check=False, cwd=repo_root, capture_output=True, text=True
        )

        if result.returncode != 0:
            print(f"Warning: Prettier formatting failed: {result.stderr}")
            print(f"Command: {' '.join(cmd)}")
        else:
            print("✅ JSON files formatted successfully")

    except Exception as e:
        print(f"Warning: Failed to format files with prettier: {e}")


def check_files_in_sync(
    vscode_settings_path: str, vscode_extensions_path: str, devcontainer_path: str
) -> bool:
    """Check if the files are in sync without modifying them.

    Returns
    -------
        True if files are in sync, False otherwise
    """
    try:
        # Load all files
        vscode_settings = load_json_file(vscode_settings_path)
        vscode_extensions = load_json_file(vscode_extensions_path)
        devcontainer_config = load_json_file(devcontainer_path)

        # Check if extensions are in sync
        expected_extensions = vscode_extensions.get("recommendations", [])
        actual_extensions = (
            devcontainer_config.get("customizations", {})
            .get("vscode", {})
            .get("extensions", [])
        )

        if expected_extensions != actual_extensions:
            print("❌ Extensions are out of sync:")
            print(f"   VSCode extensions: {len(expected_extensions)} items")
            print(f"   Devcontainer extensions: {len(actual_extensions)} items")
            print("   Run 'make sync-vscode-devcontainer' to fix this")
            return False

        # Check if settings are in sync
        expected_settings = vscode_settings
        actual_settings = (
            devcontainer_config.get("customizations", {})
            .get("vscode", {})
            .get("settings", {})
        )

        if expected_settings != actual_settings:
            print("❌ Settings are out of sync:")
            print(f"   VSCode settings: {len(expected_settings)} items")
            print(f"   Devcontainer settings: {len(actual_settings)} items")
            print("   Run 'make sync-vscode-devcontainer' to fix this")
            return False

        print("✅ All files are in sync!")
        return True

    except Exception as e:
        print(f"❌ Error checking sync status: {e}")
        return False


def sync_vscode_devcontainer(
    check_only: bool = False, format_with_prettier: bool = True
) -> bool:
    """Sync VSCode settings and extensions with devcontainer configuration.

    Args:
        check_only: If True, only check if files are in sync without modifying them
        format_with_prettier: If True, format JSON files with prettier after syncing

    Returns
    -------
        True if sync was successful or files are already in sync, False otherwise

    This function:
    1. Reads .vscode/settings.json (source of truth for settings)
    2. Reads .vscode/extensions.json (source of truth for extensions)
    3. Updates .devcontainer/devcontainer.json with the synced data (unless check_only=True)
    4. Optionally formats JSON files with prettier
    """
    # Get the repository root directory
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    # Define file paths
    vscode_settings_path = os.path.join(repo_root, ".vscode", "settings.json")
    vscode_extensions_path = os.path.join(repo_root, ".vscode", "extensions.json")
    devcontainer_path = os.path.join(repo_root, ".devcontainer", "devcontainer.json")

    if check_only:
        print("🔍 Checking if VSCode configuration is in sync with devcontainer...")
        return check_files_in_sync(
            vscode_settings_path, vscode_extensions_path, devcontainer_path
        )

    print("Loading source files...")

    # Load source files
    vscode_settings = load_json_file(vscode_settings_path)
    vscode_extensions = load_json_file(vscode_extensions_path)
    devcontainer_config = load_json_file(devcontainer_path)

    print("Syncing extensions and settings...")

    # Extract extensions list from .vscode/extensions.json
    if "recommendations" not in vscode_extensions:
        print("Error: 'recommendations' key not found in .vscode/extensions.json")
        return False

    extensions_list = vscode_extensions["recommendations"]

    # Update devcontainer configuration
    if "customizations" not in devcontainer_config:
        devcontainer_config["customizations"] = {}

    if "vscode" not in devcontainer_config["customizations"]:
        devcontainer_config["customizations"]["vscode"] = {}

    # Sync extensions
    devcontainer_config["customizations"]["vscode"]["extensions"] = extensions_list

    # Sync settings
    devcontainer_config["customizations"]["vscode"]["settings"] = vscode_settings

    print("Saving updated devcontainer configuration...")

    # Save the updated devcontainer configuration
    save_json_file(devcontainer_path, devcontainer_config)

    # Format with prettier if requested
    if format_with_prettier:
        format_json_files_with_prettier(
            repo_root, [vscode_settings_path, vscode_extensions_path, devcontainer_path]
        )

    print("✅ Synchronization complete!")
    print(f"   - Synced {len(extensions_list)} extensions")
    print(f"   - Synced {len(vscode_settings)} settings")
    return True


def parse_arguments() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Sync VSCode settings and extensions with devcontainer configuration"
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Check if files are in sync without modifying them (useful for pre-commit hooks)",
    )
    parser.add_argument(
        "--no-prettier",
        action="store_true",
        help="Skip formatting JSON files with prettier",
    )
    return parser.parse_args()


def main() -> None:
    """Main entry point for the script."""
    args = parse_arguments()

    if args.check:
        print("🔍 Checking VSCode/devcontainer configuration sync...")
        success = sync_vscode_devcontainer(check_only=True)
        sys.exit(0 if success else 1)
    else:
        print("🔄 Syncing VSCode configuration with devcontainer...")
        success = sync_vscode_devcontainer(format_with_prettier=not args.no_prettier)
        sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
