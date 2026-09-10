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

from difflib import get_close_matches
from typing import TYPE_CHECKING, Final, NoReturn

if TYPE_CHECKING:
    from collections.abc import Collection, Mapping
    from types import ModuleType

# Exact former public names and the current public replacements they map to.
# Ambiguous retired APIs (for example ``st.cache``) list every valid successor
# rather than picking one alias.
_REMOVED_STREAMLIT_ATTRIBUTES: Final[Mapping[str, tuple[str, ...]]] = {
    "beta_color_picker": ("color_picker",),
    "beta_columns": ("columns",),
    "beta_container": ("container",),
    "beta_expander": ("expander",),
    "beta_secrets": ("secrets",),
    "cache": ("cache_data", "cache_resource"),
    "experimental_audio_input": ("audio_input",),
    "experimental_connection": ("connection",),
    "experimental_data_editor": ("data_editor",),
    "experimental_dialog": ("dialog",),
    "experimental_fragment": ("fragment",),
    "experimental_get_query_params": ("query_params",),
    "experimental_memo": ("cache_data",),
    "experimental_rerun": ("rerun",),
    "experimental_set_query_params": ("query_params",),
    "experimental_singleton": ("cache_resource",),
    "experimental_user": ("user",),
}

# Public namespaces that are modules, so they are excluded by the non-module
# command filter used for the rest of the ``st`` surface.
_PUBLIC_STREAMLIT_NAMESPACES: Final[frozenset[str]] = frozenset(
    {"column_config", "components", "typing"}
)

_CLOSE_MATCH_CUTOFF: Final = 0.8
_MAX_CLOSE_MATCHES: Final = 3
_MAX_SUGGESTION_LENGTH_DELTA: Final = 1


def public_streamlit_names(module: ModuleType) -> frozenset[str]:
    """Return the curated public ``st.*`` surface used for typo suggestions.

    Includes public commands and objects plus the documented public
    namespaces. Internal modules that leak into ``st.__dict__`` are omitted.
    """
    names = {
        key
        for key, value in module.__dict__.items()
        if not key.startswith("_") and not isinstance(value, type(module))
    }
    names.update(
        namespace
        for namespace in _PUBLIC_STREAMLIT_NAMESPACES
        if namespace in module.__dict__
    )
    return frozenset(names)


def suggest_streamlit_commands(name: str, catalog: Collection[str]) -> tuple[str, ...]:
    """Return conservative close matches for ``name`` from ``catalog``.

    Matches must be at least ``_CLOSE_MATCH_CUTOFF`` similar and differ in
    length by at most one character so suggestions stay typo-like.
    """
    close_matches = get_close_matches(
        name,
        catalog,
        n=_MAX_CLOSE_MATCHES,
        cutoff=_CLOSE_MATCH_CUTOFF,
    )
    return tuple(
        match
        for match in close_matches
        if abs(len(match) - len(name)) <= _MAX_SUGGESTION_LENGTH_DELTA
    )


def missing_streamlit_attribute_message(name: str, module: ModuleType) -> str:
    """Return an AttributeError message for a missing top-level ``st.*`` name."""
    prefix = f"module 'streamlit' has no attribute '{name}'"
    if name.startswith("_"):
        return prefix

    replacements = _REMOVED_STREAMLIT_ATTRIBUTES.get(name)
    if replacements is not None:
        return (
            f"{prefix}. `{_st_name(name)}` has been removed. "
            f"Use {_format_st_names(replacements)} instead."
        )

    catalog = public_streamlit_names(module)
    if name == "input":
        input_commands = tuple(
            sorted(command for command in catalog if command.endswith("_input"))
        )
        return (
            f"{prefix}. Streamlit has no `{_st_name(name)}`. "
            "Use a specific input command such as "
            f"{_format_st_names(input_commands)}."
        )

    suggestions = suggest_streamlit_commands(name, catalog)
    if suggestions:
        return f"{prefix}. Did you mean {_format_st_names(suggestions)}?"

    return prefix


def raise_missing_streamlit_attribute(name: str) -> NoReturn:
    """Raise AttributeError for a missing top-level ``st.*`` name."""
    import streamlit as st

    raise AttributeError(
        missing_streamlit_attribute_message(name, st),
        name=name,
        obj=st,
    )


def _st_name(name: str) -> str:
    return f"st.{name}"


def _format_st_names(names: Collection[str]) -> str:
    labeled = [f"`{_st_name(name)}`" for name in names]
    if len(labeled) == 1:
        return labeled[0]
    if len(labeled) == 2:
        return f"{labeled[0]} or {labeled[1]}"
    return f"{', '.join(labeled[:-1])}, or {labeled[-1]}"
