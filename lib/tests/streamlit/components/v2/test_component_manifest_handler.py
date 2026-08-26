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

import os
import tempfile
from pathlib import Path

import pytest

from streamlit.components.v2.component_manifest_handler import (
    ComponentManifestHandler,
)
from streamlit.components.v2.manifest_scanner import ComponentConfig, ComponentManifest
from streamlit.errors import StreamlitComponentRegistryError


def test_component_manifest_handler_stores_asset_dir() -> None:
    """Test that ComponentManifestHandler parses and persists asset_dir per component."""
    # Create a manifest with an asset_dir entry
    manifest = ComponentManifest(
        name="test-package",
        version="1.0.0",
        components=[ComponentConfig(name="slider", asset_dir="slider/assets")],
    )

    handler = ComponentManifestHandler()

    # Create a real temp package root and asset_dir to satisfy existence check
    with tempfile.TemporaryDirectory() as temp_dir:
        package_root = Path(temp_dir)
        os.makedirs(package_root / "slider" / "assets")

        handler.process_manifest(manifest, package_root)

    # Fully qualified name
    comp_full_name = "test-package.slider"
    asset_root = handler.get_asset_root(comp_full_name)

    assert asset_root is not None
    assert asset_root == (package_root / "slider/assets").resolve()


def test_component_manifest_handler_get_asset_root_none_when_missing() -> None:
    """Test that get_asset_root returns None when asset_dir is not provided."""
    manifest = ComponentManifest(
        name="test-package",
        version="1.0.0",
        components=[ComponentConfig(name="slider")],
    )

    handler = ComponentManifestHandler()
    package_root = Path("/pkg/root")

    handler.process_manifest(manifest, package_root)

    comp_full_name = "test-package.slider"
    assert handler.get_asset_root(comp_full_name) is None


@pytest.mark.skipif(not hasattr(os, "symlink"), reason="OS does not support symlinks")
def test_component_manifest_handler_rejects_asset_dir_symlink_outside_root() -> None:
    """asset_dir that resolves outside package_root via symlink must be rejected."""
    manifest = ComponentManifest(
        name="test-package",
        version="1.0.0",
        components=[ComponentConfig(name="widget", asset_dir="linked_outside")],
    )

    handler = ComponentManifestHandler()

    with tempfile.TemporaryDirectory() as temp_dir:
        package_root = Path(temp_dir) / "pkg"
        outside_root = Path(temp_dir) / "outside"
        real_outside_assets = outside_root / "assets"
        real_outside_assets.mkdir(parents=True, exist_ok=True)

        link_inside = package_root / "linked_outside"
        link_inside.parent.mkdir(parents=True, exist_ok=True)

        try:
            os.symlink(
                str(real_outside_assets), str(link_inside), target_is_directory=True
            )
        except (OSError, NotImplementedError):
            pytest.skip("Symlink creation not permitted in this environment")

        with pytest.raises(StreamlitComponentRegistryError):
            handler.process_manifest(manifest, package_root)


@pytest.mark.skipif(not hasattr(os, "symlink"), reason="OS does not support symlinks")
def test_component_manifest_handler_allows_symlink_within_root() -> None:
    """asset_dir symlinked within package_root should be accepted and resolved."""
    manifest = ComponentManifest(
        name="test-package",
        version="1.0.0",
        components=[ComponentConfig(name="widget", asset_dir="linked_inside")],
    )

    handler = ComponentManifestHandler()

    with tempfile.TemporaryDirectory() as temp_dir:
        package_root = Path(temp_dir) / "pkg"
        real_assets = package_root / "real_assets"
        real_assets.mkdir(parents=True, exist_ok=True)

        link_inside = package_root / "linked_inside"
        try:
            os.symlink(str(real_assets), str(link_inside), target_is_directory=True)
        except (OSError, NotImplementedError):
            pytest.skip("Symlink creation not permitted in this environment")

        handler.process_manifest(manifest, package_root)

        comp_full_name = "test-package.widget"
        asset_root = handler.get_asset_root(comp_full_name)
        assert asset_root == real_assets.resolve()
