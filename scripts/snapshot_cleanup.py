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

"""A script to clean up orphaned e2e snapshots.

Usage:
    python scripts/snapshot_cleanup.py [--dry-run] [--debug] [--ci]

This script will analyze the e2e test files and identify snapshot files that
appear to be orphaned (no longer referenced in tests). Run from the project
root directory.

Options:
    --dry-run   : Show what would be deleted without actually deleting
    --debug     : Show detailed debug information
    --ci        : CI mode - check for orphaned snapshots and exit with non-zero
                 status if any are found (does not delete anything)

NOTE: This script is not perfect and may identify some
snapshots as orphans when they aren't actually so manually review results.
"""

from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
from collections import defaultdict

# MANUAL VERIFICATION REQUIRED:
# The following snapshots are not detected by this script's static analysis but
# are actually in use. This disallow list should be manually updated whenever the
# script incorrectly identifies a snapshot as orphaned. Not a perfect solution
# but follows the 80/20 rule.

# Snapshots that are not detected by static analysis but are actually in use.
# This list should be manually updated when the script incorrectly flags snapshots.
DISALLOWED_SNAPSHOTS = {
    "st_map-fullscreen_expanded[webkit].png",
    "st_map-fullscreen_collapsed[webkit].png",
    "st_pydeck_chart-fullscreen_expanded[light_theme-webkit].png",
    "st_pydeck_chart-fullscreen_collapsed[light_theme-webkit].png",
    "st_dataframe-fullscreen_expanded[chromium].png",
    "st_dataframe-fullscreen_collapsed[chromium].png",
    "st_dataframe-fullscreen_expanded[webkit].png",
    "st_dataframe-fullscreen_collapsed[webkit].png",
    "st_map-fullscreen_expanded[chromium].png",
    "st_map-fullscreen_collapsed[chromium].png",
    "st_pydeck_chart-fullscreen_expanded[dark_theme-webkit].png",
    "st_pydeck_chart-fullscreen_collapsed[dark_theme-webkit].png",
    "st_pydeck_chart-fullscreen_expanded[light_theme-chromium].png",
    "st_pydeck_chart-fullscreen_collapsed[light_theme-chromium].png",
    "st_pydeck_chart-fullscreen_expanded[dark_theme-chromium].png",
    "st_pydeck_chart-fullscreen_collapsed[dark_theme-chromium].png",
    # st_data_editor Firefox snapshots that are not detected by static analysis
    "st_data_editor-input_data_0[firefox].png",
    "st_data_editor-input_data_1[firefox].png",
    "st_data_editor-input_data_2[firefox].png",
    "st_data_editor-input_data_3[firefox].png",
    "st_data_editor-input_data_4[firefox].png",
    "st_data_editor-input_data_5[firefox].png",
    "st_data_editor-input_data_6[firefox].png",
    "st_data_editor-input_data_7[firefox].png",
    "st_data_editor-input_data_8[firefox].png",
    "st_data_editor-input_data_9[firefox].png",
    "st_data_editor-input_data_10[firefox].png",
    "st_data_editor-input_data_11[firefox].png",
    "st_data_editor-input_data_12[firefox].png",
    "st_data_editor-input_data_13[firefox].png",
    "st_data_editor-input_data_14[firefox].png",
    "st_data_editor-input_data_15[firefox].png",
    "st_data_editor-input_data_16[firefox].png",
    "st_data_editor-input_data_17[firefox].png",
    "st_data_editor-input_data_18[firefox].png",
    "st_data_editor-input_data_19[firefox].png",
    "st_data_editor-input_data_20[firefox].png",
    "st_data_editor-input_data_21[firefox].png",
    "st_data_editor-input_data_22[firefox].png",
    "st_data_editor-input_data_23[firefox].png",
    "st_data_editor-input_data_24[firefox].png",
    "st_data_editor-input_data_25[firefox].png",
    "st_data_editor-input_data_26[firefox].png",
    "st_data_editor-input_data_27[firefox].png",
    "st_data_editor-input_data_28[firefox].png",
    "st_data_editor-input_data_29[firefox].png",
    "st_data_editor-input_data_30[firefox].png",
    "st_data_editor-input_data_31[firefox].png",
    "st_data_editor-input_data_32[firefox].png",
    "st_data_editor-input_data_33[firefox].png",
    "st_data_editor-input_data_34[firefox].png",
}


def get_used_snapshots() -> dict[str, tuple[set[str], set[str]]]:
    """
    Scans all test files to find snapshot names used in `assert_snapshot` calls.

    Returns
    -------
        A dictionary where keys are test names (e.g., "st_button_test") and
        values are tuples of (exact_names, prefixes) where:
        - exact_names: Set of exact snapshot names (from regular strings)
        - prefixes: Set of snapshot name prefixes (from f-strings)
    """
    snapshots_by_test: dict[str, tuple[set[str], set[str]]] = defaultdict(
        lambda: (set(), set())
    )

    try:
        cmd = "find e2e_playwright -name '*_test.py'"
        result = subprocess.run(
            cmd, shell=True, capture_output=True, text=True, check=True
        )
        test_files = result.stdout.strip().split("\n")
    except subprocess.CalledProcessError as e:
        print(f"Error finding test files: {e}")
        return snapshots_by_test

    for test_file in test_files:
        try:
            with open(test_file) as f:
                content = f.read()

            test_name = os.path.basename(test_file).replace(".py", "")
            exact_names, prefixes = snapshots_by_test[test_name]

            # Find all assert_snapshot calls, including multi-line ones
            lines = content.split("\n")
            for i, line in enumerate(lines):
                if "assert_snapshot" in line:
                    # Look at this line and the next few lines to capture multi-line calls
                    context = "\n".join(lines[i : min(i + 10, len(lines))])

                    # First check for string concatenation patterns like "prefix" + str(i)
                    concat_match = re.search(
                        r'name\s*=\s*["\']([^"\']+)["\']\s*\+', context
                    )
                    if concat_match:
                        prefix = concat_match.group(1)
                        prefixes.add(prefix)
                        continue

                    # Then check for f-strings or regular strings
                    name_match = re.search(
                        r'name\s*=\s*(f?)["\']([^"\']+)["\']', context
                    )
                    if name_match:
                        is_fstring = name_match.group(1) == "f"
                        snapshot_name = name_match.group(2)

                        if is_fstring:
                            # For f-strings, extract the prefix before the first {
                            prefix_end = snapshot_name.find("{")
                            if prefix_end > 0:
                                prefix = snapshot_name[:prefix_end]
                                prefixes.add(prefix)
                            else:
                                # If no { found in f-string, treat as exact name
                                exact_names.add(snapshot_name)
                        else:
                            # For regular strings, it's an exact name
                            exact_names.add(snapshot_name)
                    # If no name parameter found, skip this assert_snapshot call

        except Exception as e:
            print(f"Error processing {test_file}: {e}")

    return dict(snapshots_by_test)


def search_for_snapshot_name(snapshot_name: str) -> bool:
    """
    Search for a snapshot name in all e2e test files.
    Returns True if found, False otherwise.
    """
    try:
        # Use grep to search for the snapshot name in all test files
        cmd = f'grep -r --include="*.py" "{snapshot_name}" e2e_playwright/'
        result = subprocess.run(
            cmd, shell=True, capture_output=True, text=True, check=False
        )
        # If grep finds something, it returns 0
        return result.returncode == 0
    except Exception as e:
        print(f"Error searching for {snapshot_name}: {e}")
        # If there's an error, be conservative and assume it's used
        return True


def main() -> None:
    """Finds and deletes all orphaned snapshot files."""
    parser = argparse.ArgumentParser(
        prog="snapshot_cleanup.py", description="Clean up orphaned e2e snapshots"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be deleted without actually deleting",
    )
    parser.add_argument(
        "--debug", action="store_true", help="Show detailed debug information"
    )
    parser.add_argument(
        "--ci",
        action="store_true",
        help="CI mode - check for orphaned snapshots and exit with non-zero status if any are found "
        "(does not delete anything)",
    )
    args = parser.parse_args()

    debug = args.debug
    dry_run = args.dry_run or debug
    ci = args.ci

    if not ci:
        print("Analyzing test files for snapshot usage...")
    snapshots_by_test = get_used_snapshots()

    if debug:
        print("\nDEBUG: Found snapshots in tests:")
        for test_name, (exact_names, prefixes) in sorted(snapshots_by_test.items()):
            if exact_names or prefixes:
                print(f"\n{test_name}:")
                if exact_names:
                    print(
                        f"  Exact names ({len(exact_names)}): {sorted(exact_names)[:5]}"
                    )
                    if len(exact_names) > 5:
                        print(f"    ... and {len(exact_names) - 5} more")
                if prefixes:
                    print(f"  Prefixes: {sorted(prefixes)}")

    orphaned_files = []
    searched_snapshots = 0

    snapshot_root = "e2e_playwright/__snapshots__/linux"
    if not ci:
        print(f"\nScanning {snapshot_root} for snapshot files...")

    all_snapshot_files = []
    for dirpath, _, filenames in os.walk(snapshot_root):
        for filename in filenames:
            if filename.endswith(".png"):
                all_snapshot_files.append(os.path.join(dirpath, filename))

    if not ci:
        print(f"Found {len(all_snapshot_files)} total snapshot files")

    # Debug specific test
    if debug and "--test" in sys.argv:
        test_idx = sys.argv.index("--test")
        if test_idx + 1 < len(sys.argv):
            debug_test = sys.argv[test_idx + 1]
            print(f"\nDEBUG: Focusing on test: {debug_test}")

    if not ci:
        print("\nChecking snapshots...")
    for i, filepath in enumerate(all_snapshot_files):
        test_name = os.path.basename(os.path.dirname(filepath))
        filename = os.path.basename(filepath)

        # from "st_button-primary[chromium].png" -> get "st_button-primary"
        snapshot_name = re.sub(r"\[.*\]\.png$", "", filename)

        # Check if this snapshot is used
        is_used = False
        reason = "Test not found in snapshots_by_test"

        if test_name in snapshots_by_test:
            exact_names, prefixes = snapshots_by_test[test_name]

            # First check for exact match
            if snapshot_name in exact_names:
                is_used = True
                reason = "Exact match in assert_snapshot"
            else:
                # Then check if it matches any prefix
                for prefix in prefixes:
                    if snapshot_name.startswith(prefix):
                        is_used = True
                        reason = f"Matches prefix in assert_snapshot: '{prefix}'"
                        break

        # If not found in assert_snapshot calls, search for it in the codebase
        if not is_used:
            if search_for_snapshot_name(snapshot_name):
                is_used = True
                reason = "Found in codebase search"
                searched_snapshots += 1
            else:
                reason = "Not found in assert_snapshot or codebase"

        # Check if this snapshot is in the disallow list
        if not is_used and filename in DISALLOWED_SNAPSHOTS:
            is_used = True
            reason = "Protected by disallow list (manually verified as in-use)"

        if debug and "--test" in sys.argv and test_name == debug_test:
            print(f"\n{filename}: {'USED' if is_used else 'ORPHANED'} - {reason}")

        if not is_used:
            orphaned_files.append(filepath)

        # Show progress for non-debug and non-CI runs
        if not debug and not ci and (i + 1) % 100 == 0:
            print(f"  Checked {i + 1}/{len(all_snapshot_files)} files...")

    if not orphaned_files:
        if ci:
            print("\n✅ CI MODE: No orphaned snapshots found.")
            sys.exit(0)
        else:
            print("\nNo orphaned snapshots found.")
            return

    if not ci:
        print(f"\nFound {len(orphaned_files)} orphaned snapshots")
        print(
            f"(Had to search codebase for {searched_snapshots} snapshots not found in assert_snapshot calls)"
        )

    # Print a summary of what we're about to delete
    if not ci:
        print("\nSummary by test:")
    orphaned_by_test = defaultdict(list)
    for filepath in orphaned_files:
        test_name = os.path.basename(os.path.dirname(filepath))
        orphaned_by_test[test_name].append(os.path.basename(filepath))

    # Show tests with most orphans first
    if not ci:
        for test_name in sorted(
            orphaned_by_test.keys(),
            key=lambda x: len(orphaned_by_test[x]),
            reverse=True,
        ):
            count = len(orphaned_by_test[test_name])
            print(f"\n{test_name}: {count} orphaned files")
            if debug or count <= 5:
                for filename in sorted(orphaned_by_test[test_name])[:10]:
                    print(f"  - {filename}")
                if count > 10:
                    print(f"  ... and {count - 10} more")
            else:
                for filename in sorted(orphaned_by_test[test_name])[:3]:
                    print(f"  - {filename}")
                print(f"  ... and {count - 3} more")

    if dry_run:
        print(f"\nDRY RUN: Would delete {len(orphaned_files)} orphaned snapshots.")
        print("Run without --dry-run or --debug to actually delete them.")
    elif ci:
        print(f"\n❌ CI MODE: Found {len(orphaned_files)} orphaned snapshots!")
        print("\nOrphaned snapshots by test:")
        for test_name in sorted(
            orphaned_by_test.keys(),
            key=lambda x: len(orphaned_by_test[x]),
            reverse=True,
        ):
            count = len(orphaned_by_test[test_name])
            print(f"  {test_name}: {count} orphaned files")

        print("\nTo fix this, run: python scripts/snapshot_cleanup.py")
        print("Or review the snapshots manually to ensure they're actually orphaned.")
        sys.exit(1)
    else:
        print(f"\nReady to delete {len(orphaned_files)} orphaned snapshots.")
        print("Proceeding with deletion...")

        for filepath in orphaned_files:
            try:
                os.remove(filepath)
            except FileNotFoundError:
                print(f"Warning: File not found and could not be deleted: {filepath}")
            except PermissionError:
                print(f"Warning: Permission denied when trying to delete: {filepath}")
            except Exception as e:
                print(
                    f"Warning: An unexpected error occurred while deleting {filepath}: {e}"
                )
        print(f"\n✅ Successfully deleted {len(orphaned_files)} orphaned snapshots.")


if __name__ == "__main__":
    main()
