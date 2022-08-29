# Copyright 2018-2022 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import json
import copy
from typing import (
    Any,
    Hashable,
    List,
    MutableMapping,
    Tuple,
    Union,
    cast,
    TYPE_CHECKING,
)

from typing_extensions import TypeAlias

from streamlit.proto.Json_pb2 import Json as JsonProto
from streamlit.runtime.state import SessionStateProxy
from streamlit.type_util import is_iterable
from streamlit.user_info import UserInfoProxy


if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator

Body: TypeAlias = Union[List[Any], Tuple[Any, ...], MutableMapping[Hashable, Any]]


def _convert_sets_to_lists(body: Body) -> Body:
    if isinstance(body, (list, tuple)):
        # We could technically iterate through the elements of a list/tuple and convert
        # any sets that we find to lists like we do below, but lists/tuples of sets
        # seem like a strange enough use-case that it's probably not worth the
        # additional complexity.
        return body

    # Convert sets into lists, which render more nicely on the frontend
    set_found = False
    for key in body:
        if isinstance(body[key], set):
            if not set_found:
                # When set is found to prevent mutation of input body, we need
                # to shallow copy it once. To avoid copying it multiple times
                # we use set_found flag.
                body = copy.copy(body)
                set_found = True
            body[key] = list(body[key])
    return body


class JsonMixin:
    def json(
        self,
        body: object,
        *,  # keyword-only arguments:
        expanded: bool = True,
    ) -> "DeltaGenerator":
        """Display object or string as a pretty-printed JSON string.

        Parameters
        ----------
        body : object or str
            The object to print as JSON. All referenced objects should be
            serializable to JSON as well. If object is a string, we assume it
            contains serialized JSON.

        expanded : bool
            An optional boolean that allows the user to set whether the initial
            state of this json element should be expanded. Defaults to True.
            This argument can only be supplied by keyword.

        Example
        -------
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
           https://doc-json.streamlitapp.com/
           height: 385px

        """
        import streamlit as st

        if isinstance(body, (SessionStateProxy, UserInfoProxy)):
            body = body.to_dict()

        if not isinstance(body, str):
            # Check if body is iterable, if it is, convert its sets to lists
            if is_iterable(body):
                # body is iterable, look for sets and change them to lists
                # TODO(harahu): This function does not handle iterables in
                #  general. Either generalize the function, or do further type
                #  checking here.
                body = _convert_sets_to_lists(body)  # type: ignore[arg-type]

            try:
                # Serialize body to string
                body = json.dumps(body, default=repr)
            except TypeError as err:
                st.warning(
                    "Warning: this data structure was not fully serializable as "
                    f"JSON due to one or more unexpected keys.  (Error was: {err})"
                )
                body = json.dumps(body, skipkeys=True, default=repr)

        json_proto = JsonProto()
        json_proto.body = body
        json_proto.expanded = expanded
        return self.dg._enqueue("json", json_proto)

    @property
    def dg(self) -> "DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
