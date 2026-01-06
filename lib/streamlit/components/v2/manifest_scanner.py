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

"""Discovery utilities for Component v2 manifests in installed packages.

The scanner searches installed distributions for a ``pyproject.toml`` with
``[tool.streamlit.component]`` configuration and extracts the component
manifests along with their package roots.

The implementation prioritizes efficiency and safety by filtering likely
candidates and avoiding excessive filesystem operations.
"""

from __future__ import annotations

import importlib.metadata
import importlib.util
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Final

import toml
from packaging import utils as packaging_utils

from streamlit.components.v2.component_path_utils import ComponentPathUtils
from streamlit.errors import StreamlitComponentRegistryError
from streamlit.logger import get_logger

_LOGGER: Final = get_logger(__name__)


def _normalize_package_name(dist_name: str) -> str:
    """Normalize a distribution name to an importable package name.

    This helper converts hyphens to underscores to derive a best-effort
    importable module/package name from a distribution name.

    Parameters
    ----------
    dist_name : str
        The distribution/project name (e.g., "my-awesome-component").

    Returns
    -------
    str
        The normalized package name suitable for import lookups
        (e.g., "my_awesome_component").
    """
    return dist_name.replace("-", "_")


@dataclass
class ComponentManifest:
    """Parsed component manifest data."""

    name: str
    version: str
    components: list[ComponentConfig]


@dataclass
class ComponentConfig:
    """Structured configuration for a single component entry.

    Parameters
    ----------
    name
        Component name as declared in ``pyproject.toml``.
    asset_dir
        Optional relative directory containing component assets.
    """

    name: str
    asset_dir: str | None = None

    @staticmethod
    def from_dict(config: dict[str, Any]) -> ComponentConfig:
        """Create a ComponentConfig from a raw dict.

        Parameters
        ----------
        config
            Raw component dictionary parsed from TOML.

        Returns
        -------
        ComponentConfig
            Parsed and validated component configuration.
        """
        name_value = config.get("name")
        if not isinstance(name_value, str) or not name_value:
            # Fail closed: invalid component entry
            raise ValueError("Component entry missing required 'name' field")

        asset_dir_value = config.get("asset_dir")
        if asset_dir_value is not None and not isinstance(asset_dir_value, str):
            # Fail closed: invalid asset_dir value
            raise ValueError("'asset_dir' must be a string")

        return ComponentConfig(
            name=name_value,
            asset_dir=asset_dir_value,
        )

    @staticmethod
    def parse_or_none(config: dict[str, Any]) -> ComponentConfig | None:
        """Best-effort parse without raising; returns None on malformed input."""
        try:
            return ComponentConfig.from_dict(config)
        except Exception as e:
            _LOGGER.debug("Skipping malformed component entry: %s", e)
            return None

    def resolve_asset_root(self, package_root: Path) -> Path | None:
        """Resolve and security-check the component's asset root directory.

        Parameters
        ----------
        package_root : Path
            The root directory of the installed component package.

        Returns
        -------
        Path | None
            Absolute, resolved path to the asset directory, or ``None`` if
            ``asset_dir`` is not declared.

        Raises
        ------
        StreamlitComponentRegistryError
            If the declared directory does not exist, is not a directory, or
            resolves outside of ``package_root``.
        """
        if self.asset_dir is None:
            return None

        # Validate the configured path string first
        ComponentPathUtils.validate_path_security(self.asset_dir)

        asset_root = (package_root / self.asset_dir).resolve()

        if not asset_root.exists() or not asset_root.is_dir():
            raise StreamlitComponentRegistryError(
                f"Declared asset_dir '{self.asset_dir}' for component '{self.name}' "
                f"does not exist or is not a directory under package root '{package_root}'."
            )

        # Ensure the resolved directory is within the package root after following symlinks
        ComponentPathUtils.ensure_within_root(
            abs_path=asset_root,
            root=package_root.resolve(),
            kind="asset_dir",
        )

        return asset_root


def _is_likely_streamlit_component_package(
    dist: importlib.metadata.Distribution,
) -> bool:
    """Check if a package is likely to contain streamlit components before
    expensive operations.

    This early filter reduces the number of packages that need file I/O
    operations from potentially hundreds down to just a few candidates.

    Parameters
    ----------
    dist : importlib.metadata.Distribution
        The package distribution to check.

    Returns
    -------
    bool
        True if the package might contain streamlit components, False otherwise.
    """
    # Get package metadata
    name = dist.name.lower()
    summary = dist.metadata["Summary"].lower() if "Summary" in dist.metadata else ""

    # Filter 1: Package name suggests streamlit component
    if "streamlit" in name:
        return True

    # Filter 2: Package description mentions streamlit
    if "streamlit" in summary:
        return True

    # Filter 3: Check if package depends on streamlit
    try:
        # Check requires_dist for streamlit dependency
        requires_dist = dist.metadata.get_all("Requires-Dist") or []
        for requirement in requires_dist:
            if requirement and "streamlit" in requirement.lower():
                return True
    except Exception as e:
        # Don't fail on metadata parsing issues, but log for debugging purposes
        _LOGGER.debug(
            "Failed to parse package metadata for streamlit component detection: %s", e
        )

    # Filter 4: Check if this is a known streamlit ecosystem package
    # Common patterns in streamlit component package names. Use anchored checks to
    # avoid matching unrelated packages like "test-utils".
    return name.startswith(("streamlit-", "streamlit_", "st-", "st_"))


def _find_package_pyproject_toml(dist: importlib.metadata.Distribution) -> Path | None:
    """Find ``pyproject.toml`` for a package.

    Handles both regular and editable installs. The function uses increasingly
    permissive strategies to locate the file while validating that the file
    belongs to the given distribution.

    Parameters
    ----------
    dist : importlib.metadata.Distribution
        The package distribution to find pyproject.toml for.

    Returns
    -------
    Path | None
        Path to the ``pyproject.toml`` file if found, otherwise ``None``.
    """
    package_name = _normalize_package_name(dist.name)

    # Try increasingly permissive strategies
    for finder in (
        _pyproject_via_read_text,
        _pyproject_via_dist_files,
        lambda d: _pyproject_via_import_spec(d, package_name),
    ):
        result = finder(dist)
        if result is not None:
            return result

    return None


def _pyproject_via_read_text(dist: importlib.metadata.Distribution) -> Path | None:
    """Locate pyproject.toml using the distribution's read_text + nearby files.

    This works for many types of installations including some editable ones.
    """
    package_name = _normalize_package_name(dist.name)
    try:
        if hasattr(dist, "read_text"):
            pyproject_content = dist.read_text("pyproject.toml")
            if pyproject_content and dist.files:
                # Found content, now find the actual file path
                # Look for a reasonable file to get the directory
                for file in dist.files:
                    if "__init__.py" in str(file) or ".py" in str(file):
                        try:
                            file_path = Path(str(dist.locate_file(file)))
                            # Check nearby directories for pyproject.toml
                            current_dir = file_path.parent
                            # Check current directory and parent
                            for search_dir in [current_dir, current_dir.parent]:
                                pyproject_path = search_dir / "pyproject.toml"
                                if (
                                    pyproject_path.exists()
                                    and _validate_pyproject_for_package(
                                        pyproject_path,
                                        dist.name,
                                        package_name,
                                    )
                                ):
                                    return pyproject_path
                            # Stop after first reasonable file
                            break
                        except Exception:  # noqa: S112
                            continue
    except Exception:
        return None
    return None


def _pyproject_via_dist_files(dist: importlib.metadata.Distribution) -> Path | None:
    """Locate pyproject.toml by scanning the distribution's file list."""
    package_name = _normalize_package_name(dist.name)
    files = getattr(dist, "files", None)
    if not files:
        return None
    for file in files:
        if getattr(file, "name", None) == "pyproject.toml" or str(file).endswith(
            "pyproject.toml"
        ):
            try:
                pyproject_path = Path(str(dist.locate_file(file)))
                if _validate_pyproject_for_package(
                    pyproject_path,
                    dist.name,
                    package_name,
                ):
                    return pyproject_path
            except Exception:  # noqa: S112
                continue
    return None


def _pyproject_via_import_spec(
    dist: importlib.metadata.Distribution, package_name: str
) -> Path | None:
    """Locate pyproject.toml by resolving the import spec and checking nearby.

    For editable installs, try the package directory and its parent only.
    """
    try:
        spec = importlib.util.find_spec(package_name)
        if spec and spec.origin:
            package_dir = Path(spec.origin).parent
            for search_dir in [package_dir, package_dir.parent]:
                pyproject_path = search_dir / "pyproject.toml"
                if pyproject_path.exists() and _validate_pyproject_for_package(
                    pyproject_path,
                    dist.name,
                    package_name,
                ):
                    return pyproject_path
    except Exception:
        return None
    return None


def _validate_pyproject_for_package(
    pyproject_path: Path, dist_name: str, package_name: str
) -> bool:
    """Validate that a ``pyproject.toml`` file belongs to the specified package.

    Parameters
    ----------
    pyproject_path : Path
        Path to the pyproject.toml file to validate.
    dist_name : str
        The distribution name (e.g., "streamlit-bokeh").
    package_name : str
        The package name (e.g., "streamlit_bokeh").

    Returns
    -------
    bool
        True if the file belongs to this package, False otherwise.
    """
    try:
        with open(pyproject_path, encoding="utf-8") as f:
            pyproject_data = toml.load(f)

        # Check if this pyproject.toml is for the package we're looking for
        project_name = None

        # Try to get the project name from [project] table
        if "project" in pyproject_data and "name" in pyproject_data["project"]:
            project_name = pyproject_data["project"]["name"]

        # Also try to get it from [tool.setuptools] or other build system configs
        if (
            not project_name
            and "tool" in pyproject_data
            and (
                "setuptools" in pyproject_data["tool"]
                and "package-name" in pyproject_data["tool"]["setuptools"]
            )
        ):
            project_name = pyproject_data["tool"]["setuptools"]["package-name"]

        # If we found a project name, check if it matches either the dist name or package name
        if project_name:
            # Normalize names for comparison using PEP 503 canonicalization
            # This handles hyphens, underscores, and dots consistently.
            canonical_project = packaging_utils.canonicalize_name(project_name)
            canonical_dist = packaging_utils.canonicalize_name(dist_name)
            canonical_package = packaging_utils.canonicalize_name(package_name)

            # Check if project name matches either the distribution name or the package name
            return canonical_project in (canonical_dist, canonical_package)

        # If we can't determine ownership, be conservative and reject it
        return False

    except Exception as e:
        _LOGGER.debug(
            "Error validating pyproject.toml at %s for %s: %s",
            pyproject_path,
            dist_name,
            e,
        )
        return False


def _load_pyproject(pyproject_path: Path) -> dict[str, Any] | None:
    """Load and parse a pyproject.toml, returning parsed data or None on failure."""
    try:
        with open(pyproject_path, encoding="utf-8") as f:
            return toml.load(f)
    except Exception as e:
        _LOGGER.debug("Failed to parse pyproject.toml at %s: %s", pyproject_path, e)
        return None


def _extract_components(pyproject_data: dict[str, Any]) -> list[dict[str, Any]] | None:
    """Extract raw component dicts from pyproject data; return None if absent."""
    streamlit_component = (
        pyproject_data.get("tool", {}).get("streamlit", {}).get("component")
    )
    if not streamlit_component:
        return None
    raw_components = streamlit_component.get("components")
    if not isinstance(raw_components, list):
        return None
    # Ensure a list of dicts for type safety
    result: list[dict[str, Any]] = [
        item for item in raw_components if isinstance(item, dict)
    ]
    if not result:
        return None
    return result


def _resolve_package_root(
    dist: importlib.metadata.Distribution, package_name: str, pyproject_path: Path
) -> Path:
    """Resolve the package root directory with fallbacks."""
    package_root: Path | None = None
    try:
        spec = importlib.util.find_spec(package_name)
        if spec and spec.origin:
            package_root = Path(spec.origin).parent
    except Exception as e:
        _LOGGER.debug(
            "Failed to resolve package root via import spec for %s: %s",
            package_name,
            e,
        )

    files = getattr(dist, "files", None)
    if not package_root and files:
        for file in files:
            if package_name in str(file) and "__init__.py" in str(file):
                try:
                    init_path = Path(str(dist.locate_file(file)))
                    package_root = init_path.parent
                    break
                except Exception as e:
                    _LOGGER.debug(
                        "Failed to resolve package root via dist files for %s: %s",
                        package_name,
                        e,
                    )

    if not package_root:
        package_root = pyproject_path.parent

    return package_root


def _derive_project_metadata(
    pyproject_data: dict[str, Any], dist: importlib.metadata.Distribution
) -> tuple[str, str]:
    """Derive project name and version with safe fallbacks."""
    project_table = pyproject_data.get("project", {})
    derived_name = project_table.get("name") or dist.name
    derived_version = project_table.get("version") or dist.version or "0.0.0"
    return derived_name, derived_version


def _process_single_package(
    dist: importlib.metadata.Distribution,
) -> tuple[ComponentManifest, Path] | None:
    """Process a single package to extract component manifest.

    This function is designed to be called from a thread pool for parallel processing.

    Parameters
    ----------
    dist : importlib.metadata.Distribution
        The package distribution to process.

    Returns
    -------
    tuple[ComponentManifest, Path] | None
        The manifest and package root if found, otherwise ``None``.
    """
    try:
        pyproject_path = _find_package_pyproject_toml(dist)
        if not pyproject_path:
            return None

        pyproject_data = _load_pyproject(pyproject_path)
        if pyproject_data is None:
            return None

        raw_components = _extract_components(pyproject_data)
        if not raw_components:
            return None

        package_name = _normalize_package_name(dist.name)
        package_root = _resolve_package_root(dist, package_name, pyproject_path)

        derived_name, derived_version = _derive_project_metadata(pyproject_data, dist)

        parsed_components: list[ComponentConfig] = [
            parsed
            for comp in raw_components
            if (parsed := ComponentConfig.parse_or_none(comp)) is not None
        ]

        if not parsed_components:
            return None

        manifest = ComponentManifest(
            name=derived_name,
            version=derived_version,
            components=parsed_components,
        )

        return (manifest, package_root)

    except Exception as e:
        _LOGGER.debug(
            "Unexpected error processing distribution %s: %s",
            getattr(dist, "name", "<unknown>"),
            e,
        )
        return None


def scan_component_manifests(
    max_workers: int | None = None,
) -> list[tuple[ComponentManifest, Path]]:
    """Scan installed packages for Streamlit component metadata.

    Uses parallel processing to improve performance in environments with many
    installed packages. Applies early filtering to only check packages likely to
    contain streamlit components.

    Parameters
    ----------
    max_workers : int or None
        Maximum number of worker threads. If None, uses min(32, (os.cpu_count()
        or 1) + 4).

    Returns
    -------
    list[tuple[ComponentManifest, Path]]
        List of tuples of manifests and their package root paths.
    """
    manifests: list[tuple[ComponentManifest, Path]] = []

    # Get all distributions first (this is fast)
    all_distributions = list(importlib.metadata.distributions())

    if not all_distributions:
        return manifests

    # Apply early filtering to reduce expensive file operations
    candidate_distributions = [
        dist
        for dist in all_distributions
        if _is_likely_streamlit_component_package(dist)
    ]

    _LOGGER.debug(
        "Filtered %d packages down to %d candidates for component scanning",
        len(all_distributions),
        len(candidate_distributions),
    )

    if not candidate_distributions:
        return manifests

    # Default max_workers follows ThreadPoolExecutor's default logic
    if max_workers is None:
        max_workers = min(32, (os.cpu_count() or 1) + 4)

    # Clamp max_workers to reasonable bounds for this task
    max_workers = min(
        max_workers, len(candidate_distributions), 16
    )  # Don't use more threads than packages or 16

    _LOGGER.debug(
        "Scanning %d candidate packages for component manifests using %d worker threads",
        len(candidate_distributions),
        max_workers,
    )

    # Process packages in parallel
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submit all tasks
        future_to_dist = {
            executor.submit(_process_single_package, dist): dist.name
            for dist in candidate_distributions
        }

        # Collect results as they complete
        for future in as_completed(future_to_dist):
            result = future.result()
            if result:
                manifests.append(result)

    _LOGGER.debug("Found %d component manifests total", len(manifests))
    return manifests
