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

"""Unit tests for the streamlit.web.server.app_discovery module."""

from __future__ import annotations

from typing import TYPE_CHECKING

import pytest

from streamlit.web.server.app_discovery import (
    AppDiscoveryResult,
    _find_asgi_app_assignments,
    _get_call_name_parts,
    _get_module_string_from_path,
    _is_asgi_app_call,
    discover_asgi_app,
    discover_streamlit_app,
)

if TYPE_CHECKING:
    from pathlib import Path


class TestGetCallNameParts:
    """Tests for _get_call_name_parts function."""

    def test_simple_name(self) -> None:
        """Test extracting name from simple call like App(...)."""
        import ast

        tree = ast.parse("App()")
        call = tree.body[0].value  # type: ignore
        assert _get_call_name_parts(call) == ("App",)

    def test_single_attribute(self) -> None:
        """Test extracting name from call like st.App(...)."""
        import ast

        tree = ast.parse("st.App()")
        call = tree.body[0].value  # type: ignore
        assert _get_call_name_parts(call) == ("st", "App")

    def test_nested_attribute(self) -> None:
        """Test extracting name from call like streamlit.starlette.App(...)."""
        import ast

        tree = ast.parse("streamlit.starlette.App()")
        call = tree.body[0].value  # type: ignore
        assert _get_call_name_parts(call) == ("streamlit", "starlette", "App")


class TestIsAsgiAppCall:
    """Tests for _is_asgi_app_call function."""

    @pytest.mark.parametrize(
        "code",
        [
            "App()",
            "streamlit.starlette.App()",
            "starlette.App()",
            "FastAPI()",
            "fastapi.FastAPI()",
            "Starlette()",
        ],
    )
    def test_recognizes_asgi_app_patterns(self, code: str) -> None:
        """Test that known ASGI app patterns are recognized."""
        import ast

        tree = ast.parse(code)
        call = tree.body[0].value  # type: ignore
        assert _is_asgi_app_call(call) is True

    @pytest.mark.parametrize(
        "code",
        [
            "SomeOtherClass()",
            "my_function()",
            "random.thing.Call()",
        ],
    )
    def test_rejects_non_asgi_patterns(self, code: str) -> None:
        """Test that non-ASGI patterns are rejected."""
        import ast

        tree = ast.parse(code)
        call = tree.body[0].value  # type: ignore
        assert _is_asgi_app_call(call) is False


class TestFindAsgiAppAssignments:
    """Tests for _find_asgi_app_assignments function."""

    def test_finds_simple_assignment(self) -> None:
        """Test finding simple assignment like app = App(...)."""
        source = 'app = App("main.py")'
        result = _find_asgi_app_assignments(source)
        assert result == {"app": 1}

    def test_finds_annotated_assignment(self) -> None:
        """Test finding annotated assignment like app: App = App(...)."""
        source = 'app: App = App("main.py")'
        result = _find_asgi_app_assignments(source)
        assert result == {"app": 1}

    def test_finds_multiple_assignments(self) -> None:
        """Test finding multiple ASGI app assignments."""
        source = """
app = App("main.py")
another = FastAPI()
third = Starlette()
"""
        result = _find_asgi_app_assignments(source)
        assert "app" in result
        assert "another" in result
        assert "third" in result

    def test_ignores_non_asgi_assignments(self) -> None:
        """Test that non-ASGI assignments are ignored."""
        source = """
x = 1
y = SomeClass()
app = App("main.py")
"""
        result = _find_asgi_app_assignments(source)
        assert result == {"app": 4}  # Line 4 because of leading newline

    def test_handles_syntax_error(self) -> None:
        """Test that syntax errors return empty dict."""
        source = "this is not valid python {"
        result = _find_asgi_app_assignments(source)
        assert result == {}


class TestGetModuleStringFromPath:
    """Tests for _get_module_string_from_path function."""

    def test_simple_file(self, tmp_path: Path) -> None:
        """Test module string for a simple file."""
        script = tmp_path / "main.py"
        script.touch()
        result = _get_module_string_from_path(script)
        assert result == "main"

    def test_nested_file_without_init(self, tmp_path: Path) -> None:
        """Test module string for nested file without __init__.py."""
        subdir = tmp_path / "myapp"
        subdir.mkdir()
        script = subdir / "main.py"
        script.touch()
        result = _get_module_string_from_path(script)
        assert result == "main"

    def test_nested_file_with_init(self, tmp_path: Path) -> None:
        """Test module string for nested file with __init__.py (package)."""
        subdir = tmp_path / "myapp"
        subdir.mkdir()
        (subdir / "__init__.py").touch()
        script = subdir / "main.py"
        script.touch()
        result = _get_module_string_from_path(script)
        assert result == "myapp.main"


class TestDiscoverAsgiApp:
    """Tests for discover_asgi_app function."""

    def test_discovers_app_named_app(self, tmp_path: Path) -> None:
        """Test discovery of ASGI app named 'app'."""
        script = tmp_path / "streamlit_app.py"
        script.write_text('app = App("main.py")')

        result = discover_asgi_app(script)
        assert result.is_asgi_app is True
        assert result.app_name == "app"
        assert "streamlit_app:app" in (result.import_string or "")

    def test_discovers_app_named_application(self, tmp_path: Path) -> None:
        """Test discovery of ASGI app named 'application'."""
        script = tmp_path / "streamlit_app.py"
        script.write_text('application = App("main.py")')

        result = discover_asgi_app(script)
        assert result.is_asgi_app is True
        assert result.app_name == "application"

    def test_discovers_app_named_streamlit_app(self, tmp_path: Path) -> None:
        """Test discovery of ASGI app named 'streamlit_app'."""
        script = tmp_path / "my_module.py"
        script.write_text('streamlit_app = App("main.py")')

        result = discover_asgi_app(script)
        assert result.is_asgi_app is True
        assert result.app_name == "streamlit_app"

    def test_prefers_app_over_other_names(self, tmp_path: Path) -> None:
        """Test that 'app' is preferred over other ASGI app instances."""
        script = tmp_path / "streamlit_app.py"
        script.write_text(
            """
my_custom_app = App("main.py")
app = App("main.py")
another_app = App("main.py")
"""
        )

        result = discover_asgi_app(script)
        assert result.is_asgi_app is True
        assert result.app_name == "app"

    def test_discovers_custom_named_app(self, tmp_path: Path) -> None:
        """Test discovery of ASGI app with a custom name."""
        script = tmp_path / "streamlit_app.py"
        script.write_text('my_dashboard = App("main.py")')

        result = discover_asgi_app(script)
        assert result.is_asgi_app is True
        assert result.app_name == "my_dashboard"

    def test_discovers_specific_app_name(self, tmp_path: Path) -> None:
        """Test discovery of ASGI app with a specific name provided."""
        script = tmp_path / "streamlit_app.py"
        script.write_text(
            """
app = App("main.py")
secondary_app = App("main.py")
"""
        )

        result = discover_asgi_app(script, app_name="secondary_app")
        assert result.is_asgi_app is True
        assert result.app_name == "secondary_app"

    def test_returns_false_for_no_app(self, tmp_path: Path) -> None:
        """Test that discovery returns False when no ASGI app is found."""
        script = tmp_path / "streamlit_app.py"
        script.write_text(
            """
import streamlit as st
st.write("Hello")
"""
        )

        result = discover_asgi_app(script)
        assert result.is_asgi_app is False
        assert result.app_name is None
        assert result.import_string is None

    def test_returns_false_for_nonexistent_file(self, tmp_path: Path) -> None:
        """Test that discovery returns False for nonexistent files."""
        script = tmp_path / "nonexistent.py"

        result = discover_asgi_app(script)
        assert result.is_asgi_app is False

    def test_returns_false_for_syntax_error(self, tmp_path: Path) -> None:
        """Test that discovery returns False for files with syntax errors."""
        script = tmp_path / "bad_script.py"
        script.write_text("this is not valid python {")

        result = discover_asgi_app(script)
        assert result.is_asgi_app is False

    def test_returns_false_for_specific_name_not_found(self, tmp_path: Path) -> None:
        """Test that discovery returns False when specific name is not found."""
        script = tmp_path / "streamlit_app.py"
        script.write_text('app = App("main.py")')

        result = discover_asgi_app(script, app_name="nonexistent")
        assert result.is_asgi_app is False

    def test_discovers_fastapi_app(self, tmp_path: Path) -> None:
        """Test that FastAPI apps are discovered."""
        script = tmp_path / "main.py"
        script.write_text("app = FastAPI()")

        result = discover_asgi_app(script)
        assert result.is_asgi_app is True
        assert result.app_name == "app"

    def test_discovers_starlette_app(self, tmp_path: Path) -> None:
        """Test that Starlette apps are discovered."""
        script = tmp_path / "main.py"
        script.write_text("app = Starlette(routes=[])")

        result = discover_asgi_app(script)
        assert result.is_asgi_app is True
        assert result.app_name == "app"

    def test_discovers_fully_qualified_app(self, tmp_path: Path) -> None:
        """Test discovery of fully qualified ASGI app like streamlit.starlette.App."""
        script = tmp_path / "main.py"
        script.write_text('app = streamlit.starlette.App("main.py")')

        result = discover_asgi_app(script)
        assert result.is_asgi_app is True
        assert result.app_name == "app"


class TestDiscoverStreamlitAppAlias:
    """Tests for backwards compatible discover_streamlit_app alias."""

    def test_alias_works(self, tmp_path: Path) -> None:
        """Test that discover_streamlit_app is an alias for discover_asgi_app."""
        script = tmp_path / "main.py"
        script.write_text('app = App("main.py")')

        result = discover_streamlit_app(script)
        assert result.is_asgi_app is True
        assert result.is_st_app is True  # Backwards compatible property


class TestAppDiscoveryResult:
    """Tests for AppDiscoveryResult dataclass."""

    def test_result_with_app_found(self) -> None:
        """Test AppDiscoveryResult when app is found."""
        result = AppDiscoveryResult(
            is_asgi_app=True,
            app_name="app",
            import_string="mymodule:app",
        )
        assert result.is_asgi_app is True
        assert result.is_st_app is True  # Backwards compatible
        assert result.app_name == "app"
        assert result.import_string == "mymodule:app"

    def test_result_with_no_app_found(self) -> None:
        """Test AppDiscoveryResult when no app is found."""
        result = AppDiscoveryResult(
            is_asgi_app=False,
            app_name=None,
            import_string=None,
        )
        assert result.is_asgi_app is False
        assert result.is_st_app is False  # Backwards compatible
        assert result.app_name is None
        assert result.import_string is None
