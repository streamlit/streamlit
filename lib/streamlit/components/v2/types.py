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

"""Shared typing utilities for the `st.components.v2` API.

This module exposes common, user-facing argument types and callable
signatures used by the bidirectional component API. Import these types to
annotate code that constructs kwargs dictionaries for components, or when
authoring wrappers/utilities around `st.components.v2.component`.

The goal is to keep the public argument surface documented in one place and
reusable across both the user-facing factory in `components/v2/__init__.py`
and the internal implementation in `components/v2/bidi_component/main.py`.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Protocol

if TYPE_CHECKING:
    from streamlit.components.v2.bidi_component.state import BidiComponentResult
    from streamlit.elements.lib.layout_utils import Height, Width
    from streamlit.runtime.state.common import WidgetCallback


# Individual argument type aliases to make reuse ergonomic across modules.
BidiComponentKey = str | None
BidiComponentData = Any | None
BidiComponentDefaults = dict[str, Any] | None
ComponentIsolateStyles = bool


class BidiComponentCallable(Protocol):
    """Signature of the callable returned by ``st.components.v2.component``.

    Parameters
    ----------
    key : str | None, optional
        An optional string to use as the unique key for the component. If
        omitted, a key is generated based on execution order.
    data : Any | None, optional
        Data to pass to the component. May be JSON-serializable primitives or
        containers, bytes-like, or dataframe-like objects that can be
        serialised to Arrow.
    default : dict[str, Any] | None, optional
        Default values for state properties. Keys must correspond to valid
        state names (those with ``on_{state}_change`` callbacks). Trigger
        values do not support defaults.
    width : Literal["stretch", "content"] | int, optional
        Desired width. One of ``"stretch"``, ``"content"``, or a pixel value.
    height : Literal["stretch", "content"] | int, optional
        Desired height. One of ``"stretch"``, ``"content"``, or a pixel value.
    isolate_styles : bool, optional
        Whether to sandbox the component styles in a shadow root. Defaults to
        ``True``.
    **on_callbacks : WidgetCallback | None
        Event-specific callbacks with the naming pattern
        ``on_{event_name}_change`` (for example: ``on_click_change``,
        ``on_value_change``). Only names that follow this pattern are
        recognized. Values must be callables that accept no arguments.

    Returns
    -------
    BidiComponentResult
        Component state object that exposes state values and trigger values.
    """

    def __call__(
        self,
        *,
        key: BidiComponentKey = None,
        data: BidiComponentData = None,
        default: BidiComponentDefaults = None,
        width: Width = "stretch",
        height: Height = "content",
        isolate_styles: ComponentIsolateStyles = True,
        **on_callbacks: WidgetCallback | None,
    ) -> BidiComponentResult: ...


__all__ = [
    "BidiComponentCallable",
    "BidiComponentData",
    "BidiComponentDefaults",
    "BidiComponentKey",
    "ComponentIsolateStyles",
]
