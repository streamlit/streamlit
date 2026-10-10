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

"""AppTest coverage for components registered from an imported module."""

from __future__ import annotations

import importlib
import sys
import textwrap
from contextlib import contextmanager
from pathlib import Path
from typing import TYPE_CHECKING, Any
from unittest.mock import patch

import pytest

from streamlit.components.v2.manifest_scanner import ComponentConfig, ComponentManifest
from streamlit.errors import StreamlitAPIException
from streamlit.testing.v1 import AppTest

if TYPE_CHECKING:
    from collections.abc import Generator

_HTML = "<p>hi</p>"
_CSS = "p { color: red; }"
_JS = "export default function(component) {\n  return;\n}\n"
_FILE_HTML = "<div id='demo'>file-backed</div>"


@contextmanager
def _module_on_path(directory: Path, *module_names: str) -> Generator[None]:
    """Put ``directory`` on ``sys.path`` and drop the named modules afterwards."""
    path_entry = str(directory)
    sys.path.insert(0, path_entry)
    try:
        yield
    finally:
        if path_entry in sys.path:
            sys.path.remove(path_entry)
        for module_name in module_names:
            sys.modules.pop(module_name, None)


def _write_component_module(
    directory: Path,
    module_name: str,
    *,
    callable_name: str,
    component_name: str,
    html: str,
    css: str | None = None,
    js: str | None = None,
) -> None:
    """Write a module that registers a component when it is imported."""
    css_arg = "" if css is None else f"    css={css!r},\n"
    js_arg = "" if js is None else f"    js={js!r},\n"
    source = (
        "import streamlit as st\n"
        "\n"
        f"{callable_name} = st.components.v2.component(\n"
        f"    {component_name!r},\n"
        f"    html={html!r},\n"
        f"{css_arg}"
        f"{js_arg}"
        ")\n"
    )
    (directory / f"{module_name}.py").write_text(source, encoding="utf-8")


def _write_mount_script(
    directory: Path,
    filename: str,
    module_name: str,
    callable_name: str,
    *,
    key: str,
) -> Path:
    """Write a script that imports a component callable and mounts it."""
    script_path = directory / filename
    script_path.write_text(
        f"from {module_name} import {callable_name}\n\n{callable_name}(key={key!r})\n",
        encoding="utf-8",
    )
    return script_path


def _assert_inline_proto(
    at: AppTest,
    *,
    html: str = _HTML,
    css: str = _CSS,
    js: str = _JS,
) -> None:
    """Assert a run rendered the given inline HTML, CSS, and JS."""
    assert not at.exception, at.exception[0].value
    proto = at.get("bidi_component")[0].proto
    assert proto.html_content == html
    assert proto.css_content == css
    assert proto.js_content == js


def _assert_file_backed_proto(at: AppTest) -> None:
    """Assert a run rendered the file-backed HTML and relative asset paths."""
    assert not at.exception, at.exception[0].value
    proto = at.get("bidi_component")[0].proto
    assert proto.html_content == _FILE_HTML
    assert proto.css_source_path == "style.css"
    assert proto.js_source_path == "script.js"


def _component_callable(module_name: str, callable_name: str) -> Any:
    """Return the component callable currently stored on an imported module."""
    return getattr(sys.modules[module_name], callable_name)


def _write_asset_package(root: Path) -> None:
    """Create ``style.css`` and ``script.js`` under ``root / assets``."""
    asset_dir = root / "assets"
    asset_dir.mkdir(parents=True)
    (asset_dir / "style.css").write_text("div { color: teal; }", encoding="utf-8")
    (asset_dir / "script.js").write_text("console.log('asset');", encoding="utf-8")


def _manifest(package_name: str) -> ComponentManifest:
    """Build a manifest whose ``demo`` component serves ``assets``."""
    return ComponentManifest(
        name=package_name,
        version="0.0.1",
        components=[ComponentConfig(name="demo", asset_dir="assets")],
    )


@contextmanager
def _patch_component_manifest(package_name: str, package_root: Path) -> Generator[None]:
    """Serve ``package_root / assets`` as ``package_name``'s discovered manifest."""
    with patch(
        "streamlit.components.v2.manifest_scanner.scan_component_manifests",
        return_value=[(_manifest(package_name), package_root)],
    ):
        yield


def _assert_resolved_assets(
    at: AppTest, component_name: str, package_root: Path
) -> None:
    """Assert the stored CSS and JS paths are the files under ``package_root``."""
    manager = at._bidi_component_manager
    assert manager is not None
    definition = manager.get(component_name)
    assert definition is not None
    assert definition.css is not None
    assert definition.js is not None
    assert (
        Path(definition.css).resolve()
        == (package_root / "assets" / "style.css").resolve()
    )
    assert (
        Path(definition.js).resolve()
        == (package_root / "assets" / "script.js").resolve()
    )


def test_second_apptest_renders_imported_inline_component(tmp_path: Path) -> None:
    """An imported inline component renders on a later AppTest in the same process."""
    module_name = "ccv2_seq_greeting"
    callable_name = "greeting"
    _write_component_module(
        tmp_path,
        module_name,
        callable_name=callable_name,
        component_name="seq_inline_greeting",
        html=_HTML,
        css=_CSS,
        js=_JS,
    )
    script = _write_mount_script(
        tmp_path,
        "seq_app.py",
        module_name,
        callable_name,
        key="g",
    )

    with _module_on_path(tmp_path, module_name):
        first = AppTest.from_file(script).run()
        _assert_inline_proto(first)
        cached = _component_callable(module_name, callable_name)

        second = AppTest.from_file(script).run()
        assert _component_callable(module_name, callable_name) is cached
        _assert_inline_proto(second)


def test_import_before_apptest_renders_and_records_html(tmp_path: Path) -> None:
    """Importing a component before any AppTest still fills that AppTest's registry.

    Recomputing from recorded API inputs keeps the HTML stored on the definition.
    """
    module_name = "ccv2_import_before_greeting"
    callable_name = "greeting"
    component_name = "import_before_greeting"
    _write_component_module(
        tmp_path,
        module_name,
        callable_name=callable_name,
        component_name=component_name,
        html=_HTML,
        css=_CSS,
        js=_JS,
    )
    script = _write_mount_script(
        tmp_path,
        "import_before_app.py",
        module_name,
        callable_name,
        key="g",
    )

    with _module_on_path(tmp_path, module_name):
        importlib.import_module(module_name)
        cached = _component_callable(module_name, callable_name)

        at = AppTest.from_file(script).run()
        assert _component_callable(module_name, callable_name) is cached
        _assert_inline_proto(at)

        manager = at._bidi_component_manager
        assert manager is not None
        recomputed = manager._recompute_definition_from_api(component_name)
        assert recomputed is not None
        assert recomputed.html == _HTML


def test_same_instance_rerun_keeps_imported_inline_component(tmp_path: Path) -> None:
    """Rerunning one AppTest keeps the HTML filled on the first mount."""
    module_name = "ccv2_same_instance_greeting"
    callable_name = "greeting"
    _write_component_module(
        tmp_path,
        module_name,
        callable_name=callable_name,
        component_name="same_instance_greeting",
        html=_HTML,
        css=_CSS,
        js=_JS,
    )
    script = _write_mount_script(
        tmp_path,
        "same_instance_app.py",
        module_name,
        callable_name,
        key="g",
    )

    with _module_on_path(tmp_path, module_name):
        importlib.import_module(module_name)
        at = AppTest.from_file(script).run()
        _assert_inline_proto(at)
        at = at.run()
        _assert_inline_proto(at)


def test_component_defined_in_the_script_renders_on_each_apptest() -> None:
    """A component created in the script body renders on every AppTest."""

    def script() -> None:
        import streamlit as st

        widget = st.components.v2.component(
            "defined_in_script_widget",
            html="<p>inline</p>",
            css="p { color: blue; }",
            js="export default function(component) {\n  return;\n}\n",
        )
        widget(key="g")

    for _ in range(2):
        at = AppTest.from_function(script).run()
        _assert_inline_proto(
            at,
            html="<p>inline</p>",
            css="p { color: blue; }",
            js="export default function(component) {\n  return;\n}\n",
        )


def test_mount_does_not_clobber_a_resolved_definition(tmp_path: Path) -> None:
    """Mounting an imported callable leaves a definition the script already registered.

    That includes a definition written onto the registry after the first mount.
    """
    module_name = "ccv2_clobber_old"
    callable_name = "old_mount"
    component_name = "clobber_guard_greeting"
    _write_component_module(
        tmp_path,
        module_name,
        callable_name=callable_name,
        component_name=component_name,
        html="<p>old</p>",
    )
    script_path = tmp_path / "clobber_app.py"
    script_path.write_text(
        textwrap.dedent(
            f"""\
            from {module_name} import {callable_name}
            import streamlit as st
            from streamlit.components.v2.component_registry import BidiComponentDefinition
            from streamlit.runtime import Runtime

            st.components.v2.component(
                {component_name!r},
                html="<p>new</p>",
            )
            {callable_name}(key="first")
            Runtime.instance().bidi_component_registry.register(
                BidiComponentDefinition(
                    name={component_name!r},
                    html="<p>watched</p>",
                )
            )
            {callable_name}(key="second")
            """
        ),
        encoding="utf-8",
    )

    with _module_on_path(tmp_path, module_name):
        importlib.import_module(module_name)
        at = AppTest.from_file(script_path).run()

    assert not at.exception, at.exception[0].value
    components = at.get("bidi_component")
    assert len(components) == 2
    assert components[0].proto.html_content == "<p>new</p>"
    assert components[1].proto.html_content == "<p>watched</p>"
    manager = at._bidi_component_manager
    assert manager is not None
    stored = manager.get(component_name)
    assert stored is not None
    assert stored.html == "<p>watched</p>"


def test_file_backed_second_apptest_resolves_against_its_asset_root(
    tmp_path: Path,
) -> None:
    """A later AppTest re-resolves file-backed assets against its own asset root.

    The helper module calls ``component()`` while the first script runs. The
    second script mounts that same callable and does not call ``component()``
    again.
    """
    module_name = "ccv2_file_second_mod"
    callable_name = "demo"
    package_name = "imported_file_second_pkg"
    component_name = f"{package_name}.demo"
    first_root = tmp_path / "root_one"
    second_root = tmp_path / "root_two"
    _write_asset_package(first_root)
    _write_asset_package(second_root)
    _write_component_module(
        tmp_path,
        module_name,
        callable_name=callable_name,
        component_name=component_name,
        html=_FILE_HTML,
        css="style.css",
        js="script.js",
    )
    script = _write_mount_script(
        tmp_path,
        "file_second_app.py",
        module_name,
        callable_name,
        key="f",
    )

    with _module_on_path(tmp_path, module_name):
        with _patch_component_manifest(package_name, first_root):
            first = AppTest.from_file(script).run()
        _assert_file_backed_proto(first)
        _assert_resolved_assets(first, component_name, first_root)
        cached = _component_callable(module_name, callable_name)

        with _patch_component_manifest(package_name, second_root):
            second = AppTest.from_file(script).run()
        assert _component_callable(module_name, callable_name) is cached
        _assert_file_backed_proto(second)
        _assert_resolved_assets(second, component_name, second_root)


def test_file_backed_import_outside_runtime_still_raises_then_apptest_works(
    tmp_path: Path,
) -> None:
    """A file-backed import with no runtime raises, and a later AppTest renders."""
    module_name = "ccv2_file_outside_mod"
    callable_name = "demo"
    package_name = "imported_file_outside_pkg"
    component_name = f"{package_name}.demo"
    package_root = tmp_path / "pkg"
    _write_asset_package(package_root)
    _write_component_module(
        tmp_path,
        module_name,
        callable_name=callable_name,
        component_name=component_name,
        html=_FILE_HTML,
        css="style.css",
        js="script.js",
    )
    script = _write_mount_script(
        tmp_path,
        "file_outside_app.py",
        module_name,
        callable_name,
        key="f",
    )

    with _module_on_path(tmp_path, module_name):
        with pytest.raises(StreamlitAPIException, match="asset_dir"):
            importlib.import_module(module_name)
        assert module_name not in sys.modules

        with _patch_component_manifest(package_name, package_root):
            at = AppTest.from_file(script).run()

    _assert_file_backed_proto(at)


def test_explicit_empty_registration_survives_imported_mount(tmp_path: Path) -> None:
    """An explicit empty ``component()`` call is not replaced by an imported mount."""
    module_name = "ccv2_empty_reg_mod"
    callable_name = "greeting"
    component_name = "empty_reg_greeting"
    _write_component_module(
        tmp_path,
        module_name,
        callable_name=callable_name,
        component_name=component_name,
        html="<p>old</p>",
    )
    script_path = tmp_path / "empty_reg_app.py"
    script_path.write_text(
        textwrap.dedent(
            f"""\
            from {module_name} import {callable_name}
            import streamlit as st

            st.components.v2.component({component_name!r})
            {callable_name}(key="g")
            """
        ),
        encoding="utf-8",
    )

    with _module_on_path(tmp_path, module_name):
        at = AppTest.from_file(script_path).run()

    assert not at.exception, at.exception[0].value
    proto = at.get("bidi_component")[0].proto
    assert proto.html_content == ""
    assert proto.css_content == ""
    assert proto.js_content == ""
    manager = at._bidi_component_manager
    assert manager is not None
    stored = manager.get(component_name)
    assert stored is not None
    assert stored.html is None
    assert not stored.is_manifest_discovery


def test_st_pdf_renders_on_a_second_apptest() -> None:
    """st.pdf keeps the same HTML and asset paths on a later AppTest."""

    def script() -> None:
        import streamlit as st

        st.pdf("https://example.com/doc.pdf", key="p")

    first = AppTest.from_function(script).run()
    second = AppTest.from_function(script).run()
    assert not first.exception, first.exception[0].value
    assert not second.exception, second.exception[0].value
    first_proto = first.get("bidi_component")[0].proto
    second_proto = second.get("bidi_component")[0].proto
    assert first_proto.html_content
    assert second_proto.html_content == first_proto.html_content
    assert second_proto.css_source_path == first_proto.css_source_path
    assert second_proto.js_source_path == first_proto.js_source_path
