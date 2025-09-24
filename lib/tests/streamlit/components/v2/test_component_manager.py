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

import os
import tempfile
import threading
import time
from pathlib import Path

from streamlit.components.v2.component_manager import BidiComponentManager
from streamlit.components.v2.component_registry import BidiComponentDefinition
from streamlit.components.v2.manifest_scanner import ComponentConfig, ComponentManifest


def _setup_manager_with_manifest(tmp_path: Path) -> tuple[BidiComponentManager, str]:
    """Set up a BidiComponentManager with a manifest-backed component.

    Parameters
    ----------
    tmp_path : Path
        A temporary path to create the component package and assets.

    Returns
    -------
    tuple[BidiComponentManager, str]
        A tuple containing the component manager and the component name.
    """
    manager = BidiComponentManager()

    package_root = tmp_path / "pkg"
    assets = package_root / "assets"
    (assets / "js").mkdir(parents=True)
    (assets / "js" / "main.js").write_text("console.log('ok');")
    (assets / "style.css").write_text(".x{color:red}")

    manifest = ComponentManifest(
        name="pkg",
        version="0.0.1",
        components=[ComponentConfig(name="comp", asset_dir="assets")],
    )
    manager.register_from_manifest(manifest, package_root)

    comp_name = "pkg.comp"
    manager.register(BidiComponentDefinition(name=comp_name, html="<div>ok</div>"))
    return manager, comp_name


def test_manager_uses_lock_for_api_inputs(tmp_path: Path) -> None:
    """Verify manager exposes a lock and handles inputs safely during updates."""
    manager, comp_name = _setup_manager_with_manifest(tmp_path)

    # The manager is expected to expose an _api_inputs_lock used to guard access.
    assert hasattr(manager, "_api_inputs_lock"), (
        "BidiComponentManager must define _api_inputs_lock to guard _api_inputs"
    )

    # Exercise calls to ensure no exceptions and that state updates correctly
    manager.record_api_inputs(comp_name, css="*.css", js="js/*.js")
    manager._on_components_changed([comp_name])

    d = manager.get(comp_name)
    assert d is not None
    assert d.html_content == "<div>ok</div>"


def test_concurrent_record_and_change_no_exceptions(tmp_path: Path) -> None:
    """Stress concurrent access to record_api_inputs and change handling.

    This validates that under concurrent use there are no exceptions and the
    registry remains consistent. This will still pass without a lock in CPython
    in many cases due to the GIL, but combined with the lock assertion test
    above, we get stronger guarantees.
    """
    manager, comp_name = _setup_manager_with_manifest(tmp_path)

    stop_event = threading.Event()
    errors: list[BaseException] = []

    def writer() -> None:
        try:
            while not stop_event.is_set():
                manager.record_api_inputs(comp_name, css="*.css", js="js/*.js")
        except BaseException as e:  # pragma: no cover - diagnostic capture
            errors.append(e)

    def reader() -> None:
        try:
            while not stop_event.is_set():
                manager._on_components_changed([comp_name])
        except BaseException as e:  # pragma: no cover - diagnostic capture
            errors.append(e)

    threads = [threading.Thread(target=writer), threading.Thread(target=reader)]
    for t in threads:
        t.start()

    time.sleep(0.2)
    stop_event.set()
    for t in threads:
        t.join(timeout=2)

    assert not errors, f"Unexpected errors under concurrency: {errors}"

    # Registry remains valid
    d = manager.get(comp_name)
    assert d is not None
    assert d.html_content == "<div>ok</div>"


def test_get_component_path_prefers_asset_dir_when_present() -> None:
    """Verify manager returns manifest asset_dir over registry paths."""
    manager = BidiComponentManager()

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)

        # Create a registry-backed JS file in dir A
        dir_a = tmp_path / "dir_a"
        dir_a.mkdir(parents=True)
        js_a = dir_a / "index.js"
        js_a.write_text("console.log('A');")

        # Register component with file-backed JS path (registry fallback)
        comp_name = "pkg.slider"
        manager.register(
            BidiComponentDefinition(
                name=comp_name,
                js=str(js_a),
            )
        )

        # Prepare manifest-declared asset_dir (dir B)
        package_root = tmp_path / "package"
        assets_b = package_root / "assets"
        assets_b.mkdir(parents=True)
        (assets_b / "index.js").write_text("console.log('B');")

        manifest = ComponentManifest(
            name="pkg",
            version="0.0.1",
            components=[ComponentConfig(name="slider", asset_dir="assets")],
        )

        # Register manifest; manager should now prefer asset_dir
        manager.register_from_manifest(manifest, package_root)

        got = manager.get_component_path(comp_name)
        assert got is not None
        assert os.path.realpath(got) == os.path.realpath(str(assets_b))


def test_register_from_manifest_does_not_require_asset_dir() -> None:
    """Verify registering a component without asset_dir works."""
    manager = BidiComponentManager()

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)

        package_root = tmp_path / "package"
        package_root.mkdir(parents=True)

        manifest = ComponentManifest(
            name="pkg",
            version="0.0.1",
            components=[ComponentConfig(name="no_assets")],
        )
        manager.register_from_manifest(manifest, package_root)

        asset_root = manager.get_component_path("pkg.no_assets")
        assert asset_root is None


def test_on_components_changed_preserves_html_and_resolves_assets(
    tmp_path: Path,
) -> None:
    """Verify recompute preserves html and resolves assets under asset_dir."""
    manager = BidiComponentManager()

    # Prepare manifest with asset_dir
    package_root = tmp_path / "package"
    assets = package_root / "assets"
    (assets / "js").mkdir(parents=True)
    (assets / "style.css").write_text(".x { color: red; }")
    (assets / "js" / "main.js").write_text("console.log('ok');")

    manifest = ComponentManifest(
        name="pkg",
        version="0.0.1",
        components=[ComponentConfig(name="slider", asset_dir="assets")],
    )
    manager.register_from_manifest(manifest, package_root)

    comp_name = "pkg.slider"

    # Existing definition with html to be preserved during recompute
    manager.register(BidiComponentDefinition(name=comp_name, html="<p>orig</p>"))

    # Record API inputs as globs resolved relative to asset_dir
    manager.record_api_inputs(comp_name, css="*.css", js="js/*.js")

    # Trigger change handler for this component
    manager._on_components_changed([comp_name])

    # Validate outcome in the registry
    d = manager.get(comp_name)
    assert d is not None
    assert d.html_content == "<p>orig</p>"
    # File-backed entries expose asset-dir-relative URLs
    assert d.css_url == "style.css"
    assert d.js_url == "js/main.js"
    # Content properties must be None for file-backed entries
    assert d.css_content is None
    assert d.js_content is None
