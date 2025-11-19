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
from unittest.mock import MagicMock, patch

import pytest

from streamlit.components.v2 import component
from streamlit.components.v2.component_manager import BidiComponentManager
from streamlit.components.v2.component_path_utils import ComponentPathUtils
from streamlit.components.v2.component_registry import (
    BidiComponentDefinition,
    BidiComponentRegistry,
)
from streamlit.components.v2.manifest_scanner import ComponentConfig, ComponentManifest
from streamlit.errors import StreamlitAPIException, StreamlitComponentRegistryError


def _mk_file(path: os.PathLike[str] | str, content: bytes | str = b"x") -> str:
    """Create a file and return its absolute path.

    Parameters
    ----------
    path
        Path to write. Parent directories are created if they don't exist.
    content
        Bytes or text to write to the file. Defaults to a single ``x`` byte.

    Returns
    -------
    str
        Absolute path to the created file.
    """
    p = os.fspath(path)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    mode = "wb" if isinstance(content, (bytes, bytearray)) else "w"
    with open(p, mode) as f:
        f.write(content)
    return os.path.abspath(p)


def test_path_classification_and_resolution(tmp_path) -> None:
    """Verify classification at dataclass layer: absolute paths vs inline.

    - Accepts absolute file paths (post-validation upstream).
    - Rejects relative, path-like strings.
    - Treats inline-like content as inline.
    """
    base_dir = tmp_path / "base"
    caller_dir = base_dir / "pkg" / "subpkg"
    caller_file = caller_dir / "fakecaller.py"

    # Files to be resolved relative to caller_dir
    style_css = caller_dir / "style.css"
    assets_js = caller_dir / "assets" / "app.js"
    bare_js = caller_dir / "script.js"
    upper_js = base_dir / "pkg" / "upper.js"  # resolves via ../upper.js from subpkg

    _mk_file(caller_file)
    _mk_file(style_css)
    _mk_file(assets_js)
    _mk_file(bare_js)
    _mk_file(upper_js)

    d1 = BidiComponentDefinition(name="c1", css=os.fspath(style_css))
    assert d1._has_css_path is True
    assert d1.source_paths["css"] == os.path.dirname(os.fspath(style_css))
    assert d1.css_url == "style.css"

    with pytest.raises(ValueError, match=r"Relative file paths are not accepted"):
        BidiComponentDefinition(name="c_bad", js="../upper.js")

    # Accept: path with separator
    d2 = BidiComponentDefinition(name="c2", js=os.fspath(assets_js))
    assert d2._has_js_path is True
    assert d2.source_paths["js"] == os.path.dirname(os.fspath(assets_js))

    # Reject: bare filename with known extension (relative path-like)
    with pytest.raises(ValueError, match=r"Relative file paths are not accepted"):
        BidiComponentDefinition(name="c3", js="script.js")

    # Inline-like content is not treated as a path
    d4 = BidiComponentDefinition(
        name="c4",
        html="<div>Hi</div>",
        css=".class { color: red; }",
        js="function f() { return 1; }",
    )
    assert d4._has_css_path is False
    assert d4._has_js_path is False
    assert d4.css_content == ".class { color: red; }"
    assert d4.js_content == "function f() { return 1; }"
    assert d4.html_content == "<div>Hi</div>"


@pytest.mark.parametrize(
    ("overrides", "expected_css_url", "expected_js_url"),
    [
        (
            {
                "css_asset_relative_path": "assets/bundle.css",
                "js_asset_relative_path": "build/main.mjs",
            },
            "assets/bundle.css",
            "build/main.mjs",
        ),
        ({}, "style.css", "main.js"),
    ],
)
def test_asset_url_overrides_and_defaults(
    tmp_path,
    monkeypatch,
    overrides: dict[str, str],
    expected_css_url: str,
    expected_js_url: str,
) -> None:
    """Verify that asset URL overrides take precedence over default filenames."""
    caller_dir = tmp_path / "caller"
    caller_file = caller_dir / "fakecaller.py"
    css_file = caller_dir / "style.css"
    js_file = caller_dir / "main.js"
    _mk_file(caller_file)
    _mk_file(css_file)
    _mk_file(js_file)

    d = BidiComponentDefinition(
        name="c",
        css=os.fspath(css_file),
        js=os.fspath(js_file),
        **overrides,
    )
    assert d.css_url == expected_css_url
    assert d.js_url == expected_js_url


@pytest.mark.parametrize(
    ("css_input", "js_input", "expected_css_url", "expected_js_url"),
    [
        (
            "build/static/css/main.css",
            "build/static/js/main.js",
            "build/static/css/main.css",
            "build/static/js/main.js",
        ),
        (
            "styles/bundle.css",
            "main.js",
            "styles/bundle.css",
            "main.js",
        ),
    ],
)
def test_default_asset_url_preserves_subpath(
    tmp_path,
    monkeypatch,
    css_input: str,
    js_input: str,
    expected_css_url: str,
    expected_js_url: str,
) -> None:
    """Verify that default asset URLs preserve subpaths and simple filenames."""
    caller_dir = tmp_path / "caller"
    caller_file = caller_dir / "fakecaller.py"
    css_file = caller_dir / css_input
    js_file = caller_dir / js_input
    _mk_file(caller_file)
    _mk_file(css_file)
    _mk_file(js_file)

    d = BidiComponentDefinition(
        name="c",
        css=os.fspath(css_file),
        js=os.fspath(js_file),
        css_asset_relative_path=css_input,
        js_asset_relative_path=js_input,
    )
    assert d.css_url == expected_css_url
    assert d.js_url == expected_js_url


def test_register_components_respects_asset_overrides(tmp_path: Path) -> None:
    """Verify that the registry preserves asset URL overrides on registration."""
    css_path = _mk_file(tmp_path / "c" / "style.css")
    js_path = _mk_file(tmp_path / "c" / "main.js")

    reg = BidiComponentRegistry()
    reg.register_components_from_definitions(
        {
            "comp": {
                "name": "comp",
                "html": None,
                "css": css_path,
                "js": js_path,
                "css_asset_relative_path": "assets/styles.css",
                "js_asset_relative_path": "build/app.js",
            }
        }
    )

    d = reg.get("comp")
    assert d is not None
    assert d.css_url == "assets/styles.css"
    assert d.js_url == "build/app.js"


def test_update_component_merge_enforcement() -> None:
    """Verify that updates preserve missing fields and enforce name matching."""
    reg = BidiComponentRegistry()

    # Initial inline definition
    d0 = BidiComponentDefinition(name="comp", html=None, css="orig-css", js="orig-js")
    reg.register(d0)

    # Attempt to update only js and css override
    d1 = BidiComponentDefinition(
        name="comp",
        html=None,
        css="new-css",
        js="new-js",
    )

    reg.update_component(d1)

    d = reg.get("comp")
    assert d is not None
    assert d.name == "comp"
    assert d.html_content is None
    # css and js are updated
    assert d.css_content == "new-css"
    assert d.js_content == "new-js"


def test_update_component_replaces_definition() -> None:
    """Verify that `update_component` replaces the stored definition by name."""
    reg = BidiComponentRegistry()

    # Initial inline definition
    d0 = BidiComponentDefinition(name="comp", html=None, css="orig-css", js="orig-js")
    reg.register(d0)

    # New fully-validated definition (simulating resolver output)
    d1 = BidiComponentDefinition(
        name="comp",
        html="<div></div>",
        css="new-css",
        js="new-js",
        css_asset_relative_path="x.css",
    )

    reg.update_component(d1)

    d = reg.get("comp")
    assert d is not None
    assert d.name == "comp"
    assert d.html_content == "<div></div>"
    assert d.css_content == "new-css"
    assert d.js_content == "new-js"
    assert d.css_asset_relative_path == "x.css"


def test_update_component_can_clear_fields_via_none() -> None:
    """Verify that passing None to `update_component` clears fields."""
    reg = BidiComponentRegistry()

    d0 = BidiComponentDefinition(
        name="comp",
        html="<div>keep?</div>",
        css="inline-css",
        js="inline-js",
    )
    reg.register(d0)

    # Provide a definition that clears css/js and html explicitly via None
    d1 = BidiComponentDefinition(name="comp", html=None, css=None, js=None)
    reg.update_component(d1)

    d = reg.get("comp")
    assert d is not None
    assert d.html_content is None
    assert d.css_content is None
    assert d.js_content is None


def test_update_component_raises_for_unregistered_definition() -> None:
    """Verify `update_component` raises for an unregistered definition."""
    reg = BidiComponentRegistry()

    d = BidiComponentDefinition(name="unknown", html=None, css=None, js=None)

    with pytest.raises(
        StreamlitComponentRegistryError,
        match=r"^Cannot update unregistered component: unknown$",
    ):
        reg.update_component(d)


@pytest.fixture
def temp_test_files() -> dict:
    """Create a temporary directory with test files for definition tests."""
    temp_dir = tempfile.TemporaryDirectory()

    # Create test files
    js_path = os.path.join(temp_dir.name, "index.js")
    with open(js_path, "w") as f:
        f.write("console.log('test');")

    html_path = os.path.join(temp_dir.name, "index.html")
    with open(html_path, "w") as f:
        f.write("<div>Test</div>")

    css_path = os.path.join(temp_dir.name, "styles.css")
    with open(css_path, "w") as f:
        f.write("div { color: blue; }")

    yield {
        "temp_dir": temp_dir,
        "js_path": js_path,
        "html_path": html_path,
        "css_path": css_path,
    }

    temp_dir.cleanup()


@pytest.fixture
def temp_manager_setup() -> dict:
    """Create a temporary directory and manager for BidiComponentManager tests."""
    temp_dir = tempfile.TemporaryDirectory()
    component_manager = BidiComponentManager()

    # Create test files
    js_path = os.path.join(temp_dir.name, "index.js")
    with open(js_path, "w") as f:
        f.write("console.log('test');")

    yield {
        "temp_dir": temp_dir,
        "component_manager": component_manager,
        "js_path": js_path,
    }

    temp_dir.cleanup()


def test_string_content(temp_test_files) -> None:
    """Test component instantiation with direct string content."""
    comp = BidiComponentDefinition(
        name="test",
        html="<div>Hello</div>",
        css=".div { color: red; }",
        js="console.log('hello');",
    )

    assert comp.html_content == "<div>Hello</div>"
    assert comp.css_content == ".div { color: red; }"
    assert comp.js_content == "console.log('hello');"
    assert comp.css_url is None
    assert comp.js_url is None
    assert comp.source_paths == {}


def test_newline_strings_treated_as_inline() -> None:
    """Verify that strings with newlines are treated as inline content."""
    multi_line_js = "export default function() {\n  console.log('hi');\n}"
    multi_line_css = ".root {\n  color: red;\n}"
    multi_line_html = "<div>\n  <span>hi</span>\n</div>"

    comp = BidiComponentDefinition(
        name="newline_test",
        html=multi_line_html,
        css=multi_line_css,
        js=multi_line_js,
    )

    # Inline content should be exposed via *_content and have no URLs
    assert comp.html_content == multi_line_html
    assert comp.css_content == multi_line_css
    assert comp.js_content == multi_line_js
    assert comp.css_url is None
    assert comp.js_url is None
    assert comp.source_paths == {}


def test_file_path_content(temp_test_files) -> None:
    """Test component instantiation with absolute file path content."""
    comp = BidiComponentDefinition(
        name="test",
        js=temp_test_files["js_path"],
        html="<div>Inline HTML</div>",  # HTML should be a string, not a path
        css=temp_test_files["css_path"],
    )

    assert comp.html_content == "<div>Inline HTML</div>"
    assert comp.css_content is None  # CSS content is None because it's a path
    assert comp.js_content is None  # JS content is None because it's a path

    # Check URLs are generated for path resources
    assert comp.css_url == f"{os.path.basename(temp_test_files['css_path'])}"
    assert comp.js_url == f"{os.path.basename(temp_test_files['js_path'])}"

    # Check source paths
    assert len(comp.source_paths) == 2
    assert comp.source_paths["css"] == os.path.dirname(temp_test_files["css_path"])
    assert comp.source_paths["js"] == os.path.dirname(temp_test_files["js_path"])
    assert "html" not in comp.source_paths


def test_mixed_content(temp_test_files) -> None:
    """Test component instantiation with mixed string and file content."""
    comp = BidiComponentDefinition(
        name="test",
        js=temp_test_files["js_path"],
        html="<div>Inline HTML</div>",
        css="div { color: green; }",
    )

    assert comp.html_content == "<div>Inline HTML</div>"
    assert comp.css_content == "div { color: green; }"
    assert comp.js_content is None  # JS content is None because it's a path

    assert comp.css_url is None  # No URL for inline CSS
    assert comp.js_url == f"{os.path.basename(temp_test_files['js_path'])}"

    assert len(comp.source_paths) == 1
    assert comp.source_paths["js"] == os.path.dirname(temp_test_files["js_path"])


def test_public_api_path_object_rejection() -> None:
    """Verify the public API rejects non-string path-like objects."""
    from pathlib import Path

    with pytest.raises(StreamlitAPIException) as exc_info:
        component("test", js=Path("test.js"))
    msg = str(exc_info.value)
    assert "string or None" in msg
    assert "string path or glob" in msg

    with pytest.raises(StreamlitAPIException) as exc_info:
        component("test", css=Path("test.css"))
    msg = str(exc_info.value)
    assert "string or None" in msg
    assert "string path or glob" in msg

    # Still raise for other invalid types
    with pytest.raises(StreamlitAPIException):
        component("test", js=123)  # Integer instead of string/Path

    with pytest.raises(StreamlitAPIException):
        component("test", css=["invalid", "list"])  # List instead of string/Path


def test_register_from_manifest_basic(temp_manager_setup) -> None:
    """Test basic manifest registration with a single component.

    Note
    ----
    JS/CSS entries in the manifest are ignored.
    """
    setup = temp_manager_setup
    # Create component files in package root
    package_root = Path(setup["temp_dir"].name)
    # Files may exist but are not read from manifest anymore
    (package_root / "component.js").write_text(
        "export default function() { console.log('basic test'); }"
    )
    (package_root / "styles.css").write_text(".test { color: blue; }")

    manifest = ComponentManifest(
        name="test_package",
        version="1.0.0",
        components=[
            ComponentConfig(
                name="basic_component",
            )
        ],
    )

    setup["component_manager"].register_from_manifest(manifest, package_root)

    # Check component was registered
    component = setup["component_manager"].get("test_package.basic_component")
    assert component is not None
    assert component.name == "test_package.basic_component"
    # Assert that html/js/css are None because they must be provided via the
    # st.components.v2.component() API
    assert component.html_content is None
    assert component.js_content is None
    assert component.css_content is None

    # Check metadata was stored
    assert (
        setup["component_manager"].get_metadata("test_package.basic_component")
        == manifest
    )


def test_register_from_manifest_multiple_components(temp_manager_setup) -> None:
    """Test manifest registration with multiple components."""
    setup = temp_manager_setup
    package_root = Path(setup["temp_dir"].name)

    # Create files (not used by manifest anymore)
    (package_root / "comp1.js").write_text("console.log('component 1');")
    (package_root / "comp1.css").write_text(".comp1 { background: red; }")
    (package_root / "comp2.js").write_text("console.log('component 2');")

    manifest = ComponentManifest(
        name="multi_package",
        version="2.0.0",
        components=[
            ComponentConfig(
                name="component_one",
            ),
            ComponentConfig(
                name="component_two",
            ),
        ],
    )

    setup["component_manager"].register_from_manifest(manifest, package_root)

    # Check first component was registered
    comp1 = setup["component_manager"].get("multi_package.component_one")
    assert comp1 is not None
    assert comp1.name == "multi_package.component_one"
    assert comp1.html_content is None
    assert comp1.js_content is None
    assert comp1.css_content is None

    # Check second component was registered
    comp2 = setup["component_manager"].get("multi_package.component_two")
    assert comp2 is not None
    assert comp2.name == "multi_package.component_two"
    assert comp2.html_content is None
    assert comp2.js_content is None
    assert comp2.css_content is None

    # Check both components have same manifest metadata
    assert (
        setup["component_manager"].get_metadata("multi_package.component_one")
        == manifest
    )
    assert (
        setup["component_manager"].get_metadata("multi_package.component_two")
        == manifest
    )


def test_register_from_manifest_minimal_component(temp_manager_setup) -> None:
    """Test manifest registration with a minimal component (only HTML)."""
    setup = temp_manager_setup
    package_root = Path(setup["temp_dir"].name)

    manifest = ComponentManifest(
        name="minimal_package",
        version="0.1.0",
        components=[ComponentConfig(name="html_only")],
    )

    setup["component_manager"].register_from_manifest(manifest, package_root)

    # Check component was registered
    component = setup["component_manager"].get("minimal_package.html_only")
    assert component is not None
    assert component.name == "minimal_package.html_only"
    assert component.html_content is None
    assert component.js_content is None
    assert component.css_content is None

    # Check metadata
    assert (
        setup["component_manager"].get_metadata("minimal_package.html_only") == manifest
    )


def test_register_from_manifest_empty_components(temp_manager_setup) -> None:
    """Test that manifest registration handles an empty components list."""
    setup = temp_manager_setup
    package_root = Path(setup["temp_dir"].name)

    manifest = ComponentManifest(
        name="empty_package",
        version="1.0.0",
        components=[],
    )

    setup["component_manager"].register_from_manifest(manifest, package_root)


def test_register_from_manifest_overwrites_existing(temp_manager_setup) -> None:
    """Verify that manifest registration overwrites existing components."""
    setup = temp_manager_setup
    package_root = Path(setup["temp_dir"].name)
    js_file = package_root / "component.js"
    js_file.write_text("console.log('original');")

    # Register first version
    manifest1 = ComponentManifest(
        name="test_package",
        version="1.0.0",
        components=[
            ComponentConfig(
                name="component",
            )
        ],
    )

    setup["component_manager"].register_from_manifest(manifest1, package_root)

    # Check first registration
    component = setup["component_manager"].get("test_package.component")
    assert component.html_content is None

    # Register updated version
    js_file.write_text("console.log('updated');")
    manifest2 = ComponentManifest(
        name="test_package",
        version="2.0.0",
        components=[
            ComponentConfig(
                name="component",
            )
        ],
    )

    with patch("streamlit.logger.get_logger") as mock_logger:
        setup["component_manager"].register_from_manifest(manifest2, package_root)

        # Should not log warning for manifest registration (different from manual registration)
        mock_logger.return_value.warning.assert_not_called()

    # Check component was updated
    updated_component = setup["component_manager"].get("test_package.component")
    assert updated_component.html_content is None
    assert (
        setup["component_manager"].get_metadata("test_package.component") == manifest2
    )


def test_register_from_manifest_thread_safety(temp_manager_setup) -> None:
    """Verify that manifest registration is thread-safe."""
    setup = temp_manager_setup
    package_root = Path(setup["temp_dir"].name)
    js_file = package_root / "thread_test.js"
    js_file.write_text("console.log('thread test');")

    results = []
    errors = []

    def register_manifest(thread_id: int) -> None:
        try:
            manifest = ComponentManifest(
                name=f"thread_package_{thread_id}",
                version="1.0.0",
                components=[
                    ComponentConfig(
                        name="thread_component",
                    )
                ],
            )

            # Add small delay to increase chance of race conditions
            time.sleep(0.01)

            setup["component_manager"].register_from_manifest(manifest, package_root)
            results.append(thread_id)

        except Exception as e:
            errors.append(e)

    # Create multiple threads
    threads = []
    for i in range(5):
        thread = threading.Thread(target=register_manifest, args=(i,))
        threads.append(thread)
        thread.start()

    # Wait for all threads to complete
    for thread in threads:
        thread.join()

    # Check all threads completed successfully
    assert len(errors) == 0
    assert len(results) == 5
    assert set(results) == {0, 1, 2, 3, 4}

    # Check all components were registered
    for i in range(5):
        component = setup["component_manager"].get(
            f"thread_package_{i}.thread_component"
        )
        assert component is not None
        assert component.html_content is None


def test_resolve_glob_pattern_direct() -> None:
    """Test the `ComponentPathUtils.resolve_glob_pattern` function directly."""

    with tempfile.TemporaryDirectory() as temp_dir:
        package_root = Path(temp_dir)

        # Create test file
        test_file = os.path.join(temp_dir, "test-pattern.js")
        with open(test_file, "w") as f:
            f.write("console.log('test');")

        # Test successful resolution
        resolved = ComponentPathUtils.resolve_glob_pattern("test-*.js", package_root)
        assert str(resolved.resolve()) == Path(test_file).resolve().as_posix()

        # Test no matches
        with pytest.raises(StreamlitComponentRegistryError) as exc_info:
            ComponentPathUtils.resolve_glob_pattern("nomatch-*.js", package_root)
        assert "No files found matching pattern" in str(exc_info.value)

        # Test multiple matches
        duplicate_file = os.path.join(temp_dir, "test-duplicate.js")
        with open(duplicate_file, "w") as f:
            f.write("console.log('duplicate');")

        with pytest.raises(StreamlitComponentRegistryError) as exc_info:
            ComponentPathUtils.resolve_glob_pattern("test-*.js", package_root)
        assert "Multiple files found matching pattern" in str(exc_info.value)

        # Test path traversal protection
        with pytest.raises(StreamlitComponentRegistryError) as exc_info:
            ComponentPathUtils.resolve_glob_pattern("../outside.js", package_root)
        assert "Path traversal attempts are not allowed" in str(exc_info.value)

        # Test absolute path protection
        with pytest.raises(StreamlitComponentRegistryError) as exc_info:
            ComponentPathUtils.resolve_glob_pattern("/absolute/path.js", package_root)
        assert "Absolute paths are not allowed" in str(exc_info.value)


@pytest.fixture
def component_manager():
    """Create a fresh BidiComponentManager for testing."""
    return BidiComponentManager()


def test_basic_registration(component_manager) -> None:
    """Test basic component registration via `BidiComponentManager`."""
    definition = BidiComponentDefinition(
        name="test_component",
        html="<div>Test</div>",
        js="console.log('test');",
    )

    component_manager.register(definition)

    retrieved = component_manager.get("test_component")
    assert retrieved == definition


def test_file_watching_state_tracking(component_manager) -> None:
    """Verify that file watching state is correctly tracked."""
    # Initially, file watching should not be started
    assert not component_manager.is_file_watching_started

    # The state should remain consistent with the file watcher
    assert (
        component_manager.is_file_watching_started
        == component_manager._file_watcher.is_watching_active
    )


def test_glob_pattern_resolution() -> None:
    """Test glob pattern resolution via `ComponentPathUtils`."""
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)

        # Create test files
        (temp_path / "component.js").write_text("console.log('component');")
        (temp_path / "styles.css").write_text("body { color: red; }")

        # Test JS glob resolution
        js_path = ComponentPathUtils.resolve_glob_pattern("*.js", temp_path)
        assert js_path.name == "component.js"

        # Test CSS glob resolution
        css_path = ComponentPathUtils.resolve_glob_pattern("*.css", temp_path)
        assert css_path.name == "styles.css"


def test_glob_pattern_multiple_matches_error() -> None:
    """Verify that multiple matches for a glob pattern raise an error."""
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)

        # Create multiple matching files
        (temp_path / "component1.js").write_text("console.log('1');")
        (temp_path / "component2.js").write_text("console.log('2');")

        with pytest.raises(StreamlitComponentRegistryError):
            ComponentPathUtils.resolve_glob_pattern("*.js", temp_path)


def test_glob_pattern_no_matches_error() -> None:
    """Verify that no matches for a glob pattern raise an error."""
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)

        with pytest.raises(StreamlitComponentRegistryError):
            ComponentPathUtils.resolve_glob_pattern("*.js", temp_path)


@patch("streamlit.watcher.path_watcher.get_default_path_watcher_class")
def test_file_watching_starts(mock_path_watcher_class) -> None:
    """Verify that file watching starts correctly in."""
    mock_watcher_instance = MagicMock()
    mock_path_watcher_class.return_value.return_value = mock_watcher_instance

    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)

        # Create test file
        js_file = temp_path / "component.js"
        js_file.write_text("console.log('test');")

        # Create mock manifest with glob pattern
        manifest = ComponentManifest(
            name="test_package",
            version="1.0.0",
            components=[ComponentConfig(name="test_component")],
        )

        # Create manager and register from manifest
        manager = BidiComponentManager()
        manager.register_from_manifest(manifest, temp_path)

        # Start file watching
        manager.start_file_watching()

        # No watchers should be created from manifest-only data
        assert not manager.is_file_watching_started
        mock_path_watcher_class.return_value.assert_not_called()


def test_security_validation() -> None:
    """Test security validation for file paths."""
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)

        # Test path traversal protection
        with pytest.raises(StreamlitComponentRegistryError):
            ComponentPathUtils.resolve_glob_pattern("../malicious.js", temp_path)

        with pytest.raises(StreamlitComponentRegistryError):
            ComponentPathUtils.resolve_glob_pattern("/etc/passwd", temp_path)


@pytest.mark.parametrize(
    ("target_field", "second_args", "expect_present_field"),
    [
        ("html", {"js": "export default function(){}"}, "js"),
        ("css", {"js": "export default function(){}"}, "js"),
        ("js", {"html": "<div>Updated</div>"}, "html"),
    ],
)
def test_runtime_override_removes_field(
    monkeypatch, target_field, second_args, expect_present_field
) -> None:
    """Verify that removing a field in a subsequent registration clears it.

    We first register a component with multiple fields set. Then, we call the
    public API again omitting the target field. The registry should update the
    definition so that the target field is None, rather than preserving it.
    """
    from streamlit.components.v2 import component as component_api
    from streamlit.components.v2.component_manager import BidiComponentManager

    manager = BidiComponentManager()

    # Patch the component API to use our local manager instance.
    monkeypatch.setattr(
        "streamlit.components.v2.get_bidi_component_manager",
        lambda: manager,
    )

    # Initial registration includes all three fields to keep flexibility
    component_api(
        "my_component",
        html="<h1>Hello World</h1>",
        css=".title{color:red;}",
        js="export default function(){}",
    )

    # Subsequent registration provides only a non-target field to keep valid
    component_api("my_component", **second_args)

    definition = manager.get("my_component")
    assert definition is not None
    # Target field should be cleared
    assert getattr(definition, target_field) is None
    # Provided non-target field should remain present
    assert getattr(definition, expect_present_field) is not None


def test_register_overwrites_placeholder_without_warning() -> None:
    """Verify that overwriting a placeholder definition does not log a warning.

    This scenario happens when a component is first discovered via manifest scan
    (creating a placeholder) and then registered via the public API at runtime.
    """
    reg = BidiComponentRegistry()
    name = "test_component"

    # 1. Register placeholder (mimics manifest scanning)
    placeholder = BidiComponentDefinition(name=name, html=None, css=None, js=None)
    reg.register(placeholder)
    assert placeholder.is_placeholder

    # 2. Register actual definition (mimics runtime API call)
    real_def = BidiComponentDefinition(
        name=name,
        html="<div>Content</div>",
        css=None,
        js=None,
    )

    with patch("streamlit.components.v2.component_registry._LOGGER") as mock_logger:
        reg.register(real_def)

        # Verify registration succeeded
        stored = reg.get(name)
        assert stored == real_def
        assert not stored.is_placeholder

        # Verify NO warning was logged
        mock_logger.warning.assert_not_called()


def test_register_overwrites_real_definition_with_warning() -> None:
    """Verify that overwriting a real definition LOGS a warning."""
    reg = BidiComponentRegistry()
    name = "test_component"

    # 1. Register real definition
    def1 = BidiComponentDefinition(
        name=name, html="<div>Initial</div>", css=None, js=None
    )
    reg.register(def1)

    # 2. Register different definition
    def2 = BidiComponentDefinition(
        name=name, html="<div>Updated</div>", css=None, js=None
    )

    with patch("streamlit.components.v2.component_registry._LOGGER") as mock_logger:
        reg.register(def2)

        # Verify registration succeeded
        stored = reg.get(name)
        assert stored == def2

        # Verify warning WAS logged
        mock_logger.warning.assert_called_once()
