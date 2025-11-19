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

"""Custom Components v2 manager and supporting orchestration.

This module composes the registry, manifest handling, and file watching
capabilities for Streamlit's Custom Components v2. It provides a unified
interface to register components from manifests or individual definitions, query
component metadata and asset paths, and react to on-disk changes by re-resolving
component definitions.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass
from typing import TYPE_CHECKING, Final

from streamlit.components.v2.component_definition_resolver import (
    build_definition_with_validation,
)
from streamlit.components.v2.component_file_watcher import ComponentFileWatcher
from streamlit.components.v2.component_manifest_handler import ComponentManifestHandler
from streamlit.components.v2.component_registry import (
    BidiComponentDefinition,
    BidiComponentRegistry,
)
from streamlit.logger import get_logger

if TYPE_CHECKING:
    from pathlib import Path

    from streamlit.components.v2.manifest_scanner import ComponentManifest

_LOGGER: Final = get_logger(__name__)


@dataclass
class _ApiInputs:
    """Inputs provided via the Python API to resolve a component definition.

    Attributes
    ----------
    css : str | None
        Inline CSS content or a path/glob to a CSS asset within ``asset_dir``.
    js : str | None
        Inline JS content or a path/glob to a JS asset within ``asset_dir``.
    """

    css: str | None
    js: str | None


class BidiComponentManager:
    """Manager class that composes component registry, manifest handler, and
    file watcher.

    This class provides a unified interface for working with bidirectional
    components while maintaining clean separation of concerns through
    composition. It handles the coordination and lifecycle management of all
    component-related functionality.

    Component Lifecycle
    -------------------
    The lifecycle of a component managed by this class involves four key stages:

    1.  **Discovery**: On startup, ``discover_and_register_components`` scans
        for installed packages with component manifests (``pyproject.toml``).
        For each component found, a placeholder definition containing only its
        name and ``asset_dir`` is registered. This makes the system aware of all
        available installed components from the outset.

    2.  **Definition & Validation**: When a user's script calls the public API
        (e.g., ``st.components.v2.component(...)``), the manager invokes
        ``build_definition_with_validation``. This function is the single,
        centralized point for all validation. It resolves file paths, performs
        security checks against the component's ``asset_dir``, and produces a
        complete, validated ``BidiComponentDefinition``.

    3.  **Registration**: The validated definition is then passed to the
        registry's ``register`` method. This adds the complete definition,
        overwriting the placeholder if one existed from the discovery phase.

    4.  **Updating**: The ``ComponentFileWatcher`` monitors the ``asset_dir``
        for changes. On a change, it triggers a re-computation of the definition
        using the original API inputs, runs it through the same validation
        logic, and updates the registry with the new definition via the stricter
        ``update_component`` method.

    Notes
    -----
    This manager intentionally favors composition over inheritance and delegates
    specialized responsibilities to ``BidiComponentRegistry``,
    ``ComponentManifestHandler``, and ``ComponentFileWatcher``.
    """

    def __init__(
        self,
        registry: BidiComponentRegistry | None = None,
        manifest_handler: ComponentManifestHandler | None = None,
        file_watcher: ComponentFileWatcher | None = None,
    ) -> None:
        """Initialize the component manager.

        Parameters
        ----------
        registry : BidiComponentRegistry, optional
            Component registry instance. If not provided, a new one will be created.
        manifest_handler : ComponentManifestHandler, optional
            Manifest handler instance. If not provided, a new one will be created.
        file_watcher : ComponentFileWatcher, optional
            File watcher instance. If not provided, a new one will be created.
        """
        # Create dependencies
        self._registry = registry or BidiComponentRegistry()
        self._manifest_handler = manifest_handler or ComponentManifestHandler()
        # Store API inputs for re-resolution on change events
        self._api_inputs: dict[str, _ApiInputs] = {}
        self._api_inputs_lock = threading.Lock()
        self._file_watcher = file_watcher or ComponentFileWatcher(
            self._on_components_changed
        )

    def record_api_inputs(
        self, component_key: str, css: str | None, js: str | None
    ) -> None:
        """Record original API inputs for later re-resolution on file changes.

        Parameters
        ----------
        component_key : str
            Fully-qualified component name.
        css : str | None
            Inline CSS or a path/glob to a CSS file within the component's
            ``asset_dir``.
        js : str | None
            Inline JavaScript or a path/glob to a JS file within the component's
            ``asset_dir``.
        """
        with self._api_inputs_lock:
            self._api_inputs[component_key] = _ApiInputs(css=css, js=js)

    def register_from_manifest(
        self, manifest: ComponentManifest, package_root: Path
    ) -> None:
        """Register components from a manifest file.

        This is a high-level method that processes the manifest and registers
        all components found within it.

        Parameters
        ----------
        manifest : ComponentManifest
            The component manifest to process.
        package_root : Path
            Root path of the package containing the components.
        """
        # First process the manifest
        component_definitions = self._manifest_handler.process_manifest(
            manifest, package_root
        )

        # Register all component definitions
        self._registry.register_components_from_definitions(component_definitions)

        _LOGGER.debug(
            "Registered %d components from manifest", len(component_definitions)
        )

    def register(self, definition: BidiComponentDefinition) -> None:
        """Register a single component definition.

        Parameters
        ----------
        definition : BidiComponentDefinition
            The component definition to register.
        """
        self._registry.register(definition)

    def get(self, name: str) -> BidiComponentDefinition | None:
        """Get a component definition by name.

        Parameters
        ----------
        name : str
            The name of the component to retrieve.

        Returns
        -------
        BidiComponentDefinition or None
            The component definition if found; otherwise ``None``.
        """
        return self._registry.get(name)

    def build_definition_with_validation(
        self,
        *,
        component_key: str,
        html: str | None,
        css: str | None,
        js: str | None,
    ) -> BidiComponentDefinition:
        """Build a validated component definition for the given inputs.

        Parameters
        ----------
        component_key : str
            Fully-qualified component name the definition is for.
        html : str | None
            Inline HTML content to include in the definition.
        css : str | None
            Inline CSS content or a path/glob under the component's asset_dir.
        js : str | None
            Inline JS content or a path/glob under the component's asset_dir.

        Returns
        -------
        BidiComponentDefinition
            The fully validated component definition.
        """
        return build_definition_with_validation(
            manager=self,
            component_key=component_key,
            html=html,
            css=css,
            js=js,
        )

    def get_component_asset_root(self, name: str) -> Path | None:
        """Get the asset root for a manifest-backed component.

        Parameters
        ----------
        name : str
            The name of the component to get the asset root for.

        Returns
        -------
        Path or None
            The component's ``asset_root`` directory if found; otherwise
            ``None``.
        """
        return self._manifest_handler.get_asset_root(name)

    def unregister(self, name: str) -> None:
        """Unregister a component by name.

        Parameters
        ----------
        name : str
            The name of the component to unregister.
        """
        self._registry.unregister(name)

    def clear(self) -> None:
        """Clear all registered components."""
        self._registry.clear()

    def get_component_path(self, name: str) -> str | None:
        """Get the filesystem path for a manifest-backed component.

        Parameters
        ----------
        name : str
            The name of the component.

        Returns
        -------
        str or None
            The component's ``asset_dir`` directory if found; otherwise
            ``None``.
        """
        asset_root = self._manifest_handler.get_asset_root(name)
        if asset_root is not None:
            return str(asset_root)

        return None

    def start_file_watching(self) -> None:
        """Start file watching for component changes."""
        if self._file_watcher.is_watching_active:
            _LOGGER.warning("File watching is already started")
            return

        # Get asset watch roots from manifest handler
        asset_roots = self._manifest_handler.get_asset_watch_roots()

        # Start file watching
        self._file_watcher.start_file_watching(asset_roots)

        if self._file_watcher.is_watching_active:
            _LOGGER.debug("Started file watching for component changes")  # type: ignore[unreachable]
        else:
            _LOGGER.debug("File watching not started")

    def discover_and_register_components(
        self, *, start_file_watching: bool = True
    ) -> None:
        """Discover installed v2 components and register them.

        This scans installed distributions for manifests, registers all discovered
        components, and starts file watching for development workflows.

        Parameters
        ----------
        start_file_watching : bool
            Whether to start file watching after components are registered.
        """
        try:
            from streamlit.components.v2.manifest_scanner import (
                scan_component_manifests,
            )

            manifests = scan_component_manifests()
            for manifest, package_root in manifests:
                self.register_from_manifest(manifest, package_root)
                _LOGGER.debug(
                    "Registered components from pyproject.toml: %s v%s",
                    manifest.name,
                    manifest.version,
                )

            # Start file watching for development mode after all components are registered
            if start_file_watching:
                self.start_file_watching()

        except Exception as e:
            _LOGGER.warning("Failed to scan component manifests: %s", e)

    def stop_file_watching(self) -> None:
        """Stop file watching."""
        if not self._file_watcher.is_watching_active:
            _LOGGER.warning("File watching is not started")
            return

        self._file_watcher.stop_file_watching()

        _LOGGER.debug("Stopped file watching")

    def get_metadata(self, component_name: str) -> ComponentManifest | None:
        """Get metadata for a component.

        Parameters
        ----------
        component_name : str
            The name of the component to get metadata for.

        Returns
        -------
        ComponentManifest or None
            The component metadata if found; otherwise ``None``.
        """
        return self._manifest_handler.get_metadata(component_name)

    def _on_components_changed(self, component_names: list[str]) -> None:
        """Handle change events for components' asset roots.

        For each component, re-resolve from stored API inputs and update the
        registry with the new definition if resolution succeeds.

        Parameters
        ----------
        component_names : list[str]
            Fully-qualified component names whose watched files changed.
        """
        for name in component_names:
            try:
                updated_def = self._recompute_definition_from_api(name)
                if updated_def is not None:
                    self._registry.update_component(updated_def)
            except Exception:  # noqa: PERF203
                _LOGGER.exception("Failed to update component after change: %s", name)

    def _recompute_definition_from_api(
        self, component_name: str
    ) -> BidiComponentDefinition | None:
        """Recompute a component's definition using previously recorded API inputs.

        Parameters
        ----------
        component_name : str
            Fully-qualified component name to recompute.

        Returns
        -------
        BidiComponentDefinition | None
            A fully validated component definition suitable for replacing the
            stored entry in the registry, or ``None`` if recomputation failed
            or no API inputs were previously recorded.
        """
        with self._api_inputs_lock:
            inputs = self._api_inputs.get(component_name)
            if inputs is None:
                return None

            # Get existing def to preserve html unless new content is provided later
            existing_def = self._registry.get(component_name)
            html_value = existing_def.html if existing_def else None

            try:
                # Resolve a fully validated definition from stored API inputs and
                # the preserved html value from the existing definition.
                new_def = self.build_definition_with_validation(
                    component_key=component_name,
                    html=html_value,
                    css=inputs.css,
                    js=inputs.js,
                )
            except Exception as e:
                _LOGGER.debug(
                    "Skipping update for %s due to re-resolution error: %s",
                    component_name,
                    e,
                )
                return None

        return new_def

    @property
    def is_file_watching_started(self) -> bool:
        """Check if file watching is currently active.

        Returns
        -------
        bool
            True if file watching is started, False otherwise
        """
        return self._file_watcher.is_watching_active
