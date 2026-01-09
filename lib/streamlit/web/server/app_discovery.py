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

By design, this supports not only Streamlit's st.App but also other ASGI
frameworks like FastAPI and Starlette. This allows `streamlit run` to serve
as a unified entry point for any ASGI app, providing a consistent developer
experience for projects that combine Streamlit with other frameworks or use
ASGI apps directly.

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
_PREFERRED_APP_NAMES: Final[tuple[str, ...]] = ("app", "streamlit_app")

# Known ASGI app classes with their fully qualified module paths.
# Each entry is a dotted path like "module.submodule.ClassName".
# Only classes matching these paths will be detected as ASGI apps.
#
# Note: FastAPI and Starlette are intentionally included here. This enables
# `streamlit run` to serve as a unified entry point for ASGI apps, which is
# useful for projects that mount Streamlit within other frameworks or want
# to use `streamlit run` for any ASGI application.
_KNOWN_ASGI_APP_CLASSES: Final[tuple[str, ...]] = (
    # Streamlit App
    "streamlit.starlette.App",
    "streamlit.web.server.starlette.App",
    "streamlit.web.server.starlette.starlette_app.App",
    # FastAPI
    "fastapi.FastAPI",
    "fastapi.applications.FastAPI",
    # Starlette
    "starlette.applications.Starlette",
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


def _extract_imports(tree: ast.AST) -> dict[str, str]:
    """Extract import mappings from an AST.

    Builds a mapping from local names to their fully qualified module paths.

    For example:
    - `from streamlit.starlette import App` → {"App": "streamlit.starlette.App"}
    - `from streamlit import starlette` → {"starlette": "streamlit.starlette"}
    - `import streamlit as st` → {"st": "streamlit"}
    - `import fastapi` → {"fastapi": "fastapi"}

    Parameters
    ----------
    tree
        The parsed AST of a Python module.

    Returns
    -------
    dict[str, str]
        A mapping from local names to their fully qualified module paths.
    """
    imports: dict[str, str] = {}

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            # Handle: import x, import x as y
            for alias in node.names:
                local_name = alias.asname or alias.name
                imports[local_name] = alias.name

        elif isinstance(node, ast.ImportFrom) and node.module:
            # Handle: from x.y import z, from x.y import z as w
            for alias in node.names:
                local_name = alias.asname or alias.name
                imports[local_name] = f"{node.module}.{alias.name}"

    return imports


def _resolve_call_to_module_path(
    parts: tuple[str, ...], imports: dict[str, str]
) -> str | None:
    """Resolve a call's name parts to a fully qualified module path.

    Uses the import mapping to resolve the first part of the call chain,
    then appends any remaining parts.

    For example, with imports {"App": "streamlit.starlette.App"}:
    - ("App",) → "streamlit.starlette.App"

    With imports {"st": "streamlit"}:
    - ("st", "starlette", "App") → "streamlit.starlette.App"

    Parameters
    ----------
    parts
        The name parts from a Call node (e.g., ("st", "App")).
    imports
        The import mapping from _extract_imports.

    Returns
    -------
    str | None
        The fully qualified module path, or None if resolution fails.
    """
    if not parts:
        return None

    first_part = parts[0]
    remaining_parts = parts[1:]

    if first_part in imports:
        # The first part was imported, resolve it
        base_path = imports[first_part]
        if remaining_parts:
            return f"{base_path}.{'.'.join(remaining_parts)}"
        return base_path

    # Not imported - could be a fully qualified name or unknown
    # For fully qualified names like streamlit.starlette.App(),
    # just join all parts
    return ".".join(parts)


def _is_asgi_app_call(node: ast.Call, imports: dict[str, str]) -> bool:
    """Check if a Call node represents a known ASGI app constructor.

    This function resolves the call to its fully qualified module path
    using the import mapping, then checks if it matches any known
    ASGI app class.

    Parameters
    ----------
    node
        An AST Call node.
    imports
        The import mapping from _extract_imports.

    Returns
    -------
    bool
        True if the call is a known ASGI app constructor.
    """
    parts = _get_call_name_parts(node)
    if parts is None:
        return False

    resolved_path = _resolve_call_to_module_path(parts, imports)
    if resolved_path is None:
        return False

    return resolved_path in _KNOWN_ASGI_APP_CLASSES


def _get_module_string_from_path(path: Path) -> str:
    """Convert a file path to a module import string.

    Since `streamlit run` adds the script's directory to sys.path via
    _fix_sys_path, the module string should just be the script's stem,
    not a fully qualified package path.

    Parameters
    ----------
    path
        Path to the Python file.

    Returns
    -------
    str
        The module string suitable for uvicorn (e.g., "myapp").
    """
    resolved = path.resolve()

    # Handle __init__.py files - use the directory name
    if resolved.is_file() and resolved.stem == "__init__":
        return resolved.parent.stem

    return resolved.stem


def _find_asgi_app_assignments(source: str) -> dict[str, int]:
    """Find all variable assignments to ASGI app constructors in source code.

    This function parses the source code, extracts import statements to
    understand the module context, then finds assignments to known ASGI
    app constructors.

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

    # Extract imports to resolve call names to their source modules
    imports = _extract_imports(tree)

    app_assignments: dict[str, int] = {}

    for node in ast.walk(tree):
        # Check for simple assignment: app = App(...)
        if (
            isinstance(node, ast.Assign)
            and isinstance(node.value, ast.Call)
            and _is_asgi_app_call(node.value, imports)
        ):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    app_assignments[target.id] = node.lineno

        # Check for annotated assignment: app: App = App(...)
        elif (
            isinstance(node, ast.AnnAssign)
            and node.value
            and isinstance(node.value, ast.Call)
            and _is_asgi_app_call(node.value, imports)
            and isinstance(node.target, ast.Name)
        ):
            app_assignments[node.target.id] = node.lineno

    return app_assignments


def discover_asgi_app(
    path: Path,
    app_name: str | None = None,
) -> AppDiscoveryResult:
    """Discover if a Python file contains an ASGI app instance using AST parsing.

    This function safely analyzes the source code without executing it.
    It tracks import statements to verify that detected App classes actually
    come from known ASGI frameworks (streamlit, fastapi, starlette), preventing
    false positives from custom classes with the same name.

    Supported import patterns:
    - `from streamlit.starlette import App`
    - `import streamlit` (for `streamlit.starlette.App`)
    - `from fastapi import FastAPI`
    - `from starlette.applications import Starlette`

    The app variable can have any name (e.g., `app`, `my_dashboard`, `server`).
    Preferred names checked first: "app", "streamlit_app".

    Parameters
    ----------
    path
        Path to the Python script to check.
    app_name
        Optional specific variable name to look for. If provided, only that
        name is checked. If not provided, checks preferred names first
        ("app", "streamlit_app"), then falls back to any
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
