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

"""App discovery utilities for detecting ASGI app instances in scripts.

This module provides functions to discover if a Python script contains an
ASGI application instance (like st.App, FastAPI, or Starlette), enabling
the CLI to auto-detect whether to run in traditional mode or ASGI mode.

The detection uses AST (Abstract Syntax Tree) parsing to safely analyze
the source code without executing it.
"""

from __future__ import annotations

import ast
from dataclasses import dataclass
from typing import TYPE_CHECKING, Final

from streamlit.logger import get_logger

if TYPE_CHECKING:
    from pathlib import Path

_LOGGER: Final = get_logger(__name__)

# Preferred variable names to look for when discovering ASGI app instances.
# These are checked in order of priority.
_PREFERRED_APP_NAMES: Final[tuple[str, ...]] = ("app", "application", "streamlit_app")

# Patterns that indicate an ASGI app constructor call.
# Each pattern is a tuple of possible attribute chains that resolve to an App class.
# For example, ("streamlit", "starlette", "App") matches `streamlit.starlette.App(...)`
_ASGI_APP_PATTERNS: Final[tuple[tuple[str, ...], ...]] = (
    # Streamlit App patterns
    ("App",),  # from streamlit.starlette import App; app = App(...)
    ("st", "App"),  # import streamlit as st; app = st.App(...)  (future)
    ("streamlit", "App"),  # import streamlit; app = streamlit.App(...)  (future)
    ("streamlit", "starlette", "App"),  # app = streamlit.starlette.App(...)
    ("starlette", "App"),  # from streamlit import starlette; app = starlette.App(...)
    # FastAPI patterns
    ("FastAPI",),  # from fastapi import FastAPI; app = FastAPI(...)
    ("fastapi", "FastAPI"),  # import fastapi; app = fastapi.FastAPI(...)
    # Starlette patterns
    ("Starlette",),  # from starlette.applications import Starlette
    ("starlette", "applications", "Starlette"),
)


@dataclass
class AppDiscoveryResult:
    """Result of ASGI app discovery.

    Attributes
    ----------
    is_asgi_app
        True if the script contains an ASGI app instance.
    app_name
        The name of the app instance variable (e.g., "app").
    import_string
        The import string for uvicorn (e.g., "module:app").
    """

    is_asgi_app: bool
    app_name: str | None
    import_string: str | None

    # Keep is_st_app as an alias for backwards compatibility
    @property
    def is_st_app(self) -> bool:
        """Alias for is_asgi_app for backwards compatibility."""
        return self.is_asgi_app


def _get_call_name_parts(node: ast.Call) -> tuple[str, ...] | None:
    """Extract the name parts from a Call node's func attribute.

    For example:
    - `App(...)` returns ("App",)
    - `st.App(...)` returns ("st", "App")
    - `streamlit.starlette.App(...)` returns ("streamlit", "starlette", "App")

    Parameters
    ----------
    node
        An AST Call node.

    Returns
    -------
    tuple[str, ...] | None
        A tuple of name parts, or None if the call target is not a simple
        name or attribute chain.
    """
    func = node.func
    parts: list[str] = []

    while isinstance(func, ast.Attribute):
        parts.append(func.attr)
        func = func.value

    if isinstance(func, ast.Name):
        parts.append(func.id)
        return tuple(reversed(parts))

    return None


def _is_asgi_app_call(node: ast.Call) -> bool:
    """Check if a Call node represents an ASGI app constructor.

    Parameters
    ----------
    node
        An AST Call node.

    Returns
    -------
    bool
        True if the call matches a known ASGI app pattern.
    """
    parts = _get_call_name_parts(node)
    if parts is None:
        return False

    return parts in _ASGI_APP_PATTERNS


def _get_module_string_from_path(path: Path) -> str:
    """Convert a file path to a module import string.

    Parameters
    ----------
    path
        Path to the Python file.

    Returns
    -------
    str
        The module string suitable for uvicorn (e.g., "myapp" or "myapp.main").
    """
    resolved = path.resolve()
    module_path = resolved

    # Handle __init__.py files
    if resolved.is_file() and resolved.stem == "__init__":
        module_path = resolved.parent

    module_paths = [module_path]

    # Walk up the directory tree to find package boundaries
    for parent in module_path.parents:
        init_path = parent / "__init__.py"
        if init_path.is_file():
            module_paths.insert(0, parent)
        else:
            break

    return ".".join(p.stem for p in module_paths)


def _find_asgi_app_assignments(source: str) -> dict[str, int]:
    """Find all variable assignments to ASGI app constructors in source code.

    Parameters
    ----------
    source
        Python source code to analyze.

    Returns
    -------
    dict[str, int]
        A mapping of variable names to their line numbers where ASGI app
        instances are assigned.
    """
    try:
        tree = ast.parse(source)
    except SyntaxError as e:
        _LOGGER.debug("Failed to parse source: %s", e)
        return {}

    app_assignments: dict[str, int] = {}

    for node in ast.walk(tree):
        # Check for simple assignment: app = App(...)
        if (
            isinstance(node, ast.Assign)
            and isinstance(node.value, ast.Call)
            and _is_asgi_app_call(node.value)
        ):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    app_assignments[target.id] = node.lineno

        # Check for annotated assignment: app: App = App(...)
        elif (
            isinstance(node, ast.AnnAssign)
            and node.value
            and isinstance(node.value, ast.Call)
            and _is_asgi_app_call(node.value)
            and isinstance(node.target, ast.Name)
        ):
            app_assignments[node.target.id] = node.lineno

    return app_assignments


def discover_asgi_app(
    path: Path,
    app_name: str | None = None,
) -> AppDiscoveryResult:
    """Discover if a Python file contains an ASGI app instance using AST parsing.

    This function safely analyzes the source code without executing it,
    looking for patterns like:
    - `app = App("main.py")`
    - `app = streamlit.starlette.App(...)`
    - `app = FastAPI()`
    - `app = Starlette(...)`

    Parameters
    ----------
    path
        Path to the Python script to check.
    app_name
        Optional specific variable name to look for. If provided, only that
        name is checked. If not provided, checks preferred names first
        ("app", "application", "streamlit_app"), then falls back to any
        discovered ASGI app.

    Returns
    -------
    AppDiscoveryResult
        Discovery result indicating whether an ASGI app was found and how
        to import it.

    Examples
    --------
    >>> result = discover_asgi_app(Path("streamlit_app.py"))
    >>> if result.is_asgi_app:
    ...     print(f"Found ASGI app: {result.import_string}")
    """
    if not path.exists():
        _LOGGER.debug("Path does not exist: %s", path)
        return AppDiscoveryResult(is_asgi_app=False, app_name=None, import_string=None)

    try:
        source = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as e:
        _LOGGER.debug("Failed to read file %s: %s", path, e)
        return AppDiscoveryResult(is_asgi_app=False, app_name=None, import_string=None)

    app_assignments = _find_asgi_app_assignments(source)

    if not app_assignments:
        _LOGGER.debug("No ASGI app assignments found in %s", path)
        return AppDiscoveryResult(is_asgi_app=False, app_name=None, import_string=None)

    module_str = _get_module_string_from_path(path)

    # If app_name is provided, check for that specific name
    if app_name:
        if app_name in app_assignments:
            _LOGGER.debug(
                "Found ASGI app at %s:%s (line %d)",
                module_str,
                app_name,
                app_assignments[app_name],
            )
            return AppDiscoveryResult(
                is_asgi_app=True,
                app_name=app_name,
                import_string=f"{module_str}:{app_name}",
            )
        _LOGGER.debug("No ASGI app found with name '%s'", app_name)
        return AppDiscoveryResult(is_asgi_app=False, app_name=None, import_string=None)

    # Check preferred names first
    for preferred_name in _PREFERRED_APP_NAMES:
        if preferred_name in app_assignments:
            _LOGGER.debug(
                "Found ASGI app at %s:%s (preferred name, line %d)",
                module_str,
                preferred_name,
                app_assignments[preferred_name],
            )
            return AppDiscoveryResult(
                is_asgi_app=True,
                app_name=preferred_name,
                import_string=f"{module_str}:{preferred_name}",
            )

    # Fall back to the first discovered app (by line number)
    first_app = min(app_assignments.items(), key=lambda x: x[1])
    _LOGGER.debug(
        "Found ASGI app at %s:%s (fallback, line %d)",
        module_str,
        first_app[0],
        first_app[1],
    )
    return AppDiscoveryResult(
        is_asgi_app=True,
        app_name=first_app[0],
        import_string=f"{module_str}:{first_app[0]}",
    )


__all__ = ["AppDiscoveryResult", "discover_asgi_app"]
