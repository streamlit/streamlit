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

from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from collections.abc import MutableMapping
    from pathlib import Path

    from streamlit.components.v2.manifest_scanner import ComponentManifest


class ComponentManifestHandler:
    """Handles component registration from parsed ComponentManifest objects."""

    def __init__(self) -> None:
        # Component metadata from pyproject.toml
        self._metadata: MutableMapping[str, ComponentManifest] = {}
        # Resolved asset roots keyed by fully-qualified component name
        self._asset_roots: MutableMapping[str, Path] = {}

    def process_manifest(
        self, manifest: ComponentManifest, package_root: Path
    ) -> dict[str, dict[str, Any]]:
        """Process a manifest and return component definitions to register.

        Parameters
        ----------
        manifest : ComponentManifest
            The manifest to process
        package_root : Path
            The package root directory

        Returns
        -------
        dict[str, dict[str, Any]]
            Dictionary mapping component names to their definitions

        Raises
        ------
        StreamlitComponentRegistryError
            If a declared ``asset_dir`` does not exist, is not a directory, or
            resolves (after following symlinks) outside of ``package_root``.
        """
        base_name = manifest.name
        component_definitions = {}

        # Process each component in the manifest
        for comp_config in manifest.components:
            comp_name = comp_config.name

            component_name = f"{base_name}.{comp_name}"

            # Parse and persist asset_dir if provided. This is the component's
            # root directory for all future file references.
            asset_root = comp_config.resolve_asset_root(package_root)
            if asset_root is not None:
                self._asset_roots[component_name] = asset_root

            # Create component definition data
            component_definitions[component_name] = {
                "name": component_name,
            }

            # Store metadata
            self._metadata[component_name] = manifest

        return component_definitions

    def get_metadata(self, component_name: str) -> ComponentManifest | None:
        """Get metadata for a specific component.

        Parameters
        ----------
        component_name : str
            Fully-qualified component name (e.g., ``"package.component"``).

        Returns
        -------
        ComponentManifest | None
            The manifest that declared this component, or ``None`` if unknown.
        """
        return self._metadata.get(component_name)

    def get_asset_root(self, component_name: str) -> Path | None:
        """Get the absolute asset root directory for a component if declared.

        Parameters
        ----------
        component_name : str
            Fully-qualified component name (e.g. "package.component").

        Returns
        -------
        Path | None
            Absolute path to the component's asset root if present, otherwise None.
        """
        return self._asset_roots.get(component_name)

    def get_asset_watch_roots(self) -> dict[str, Path]:
        """Get a mapping of component names to their asset root directories.

        Returns
        -------
        dict[str, Path]
            A shallow copy mapping fully-qualified component names to absolute
            asset root directories.
        """
        return dict(self._asset_roots)
