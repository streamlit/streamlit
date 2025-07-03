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

# This script should be invoked using `make update-min-deps`.
# It has the precondition that you must have installed streamlit locally since
# you last updated its dependencies, which the make command takes care of.
from __future__ import annotations

import importlib.metadata
from typing import TYPE_CHECKING, Any

from packaging.requirements import Requirement

if TYPE_CHECKING:
    from packaging.specifiers import SpecifierSet


def get_package_metadata(
    package_name: str,
) -> Any | None:
    """Get package metadata for a given package name."""
    try:
        return importlib.metadata.metadata(package_name)
    except importlib.metadata.PackageNotFoundError:
        return None


def get_min_version(specifier_set: SpecifierSet) -> str | None:
    """Get the minimum version from a specifier set."""
    if not specifier_set:
        return None

    # Find the minimum version from all specifiers
    min_version: str | None = None
    for spec in specifier_set:
        if spec.operator in (">=", ">", "=="):
            version = str(spec.version)
            if min_version is None or version < min_version:
                min_version = version
    return min_version


def is_required_dependency(requirement_str: str) -> bool:
    """Check if a dependency is required (not optional or environment-specific)."""

    # Skip if it's an optional dependency
    if "extra ==" in requirement_str:
        return False

    # Skip if it's a development dependency
    return not requirement_str.startswith("dev-")


# Try to find streamlit or streamlit-nightly package
package_metadata = get_package_metadata("streamlit")
if package_metadata is None:
    package_metadata = get_package_metadata("streamlit-nightly")
if package_metadata is None:
    raise ValueError("streamlit/streamlit-nightly packages not found")

oldest_dependencies = []

# Get all dependencies from the package metadata
for requirement_str in package_metadata.get_all("Requires-Dist", []):
    # Skip empty requirements
    if not requirement_str:
        continue

    # Skip optional and environment-specific dependencies
    if not is_required_dependency(requirement_str):
        continue

    requirement = Requirement(requirement_str)
    dependency = requirement.name

    # Get minimum version from specifiers
    min_version = get_min_version(requirement.specifier)
    if min_version:
        dependency += "==" + min_version

    oldest_dependencies.append(dependency)

for dependency in sorted(oldest_dependencies):
    print(dependency)
