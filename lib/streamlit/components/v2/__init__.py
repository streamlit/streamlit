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

"""Register the st.components.v2 API namespace."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from streamlit.components.v2.component_definition_resolver import (
    build_definition_with_validation,
)
from streamlit.components.v2.get_bidi_component_manager import (
    get_bidi_component_manager,
)
from streamlit.errors import StreamlitAPIException

if TYPE_CHECKING:
    from streamlit.components.v2.types import BidiComponentCallable

if TYPE_CHECKING:
    from collections.abc import Callable

    from streamlit.components.v2.bidi_component import BidiComponentResult
    from streamlit.elements.lib.layout_utils import Height, Width
    from streamlit.runtime.state.common import WidgetCallback


def _register_component(
    name: str,
    html: str | None = None,
    css: str | None = None,
    js: str | None = None,
) -> str:
    """Register a component and return its fully qualified key.

    This shared function handles the component registration and constructing a
    validated definition against any pre-registered components from
    ``pyproject.toml``.

    Parameters
    ----------
    name : str
        A short, descriptive identifier for the component.
    html : str or None
        Inline HTML markup for the component root.
    css : str | None
        Either inline CSS (string) or an asset-dir-relative path/glob to a
        ``.css`` file declared in the component's ``asset_dir``. Globs are
        allowed and must resolve to exactly one file within ``asset_dir``.
    js : str | None
        Either inline JavaScript (string) or an asset-dir-relative path/glob to
        a ``.js`` file declared in the component's ``asset_dir``. Globs are
        allowed and must resolve to exactly one file within ``asset_dir``.

    Returns
    -------
    str
        The fully qualified component key in the form ``<module_name>.<n>``.

    Raises
    ------
    StreamlitAPIException
        If ``css`` or ``js`` parameters are not strings or None.
    """
    # Parameter type guards: only strings or None are supported for js/css
    for _param_name, _param_value in (("css", css), ("js", js)):
        if _param_value is not None and not isinstance(_param_value, str):
            raise StreamlitAPIException(
                f"{_param_name} parameter must be a string or None. Pass a string path or glob."
            )

    component_key = name

    manager = get_bidi_component_manager()
    manager.register(
        build_definition_with_validation(
            manager=manager,
            component_key=component_key,
            html=html,
            css=css,
            js=js,
        )
    )

    # Record API inputs for future re-resolution on file changes
    manager.record_api_inputs(component_key, css, js)

    return component_key


def _create_component_callable(
    name: str,
    *,
    html: str | None = None,
    css: str | None = None,
    js: str | None = None,
) -> Callable[..., Any]:
    """Create a component callable, handling both lookup and registration cases.

    Parameters
    ----------
    name : str
        A short, descriptive identifier for the component.
    html : str | None
        Inline HTML markup for the component root.
    css : str | None
        Inline CSS (string) or a string path/glob to a file under ``asset_dir``;
        see :func:`_register_component` for path validation semantics.
    js : str | None
        Inline JavaScript (string) or a string path/glob to a file under
        ``asset_dir``; see :func:`_register_component` for path validation semantics.

    Returns
    -------
    Callable[..., Any]
        A function that, when called inside a Streamlit script, mounts the
        component and returns its state.

    Raises
    ------
    StreamlitAPIException
        If a component is not found in the registry.
    """
    component_key = _register_component(name=name, html=html, css=css, js=js)

    # The inner callable that mounts the component.
    def _mount_component(
        *,
        key: str | None = None,
        data: Any | None = None,
        default: dict[str, Any] | None = None,
        width: Width = "stretch",
        height: Height = "content",
        isolate_styles: bool = True,
        **on_callbacks: WidgetCallback | None,
    ) -> BidiComponentResult:
        """Mount the component.

        Parameters
        ----------
        key : str or None
            An optional string to use as the unique key for the component.
        data : Any or None
            Data to pass to the component (JSON-serializable).
        default : dict[str, Any] or None
            A dictionary of default values for state properties. Keys must
            correspond to valid state names (those with on_*_change callbacks).
        width : Width
            The width of the component.
        height : Height
            The height of the component.
        isolate_styles : bool
            Whether to sandbox the component styles in a shadow-root. Defaults to
            True.
        **on_callbacks : WidgetCallback
            Callback functions for handling component events. Use pattern
            on_{state_name}_change (e.g., on_click_change, on_value_change).

        Returns
        -------
        BidiComponentResult
            Component state.
        """
        import streamlit as st

        return st._bidi_component(
            component_key,
            key=key,
            isolate_styles=isolate_styles,
            data=data,
            default=default,
            width=width,
            height=height,
            **on_callbacks,
        )

    # Ensure the function remains compatible with the shared public callable type.
    # Static type assertion to ensure the callable matches the shared signature
    _typed_check_mount_component: BidiComponentCallable = _mount_component

    return _mount_component


def component(
    name: str,
    *,
    html: str | None = None,
    css: str | None = None,
    js: str | None = None,
) -> BidiComponentCallable:
    """Register a st.components.v2 component and return a callable to mount it.

    Parameters
    ----------
    name : str
        A short, descriptive identifier for the component.
    html : str | None
        Inline HTML markup for the component root.
    css : str | None
        Inline CSS (string) or an asset-dir-relative path/glob to a ``.css``
        file under the component's manifest-declared ``asset_dir``. Globs must
        resolve to exactly one file within ``asset_dir``; absolute paths and
        traversal are rejected.
    js : str | None
        Inline JavaScript (string) or an asset-dir-relative path/glob to a
        ``.js`` file under the component's manifest-declared ``asset_dir``.
        Globs must resolve to exactly one file within ``asset_dir``; absolute
        paths and traversal are rejected.

    Returns
    -------
    Callable[..., BidiComponentResult]
        A function that, when called inside a Streamlit script, mounts the
        component and returns its state as a ``BidiComponentResult``.
    """
    return _create_component_callable(name, html=html, css=css, js=js)


__all__ = [
    "component",
]
