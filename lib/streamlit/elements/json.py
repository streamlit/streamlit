# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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
from typing import TYPE_CHECKING, Any, cast

from streamlit.proto.Json_pb2 import Json as JsonProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.state import QueryParamsProxy, SessionStateProxy
from streamlit.user_info import UserInfoProxy

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator


def _ensure_serialization(o: object) -> str | list[Any]:
    """A repr function for json.dumps default arg, which tries to serialize sets as lists"""
    if isinstance(o, set):
        return list(o)
    return repr(o)


# def _get_max_json_depth(obj: Any, current_depth: int = 0) -> int:
#     """Recursively calculate the maximum depth of an object."""
#     if isinstance(obj, dict):
#         return max((_get_max_json_depth(v, current_depth + 1) for v in obj.values()), default=current_depth)
#     elif isinstance(obj, list):
#         return max((calcu_get_max_json_depthlate_depth(item, current_depth + 1) for item in obj), default=current_depth)
#     return current_depth


def _get_max_json_depth(obj: Any) -> int:
    """Iteratively calculate the maximum depth of an object."""
    stack = [(obj, 0)]  # Start with the initial object at depth 0
    max_depth = 0

    while stack:
        current_obj, depth = stack.pop()
        max_depth = max(max_depth, depth)
        if isinstance(current_obj, dict):
            stack.extend((value, depth + 1) for value in current_obj.values())
        elif isinstance(current_obj, list):
            stack.extend((item, depth + 1) for item in current_obj)

    return max_depth


class JsonMixin:
    @gather_metrics("json")
    def json(
        self,
        body: object,
        *,  # keyword-only arguments:
        expanded: bool | int = True,
    ) -> DeltaGenerator:
        """Display object or string as a pretty-printed JSON string.

        Parameters
        ----------
        body : object or str
            The object to print as JSON. All referenced objects should be
            serializable to JSON as well. If object is a string, we assume it
            contains serialized JSON.

        expanded : bool or int
            Optionally controls the initial expansion state of the JSON. If boolean,
            ``True`` expands all levels, ``False`` collapses all levels. If int,
            specifies the depth to which the JSON should be expanded, collapsing
            deeper levels. Defaults to ``True``.

        Example
        -------
        >>> import streamlit as st
        >>>
        >>> st.json({
        ...     'foo': 'bar',
        ...     'baz': 'boz',
        ...     'stuff': [
        ...         'stuff 1',
        ...         'stuff 2',
        ...         'stuff 3',
        ...         'stuff 5',
        ...     ],
        ... })

        .. output::
           https://doc-json.streamlit.app/
           height: 385px

        """
        import streamlit as st

        if isinstance(body, (SessionStateProxy, UserInfoProxy, QueryParamsProxy)):
            body = body.to_dict()

        max_depth = _get_max_json_depth(body)

        if not isinstance(body, str):
            try:
                # Serialize body to string and try to interpret sets as lists
                body = json.dumps(body, default=_ensure_serialization)
            except TypeError as err:
                st.warning(
                    "Warning: this data structure was not fully serializable as "
                    f"JSON due to one or more unexpected keys.  (Error was: {err})"
                )
                body = json.dumps(body, skipkeys=True, default=_ensure_serialization)

        json_proto = JsonProto()
        json_proto.body = body

        if isinstance(expanded, bool):
            json_proto.expanded = expanded
        if isinstance(expanded, int):
            if expanded < 0 or expanded > max_depth:
                raise ValueError(
                    f"Expanded depth {expanded} is out of valid range (0 to {max_depth}) for this JSON object."
                )
            json_proto.depth = expanded
        if not isinstance(expanded, (bool, int)):
            raise TypeError(f"expanded must be a bool or int, not {type(expanded)}")

        return self.dg._enqueue("json", json_proto)

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
