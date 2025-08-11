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

import json
import types
from collections import ChainMap, UserDict
from typing import TYPE_CHECKING, Any, cast

from streamlit.elements.lib.layout_utils import (
    LayoutConfig,
    WidthWithoutContent,
    validate_width,
)
from streamlit.proto.Json_pb2 import Json as JsonProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.type_util import (
    is_custom_dict,
    is_list_like,
    is_namedtuple,
    is_pydantic_model,
)

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator


def _ensure_serialization(o: object) -> str | list[Any]:
    """A repr function for json.dumps default arg, which tries to serialize sets
    as lists.
    """
    return list(o) if isinstance(o, set) else repr(o)


class JsonMixin:
    @gather_metrics("json")
    def json(
        self,
        body: object,
        *,  # keyword-only arguments:
        expanded: bool | int = True,
        width: WidthWithoutContent = "stretch",
    ) -> DeltaGenerator:
        """Display an object or string as a pretty-printed, interactive JSON string.

        Parameters
        ----------
        body : object or str
            The object to print as JSON. All referenced objects should be
            serializable to JSON as well. If object is a string, we assume it
            contains serialized JSON.

        expanded : bool or int
            The initial expansion state of the JSON element. This can be one
            of the following:

            - ``True`` (default): The element is fully expanded.
            - ``False``: The element is fully collapsed.
            - An integer: The element is expanded to the depth specified. The
              integer must be non-negative. ``expanded=0`` is equivalent to
              ``expanded=False``.

            Regardless of the initial expansion state, users can collapse or
            expand any key-value pair to show or hide any part of the object.

        width : "stretch" or int
            The width of the JSON element. This can be one of the following:

            - ``"stretch"`` (default): The width of the element matches the
              width of the parent container.
            - An integer specifying the width in pixels: The element has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the element matches the width
              of the parent container.

        Example
        -------
        >>> import streamlit as st
        >>>
        >>> st.json(
        ...     {
        ...         "foo": "bar",
        ...         "stuff": [
        ...             "stuff 1",
        ...             "stuff 2",
        ...             "stuff 3",
        ...         ],
        ...         "level1": {"level2": {"level3": {"a": "b"}}},
        ...     },
        ...     expanded=2,
        ... )

        .. output::
           https://doc-json.streamlit.app/
           height: 385px

        """

        if is_custom_dict(body):
            body = body.to_dict()  # ty: ignore[unresolved-attribute]

        if is_namedtuple(body):
            body = body._asdict()  # ty: ignore[unresolved-attribute]

        if isinstance(
            body, (ChainMap, types.MappingProxyType, UserDict)
        ) or is_pydantic_model(body):
            body = dict(body)  # type: ignore

        if is_list_like(body):
            body = list(body)  # ty: ignore[invalid-argument-type]

        if not isinstance(body, str):
            try:
                # Serialize body to string and try to interpret sets as lists
                body = json.dumps(body, default=_ensure_serialization)
            except TypeError as err:
                self.dg.warning(
                    "Warning: this data structure was not fully serializable as "
                    f"JSON due to one or more unexpected keys.  (Error was: {err})"
                )
                body = json.dumps(body, skipkeys=True, default=_ensure_serialization)

        json_proto = JsonProto()
        json_proto.body = body

        if isinstance(expanded, bool):
            json_proto.expanded = expanded
        elif isinstance(expanded, int):
            json_proto.expanded = True
            json_proto.max_expand_depth = expanded
        else:
            raise TypeError(
                f"The type {type(expanded)} of `expanded` is not supported"
                ", must be bool or int."
            )

        validate_width(width)
        layout_config = LayoutConfig(width=width)

        return self.dg._enqueue("json", json_proto, layout_config=layout_config)

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
