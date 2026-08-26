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

"""Shared resolver for building component definitions with path validation.

This module centralizes the logic for interpreting js/css inputs as inline
content vs path/glob strings, validating them against a component's asset
directory, and producing a BidiComponentDefinition with correct asset-relative
URLs used by the server.
"""

from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

from streamlit.components.v2.component_path_utils import ComponentPathUtils
from streamlit.components.v2.component_registry import BidiComponentDefinition
from streamlit.errors import StreamlitAPIException

if TYPE_CHECKING:
    from streamlit.components.v2.component_manager import BidiComponentManager


def build_definition_with_validation(
    *,
    manager: BidiComponentManager,
    component_key: str,
    html: str | None,
    css: str | None,
    js: str | None,
) -> BidiComponentDefinition:
    """Construct a definition and validate ``js``/``css`` inputs against ``asset_dir``.

    Parameters
    ----------
    manager : BidiComponentManager
        Component manager used to resolve the component's ``asset_dir`` and
        related metadata.
    component_key : str
        Fully-qualified name of the component to build a definition for.
    html : str | None
        Inline HTML content to include in the definition. If ``None``, the
        component will not include HTML content.
    css : str | None
        Either inline CSS content or a path/glob to a CSS file inside the
        component's ``asset_dir``. Inline strings are kept as-is; file-backed
        inputs are validated and converted to an ``asset_dir``-relative URL.
    js : str | None
        Either inline JavaScript content or a path/glob to a JS file inside the
        component's ``asset_dir``. Inline strings are kept as-is; file-backed
        inputs are validated and converted to an ``asset_dir``-relative URL.

    Returns
    -------
    BidiComponentDefinition
        A component definition with inline content preserved and file-backed
        entries resolved to absolute filesystem paths plus their
        ``asset_dir``-relative URLs.

    Raises
    ------
    StreamlitAPIException
        If a path/glob is provided but the component has no declared
        ``asset_dir``, if a glob resolves to zero or multiple files, or if any
        resolved path escapes the declared ``asset_dir``.

    Notes
    -----
    - Inline strings are treated as content (no manifest required).
    - Path-like strings require the component to be declared in the package
      manifest with an ``asset_dir``.
    - Globs are supported only within ``asset_dir`` and must resolve to exactly
      one file.
    - Relative paths are resolved strictly against the component's ``asset_dir``
      and must remain within it after resolution. Absolute paths are not
      allowed.
    - For file-backed entries, the URL sent to the frontend is the
      ``asset_dir``-relative path, served under
      ``/_stcore/bidi-components/<component>/<relative_path>``.
    """

    asset_root = manager.get_component_asset_root(component_key)

    def _resolve_entry(
        value: str | None, *, kind: str
    ) -> tuple[str | None, str | None]:
        # Inline content: None rel URL
        if value is None:
            return None, None
        if ComponentPathUtils.looks_like_inline_content(value):
            return value, None

        # For path-like strings, asset_root must exist
        if asset_root is None:
            raise StreamlitAPIException(
                f"Component '{component_key}' must be declared in pyproject.toml with asset_dir "
                f"to use file-backed {kind}."
            )

        value_str = value

        # If looks like a glob, resolve strictly inside asset_root
        if ComponentPathUtils.has_glob_characters(value_str):
            resolved = ComponentPathUtils.resolve_glob_pattern(value_str, asset_root)
            ComponentPathUtils.ensure_within_root(resolved, asset_root, kind=kind)
            # Use resolved absolute paths to avoid macOS /private prefix mismatch
            rel_url = str(
                resolved.resolve().relative_to(asset_root.resolve()).as_posix()
            )
            return str(resolved), rel_url

        # Concrete path: must be asset-dir-relative (reject absolute & traversal)
        ComponentPathUtils.validate_path_security(value_str)
        candidate = asset_root / Path(value_str)
        ComponentPathUtils.ensure_within_root(candidate, asset_root, kind=kind)
        resolved_candidate = candidate.resolve()
        rel_url = str(resolved_candidate.relative_to(asset_root.resolve()).as_posix())
        return str(resolved_candidate), rel_url

    css_value, css_rel = _resolve_entry(css, kind="css")
    js_value, js_rel = _resolve_entry(js, kind="js")

    # Build definition with possible asset_dir-relative paths
    return BidiComponentDefinition(
        name=component_key,
        html=html,
        css=css_value,
        js=js_value,
        css_asset_relative_path=css_rel,
        js_asset_relative_path=js_rel,
    )
