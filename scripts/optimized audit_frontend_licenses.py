#!/usr/bin/env python3
"""
Audit licenses of frontend dependencies defined in yarn.lock.

Exit codes:
0 → all licenses acceptable
1 → unacceptable licenses found
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from typing import Iterable, List, Tuple

PackageInfo = Tuple[str, str]

SCRIPT_DIR = Path(__file__).resolve().parent
FRONTEND_DIR_LIB = SCRIPT_DIR.parent / "frontend/lib"
FRONTEND_DIR_APP = SCRIPT_DIR.parent / "frontend/app"

# -----------------------------------------------------
# Allowed Licenses
# -----------------------------------------------------
ACCEPTABLE_LICENSES: set[str] = {
    "MIT", "Apache-2.0", "Apache-2.0 WITH LLVM-exception",
    "0BSD", "BlueOak-1.0.0", "BSD-2-Clause", "BSD-3-Clause",
    "ISC", "CC0-1.0", "CC-BY-3.0", "CC-BY-4.0",
    "Python-2.0", "Zlib", "Unlicense", "WTFPL",
    "(MIT OR Apache-2.0)", "(MPL-2.0 OR Apache-2.0)",
    "(MIT OR CC0-1.0)", "(Apache-2.0 OR MPL-1.1)",
    "(BSD-3-Clause OR GPL-2.0)", "(MIT AND BSD-3-Clause)",
    "(MIT AND Zlib)", "(WTFPL OR MIT)",
    "(AFL-2.1 OR BSD-3-Clause)", "(BSD-2-Clause OR MIT OR Apache-2.0)",
    "Apache*", "(MIT OR GPL-3.0-or-later)", "Apache-2.0 AND MIT",
}

PACKAGE_EXCEPTIONS: set[PackageInfo] = {
    ("@mapbox/jsonlint-lines-primitives@npm:2.0.2", "UNKNOWN"),
    ("@plotly/mapbox-gl@npm:1.13.4", "SEE LICENSE IN LICENSE.txt"),
    ("mapbox-gl@npm:1.13.3", "SEE LICENSE IN LICENSE.txt"),
    ("colorbrewer@npm:1.5.6", "UNKNOWN"),
    ("streamlit@workspace:.", "UNKNOWN"),
    ("stack-trace@npm:0.0.9", "UNKNOWN"),
    ("splaytree-ts@npm:1.0.2", "BDS-3-Clause"),
}


# -----------------------------------------------------
# Helpers
# -----------------------------------------------------
def run_yarn_license_scan(directory: Path) -> List[str]:
    """Run yarn license scan and return output lines."""
    try:
        result = subprocess.run(
            ["yarn", "licenses", "list", "--json", "--production", "--recursive"],
            cwd=directory,
            capture_output=True,
            text=True,
            check=True,
        )
        return result.stdout.splitlines()
    except subprocess.CalledProcessError as exc:
        print(f" Yarn license scan failed in {directory}")
        print(exc.stderr)
        sys.exit(1)


def parse_license_output(lines: Iterable[str]) -> List[PackageInfo]:
    """Parse yarn JSON output into (package, license) tuples."""
    packages: List[PackageInfo] = []

    for line in lines:
        try:
            data = json.loads(line)
            license_name = data.get("value")
            for pkg in data.get("children", []):
                packages.append((pkg, license_name))
        except json.JSONDecodeError:
            continue  # ignore non-JSON lines

    return packages


def find_bad_packages(packages: List[PackageInfo]) -> List[PackageInfo]:
    """Return packages with unacceptable licenses."""
    return [
        pkg for pkg in packages
        if pkg[1] not in ACCEPTABLE_LICENSES
        and pkg not in PACKAGE_EXCEPTIONS
        and "workspace-aggregator" not in pkg[0]
    ]


# -----------------------------------------------------
# Main logic
# -----------------------------------------------------
def main() -> None:
    print(" Scanning frontend licenses...")

    output_lines = []
    output_lines += run_yarn_license_scan(FRONTEND_DIR_LIB)
    output_lines += run_yarn_license_scan(FRONTEND_DIR_APP)

    packages = parse_license_output(output_lines)

    # warn about unused exceptions
    unused_exceptions = PACKAGE_EXCEPTIONS.difference(set(packages))
    for exc in sorted(unused_exceptions):
        print(f" Unused exception (can remove): {exc}")

    bad_packages = find_bad_packages(packages)

    if bad_packages:
        print("\n Unacceptable licenses found:\n")
        for pkg, lic in bad_packages:
            print(f"  - {pkg} → {lic}")
        print(f"\nTotal violations: {len(bad_packages)}")
        sys.exit(1)

    print(f"\n All licenses acceptable ({len(packages)} packages checked)")
    sys.exit(0)


if __name__ == "__main__":
    main()
