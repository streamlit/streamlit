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

from typing import TYPE_CHECKING
from unittest.mock import MagicMock, patch

import pytest

from streamlit.components.v2 import component as component_api
from streamlit.components.v2.manifest_scanner import ComponentConfig, ComponentManifest
from streamlit.errors import StreamlitAPIException, StreamlitComponentRegistryError
from streamlit.runtime import Runtime

if TYPE_CHECKING:
    from pathlib import Path


def _with_runtime_manager(manager):
    """Create a patcher for the Runtime to inject a mock component manager."""
    return patch.object(
        Runtime, "instance", return_value=MagicMock(bidi_component_registry=manager)
    )


def test_api_accepts_paths_inside_asset_dir(tmp_path: Path) -> None:
    """API should accept js/css paths that resolve inside manifest-declared asset_dir."""
    from streamlit.components.v2.component_manager import BidiComponentManager

    manager = BidiComponentManager()
    manager.clear()

    # Package with asset_dir
    package_root = tmp_path / "pkg"
    asset_dir = package_root / "assets"
    asset_dir.mkdir(parents=True)
    js_file = asset_dir / "index-abc.js"
    css_file = asset_dir / "index.css"
    js_file.write_text("export default function(){}")
    css_file.write_text(".x{}")

    manifest = ComponentManifest(
        name="pkg",
        version="0.0.1",
        components=[ComponentConfig(name="slider", asset_dir="assets")],
    )
    manager.register_from_manifest(manifest, package_root)

    # Sanity: asset root is registered
    assert manager.get_component_asset_root("pkg.slider") is not None
    with (
        patch.object(Runtime, "exists", return_value=True),
        _with_runtime_manager(manager),
    ):
        # Provide asset-dir-relative paths (relative to asset_dir root)
        comp = component_api(name="pkg.slider", js="index-abc.js", css="index.css")
    assert callable(comp)


def test_api_rejects_paths_outside_asset_dir(tmp_path: Path) -> None:
    """API should reject js/css paths outside the manifest asset_dir."""
    from streamlit.components.v2.component_manager import BidiComponentManager

    manager = BidiComponentManager()
    manager.clear()

    package_root = tmp_path / "pkg"
    asset_dir = package_root / "assets"
    asset_dir.mkdir(parents=True)
    outside_file = tmp_path / "outside.js"
    outside_file.write_text("export default function(){}")

    manifest = ComponentManifest(
        name="pkg",
        version="0.0.1",
        components=[ComponentConfig(name="slider", asset_dir="assets")],
    )
    manager.register_from_manifest(manifest, package_root)

    with (
        patch.object(Runtime, "exists", return_value=True),
        _with_runtime_manager(manager),
    ):
        with pytest.raises(StreamlitComponentRegistryError):
            component_api(name="pkg.slider", js=str(outside_file))


def test_api_glob_expands_to_single_file(tmp_path: Path) -> None:
    """API should expand globs inside asset_dir to exactly one file."""
    from streamlit.components.v2.component_manager import BidiComponentManager

    manager = BidiComponentManager()
    manager.clear()

    package_root = tmp_path / "pkg"
    asset_dir = package_root / "assets"
    asset_dir.mkdir(parents=True)
    (asset_dir / "index-1.js").write_text("export default function(){}")

    manifest = ComponentManifest(
        name="pkg",
        version="0.0.1",
        components=[ComponentConfig(name="slider", asset_dir="assets")],
    )
    manager.register_from_manifest(manifest, package_root)

    with (
        patch.object(Runtime, "exists", return_value=True),
        _with_runtime_manager(manager),
    ):
        comp = component_api(name="pkg.slider", js="index-*.js")
    assert callable(comp)


def test_api_rejects_absolute_paths(tmp_path: Path) -> None:
    """API must reject absolute file paths for js/css inputs."""
    from streamlit.components.v2.component_manager import BidiComponentManager

    manager = BidiComponentManager()
    manager.clear()

    package_root = tmp_path / "pkg"
    asset_dir = package_root / "assets"
    asset_dir.mkdir(parents=True)
    js_file = asset_dir / "index.js"
    js_file.write_text("export default function(){}")

    manifest = ComponentManifest(
        name="pkg",
        version="0.0.1",
        components=[ComponentConfig(name="slider", asset_dir="assets")],
    )
    manager.register_from_manifest(manifest, package_root)

    abs_js = str(js_file.resolve())
    abs_css = str((asset_dir / "index.css").resolve())
    (asset_dir / "index.css").write_text(".x{}")

    with (
        patch.object(Runtime, "exists", return_value=True),
        _with_runtime_manager(manager),
    ):
        with pytest.raises(StreamlitComponentRegistryError):
            component_api(name="pkg.slider", js=abs_js)
        with pytest.raises(StreamlitComponentRegistryError):
            component_api(name="pkg.slider", css=abs_css)


def test_api_errors_when_missing_manifest_registration(tmp_path: Path) -> None:
    """If component is not declared in pyproject.toml, file-backed API must error."""
    from streamlit.components.v2.component_manager import BidiComponentManager

    manager = BidiComponentManager()
    manager.clear()

    # No manifest registration for manager
    package_root = tmp_path / "pkg"
    asset_dir = package_root / "assets"
    asset_dir.mkdir(parents=True)
    js_file = asset_dir / "index.js"
    js_file.write_text("export default function(){}")

    with (
        patch.object(Runtime, "exists", return_value=True),
        _with_runtime_manager(manager),
    ):
        with pytest.raises(StreamlitAPIException):
            component_api(name="pkg.slider", js=str(js_file))


def test_api_rejects_non_string_types(tmp_path: Path) -> None:
    """Reject non-string, non-None values for js/css parameters."""
    from streamlit.components.v2.component_manager import BidiComponentManager

    manager = BidiComponentManager()
    manager.clear()

    package_root = tmp_path / "pkg"
    asset_dir = package_root / "assets"
    asset_dir.mkdir(parents=True)
    (asset_dir / "index.js").write_text("export default function(){}")

    manifest = ComponentManifest(
        name="pkg",
        version="0.0.1",
        components=[ComponentConfig(name="slider", asset_dir="assets")],
    )
    manager.register_from_manifest(manifest, package_root)

    with (
        patch.object(Runtime, "exists", return_value=True),
        _with_runtime_manager(manager),
    ):
        with pytest.raises(StreamlitAPIException):
            component_api(name="pkg.slider", js=123)  # type: ignore[arg-type]
        with pytest.raises(StreamlitAPIException):
            component_api(name="pkg.slider", css=["invalid"])  # type: ignore[arg-type]
