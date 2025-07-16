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

import hashlib
from datetime import date, datetime, time, timedelta
from typing import (
    TYPE_CHECKING,
    Any,
    Literal,
    Union,
    overload,
)

from google.protobuf.message import Message
from typing_extensions import TypeAlias

from streamlit import config
from streamlit.errors import StreamlitDuplicateElementId, StreamlitDuplicateElementKey
from streamlit.proto.ChatInput_pb2 import ChatInput
from streamlit.proto.LabelVisibilityMessage_pb2 import LabelVisibilityMessage
from streamlit.proto.RootContainer_pb2 import RootContainer
from streamlit.runtime.scriptrunner_utils.script_run_context import (
    ScriptRunContext,
    get_script_run_ctx,
)
from streamlit.runtime.state.common import (
    GENERATED_ELEMENT_ID_PREFIX,
    TESTING_KEY,
    user_key_from_element_id,
)

if TYPE_CHECKING:
    from builtins import ellipsis
    from collections.abc import Iterable

    from streamlit.delta_generator import DeltaGenerator


Key: TypeAlias = Union[str, int]

LabelVisibility: TypeAlias = Literal["visible", "hidden", "collapsed"]

PROTO_SCALAR_VALUE = Union[float, int, bool, str, bytes]
SAFE_VALUES = Union[
    date,
    time,
    datetime,
    timedelta,
    None,
    "ellipsis",
    Message,
    PROTO_SCALAR_VALUE,
]


def get_label_visibility_proto_value(
    label_visibility_string: LabelVisibility,
) -> LabelVisibilityMessage.LabelVisibilityOptions.ValueType:
    """Returns one of LabelVisibilityMessage enum constants.py based on string value."""

    if label_visibility_string == "visible":
        return LabelVisibilityMessage.LabelVisibilityOptions.VISIBLE
    if label_visibility_string == "hidden":
        return LabelVisibilityMessage.LabelVisibilityOptions.HIDDEN
    if label_visibility_string == "collapsed":
        return LabelVisibilityMessage.LabelVisibilityOptions.COLLAPSED

    raise ValueError(f"Unknown label visibility value: {label_visibility_string}")


def get_chat_input_accept_file_proto_value(
    accept_file_value: bool | Literal["multiple"],
) -> ChatInput.AcceptFile.ValueType:
    """Returns one of ChatInput.AcceptFile enum value based on string value."""

    if accept_file_value is False:
        return ChatInput.AcceptFile.NONE
    if accept_file_value is True:
        return ChatInput.AcceptFile.SINGLE
    if accept_file_value == "multiple":
        return ChatInput.AcceptFile.MULTIPLE

    raise ValueError(f"Unknown accept file value: {accept_file_value}")


@overload
def to_key(key: None) -> None: ...


@overload
def to_key(key: Key) -> str: ...


def to_key(key: Key | None) -> str | None:
    return None if key is None else str(key)


def _register_element_id(
    ctx: ScriptRunContext, element_type: str, element_id: str
) -> None:
    """Register the element ID and key for the given element.

    If the element ID or key is not unique, an error is raised.

    Parameters
    ----------
    element_type : str
        The type of the element to register.

    element_id : str
        The ID of the element to register.

    Raises
    ------
    StreamlitDuplicateElementKey
        If the element key is not unique.

    StreamlitDuplicateElementID
        If the element ID is not unique.

    """

    if not element_id:
        return

    if user_key := user_key_from_element_id(element_id):
        if user_key not in ctx.widget_user_keys_this_run:
            ctx.widget_user_keys_this_run.add(user_key)
        else:
            raise StreamlitDuplicateElementKey(user_key)

    if element_id not in ctx.widget_ids_this_run:
        ctx.widget_ids_this_run.add(element_id)
    else:
        raise StreamlitDuplicateElementId(element_type)


def _compute_element_id(
    element_type: str,
    user_key: str | None = None,
    **kwargs: SAFE_VALUES | Iterable[SAFE_VALUES],
) -> str:
    """Compute the ID for the given element.

    This ID is stable: a given set of inputs to this function will always produce
    the same ID output. Only stable, deterministic values should be used to compute
    element IDs. Using nondeterministic values as inputs can cause the resulting
    element ID to change between runs.

    The element ID includes the user_key so elements with identical arguments can
    use it to be distinct. The element ID includes an easily identified prefix, and the
    user_key as a suffix, to make it easy to identify it and know if a key maps to it.
    """
    h = hashlib.new("md5", usedforsecurity=False)
    h.update(element_type.encode("utf-8"))
    if user_key:
        # Adding this to the hash isn't necessary for uniqueness since the
        # key is also appended to the ID as raw text. But since the hash and
        # the appending of the key are two slightly different aspects, it
        # still gets put into the hash.
        h.update(user_key.encode("utf-8"))
    # This will iterate in a consistent order when the provided arguments have
    # consistent order; dicts are always in insertion order.
    for k, v in kwargs.items():
        h.update(str(k).encode("utf-8"))
        h.update(str(v).encode("utf-8"))
    return f"{GENERATED_ELEMENT_ID_PREFIX}-{h.hexdigest()}-{user_key}"


def compute_and_register_element_id(
    element_type: str,
    *,
    user_key: str | None,
    form_id: str | None,
    dg: DeltaGenerator | None = None,
    **kwargs: SAFE_VALUES | Iterable[SAFE_VALUES],
) -> str:
    """Compute and register the ID for the given element.

    This ID is stable: a given set of inputs to this function will always produce
    the same ID output. Only stable, deterministic values should be used to compute
    element IDs. Using nondeterministic values as inputs can cause the resulting
    element ID to change between runs.

    The element ID includes the user_key so elements with identical arguments can
    use it to be distinct. The element ID includes an easily identified prefix, and the
    user_key as a suffix, to make it easy to identify it and know if a key maps to it.

    The element ID gets registered to make sure that only one ID and user-specified
    key exists at the same time. If there are duplicated IDs or keys, an error
    is raised.

    Parameters
    ----------
    element_type : str
        The type (command name) of the element to register.

    user_key : str | None
        The user-specified key for the element. `None` if no key is provided
        or if the element doesn't support a specifying a key.

    form_id : str | None
        The ID of the form that the element belongs to. `None` or empty string
        if the element doesn't belong to a form or doesn't support forms.

    dg : DeltaGenerator | None
        The DeltaGenerator of each element. `None` if the element is not a widget.

    kwargs : SAFE_VALUES | Iterable[SAFE_VALUES]
        The arguments to use to compute the element ID.
        The arguments must be stable, deterministic values.
        Some common parameters like key, disabled,
        format_func, label_visibility, args, kwargs, on_change, and
        the active_script_hash are not supposed to be added here
    """
    ctx = get_script_run_ctx()

    # If form_id is provided, add it to the kwargs.
    kwargs_to_use = {"form_id": form_id, **kwargs} if form_id else kwargs

    if ctx:
        # Add the active script hash to give elements on different
        # pages unique IDs.
        kwargs_to_use["active_script_hash"] = ctx.active_script_hash

    if dg:
        # If no key is provided and the widget element is inside the sidebar area
        # add it to the kwargs
        # allowing the same widget to be both in main area and sidebar.
        active_dg_root_container = dg._active_dg._root_container
        if active_dg_root_container == RootContainer.SIDEBAR and user_key is None:
            kwargs_to_use["active_dg_root_container"] = str(active_dg_root_container)

    element_id = _compute_element_id(
        element_type,
        user_key,
        **kwargs_to_use,
    )

    if ctx:
        _register_element_id(ctx, element_type, element_id)
    return element_id


def save_for_app_testing(ctx: ScriptRunContext, k: str, v: Any) -> None:
    if config.get_option("global.appTest"):
        try:
            ctx.session_state[TESTING_KEY][k] = v
        except KeyError:
            ctx.session_state[TESTING_KEY] = {k: v}
