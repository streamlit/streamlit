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

import json
import types
from collections import ChainMap, UserDict
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Literal, TypeAlias, cast, overload

from streamlit.elements.lib.form_utils import current_form_id
from streamlit.elements.lib.policies import check_widget_policies
from streamlit.elements.lib.utils import (
    Key,
    compute_and_register_element_id,
    to_key,
)
from streamlit.errors import StreamlitAPIException
from streamlit.proto.JsonEditor_pb2 import JsonEditor as JsonEditorProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner import ScriptRunContext, get_script_run_ctx
from streamlit.runtime.state import (
    WidgetArgs,
    WidgetCallback,
    WidgetKwargs,
    register_widget,
)
from streamlit.type_util import (
    dump_pydantic_sequence,
    is_custom_dict,
    is_list_like,
    is_namedtuple,
    is_pydantic_model,
    is_sequence_of_pydantic_models,
)

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator


_InputType: TypeAlias = Literal["dict", "list", "string"]


def _ensure_serialization(o: object) -> str | list[Any]:
    """A repr function for json.dumps default arg, which tries to serialize sets
    as lists.
    """
    return list(o) if isinstance(o, set) else repr(o)


def _normalize_to_json_string(
    value: dict[str, Any] | list[Any] | str,
) -> tuple[str, _InputType]:
    """Convert the input value to a JSON string and determine its input type."""
    # Handle dict-like types
    if is_custom_dict(value):
        value = value.to_dict()  # ty: ignore[unresolved-attribute]

    if is_namedtuple(value):
        value = value._asdict()  # ty: ignore[unresolved-attribute]

    if isinstance(
        value, (ChainMap, types.MappingProxyType, UserDict)
    ) or is_pydantic_model(value):
        value = dict(value)  # type: ignore

    # Handle list-like types
    if is_list_like(value):
        if is_sequence_of_pydantic_models(value):
            try:
                value = dump_pydantic_sequence(value)
            except AttributeError:
                value = list(value)
        else:
            value = list(value)

    # Determine input type and convert to JSON string
    if isinstance(value, str):
        try:
            json.loads(value)
        except json.JSONDecodeError as e:
            raise StreamlitAPIException(
                f"The string value provided to `st.json_editor` is not valid JSON: {e}"
            ) from None
        return value, "string"

    if isinstance(value, dict):
        input_type: _InputType = "dict"
    elif isinstance(value, list):
        input_type = "list"
    else:
        raise StreamlitAPIException(
            f"`st.json_editor` value must be a dict, list, or JSON string, "
            f"but got {type(value).__name__}."
        )

    try:
        json_str = json.dumps(value, default=_ensure_serialization)
    except TypeError as e:
        raise StreamlitAPIException(
            f"The {input_type} value provided to `st.json_editor` "
            f"is not JSON-serializable: {e}"
        ) from None

    return json_str, input_type


@dataclass
class JsonEditorSerde:
    """Serializer/deserializer for the JSON editor widget."""

    default: str
    input_type: _InputType

    def serialize(self, v: dict[str, Any] | list[Any] | str) -> str:
        """Serialize the value to a JSON string for the frontend."""
        if isinstance(v, str):
            return v
        return json.dumps(v, default=_ensure_serialization)

    def deserialize(self, ui_value: str | None) -> dict[str, Any] | list[Any] | str:
        """Deserialize the value from the frontend.

        Returns the value in the same type as the input (dict, list, or str).
        """
        if ui_value is None or ui_value == "":
            ui_value = self.default

        parsed = json.loads(ui_value)

        if self.input_type == "string":
            return ui_value
        if self.input_type == "list":
            return parsed if isinstance(parsed, list) else [parsed]
        # dict
        return parsed if isinstance(parsed, dict) else {"value": parsed}


class JsonEditorMixin:
    @overload
    def json_editor(
        self,
        value: dict[str, Any],
        *,
        key: Key | None = None,
        height: int | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        disabled: bool = False,
    ) -> dict[str, Any]: ...

    @overload
    def json_editor(
        self,
        value: list[Any],
        *,
        key: Key | None = None,
        height: int | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        disabled: bool = False,
    ) -> list[Any]: ...

    @overload
    def json_editor(
        self,
        value: str,
        *,
        key: Key | None = None,
        height: int | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        disabled: bool = False,
    ) -> str: ...

    @gather_metrics("json_editor")
    def json_editor(
        self,
        value: dict[str, Any] | list[Any] | str,
        *,
        key: Key | None = None,
        height: int | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        disabled: bool = False,
    ) -> dict[str, Any] | list[Any] | str:
        r"""Display an interactive JSON editor widget.

        Unlike ``st.json`` which only displays JSON data, ``st.json_editor``
        allows users to interactively view and edit JSON structures. The widget
        returns the edited JSON value.

        Parameters
        ----------
        value : dict, list, or str
            The initial JSON value to display and edit. This can be:

            - A dict: Displayed as a JSON object. Returns a dict.
            - A list: Displayed as a JSON array. Returns a list.
            - A str: Must be a valid JSON string. Returns a str.

            Dict-like objects (Pydantic models, named tuples, ChainMap, etc.)
            are converted to dicts. List-like objects (tuples, sets, etc.) are
            converted to lists.

        key : str, int, or None
            An optional string or integer to use as the unique key for the
            widget. If this is ``None`` (default), a key will be generated for
            the widget based on the values of the other parameters. No two
            widgets may have the same key. Assigning a key stabilizes the
            widget's identity and preserves its state across reruns even when
            other parameters change.

            A key lets you read or update the widget's value via
            ``st.session_state[key]``. For more details, see `Widget behavior
            <https://docs.streamlit.io/develop/concepts/architecture/widget-behavior>`_.

            Additionally, if ``key`` is provided, it will be used as a CSS
            class name prefixed with ``st-key-``.

        height : int or None
            The height of the widget in pixels. If ``None`` (default), the
            widget auto-sizes based on content.

        on_change : callable
            An optional callback invoked when the JSON value changes.

        args : list or tuple
            An optional list or tuple of args to pass to the callback.

        kwargs : dict
            An optional dict of kwargs to pass to the callback.

        disabled : bool
            An optional boolean that disables editing if set to ``True``. When
            disabled, the widget displays the JSON in read-only mode. The
            default is ``False``.

        Returns
        -------
        dict, list, or str
            The edited JSON value. The return type matches the input type:

            - dict input → dict return
            - list input → list return
            - str input → str return (JSON string)

        Examples
        --------
        Basic usage with a dict:

        >>> import streamlit as st
        >>>
        >>> config = st.json_editor(
        ...     {
        ...         "database": {
        ...             "host": "localhost",
        ...             "port": 5432,
        ...         },
        ...         "debug": True,
        ...     }
        ... )
        >>>
        >>> st.write("Current config:", config)

        Using a callback:

        >>> import streamlit as st
        >>>
        >>> def on_config_change():
        ...     st.toast("Configuration updated!")
        >>>
        >>> config = st.json_editor(
        ...     {"api_key": "", "timeout": 30},
        ...     on_change=on_config_change,
        ...     key="config_editor",
        ... )

        Read-only mode:

        >>> import streamlit as st
        >>>
        >>> st.json_editor(data, disabled=True)

        """
        ctx = get_script_run_ctx()
        return self._json_editor(
            value=value,
            key=key,
            height=height,
            on_change=on_change,
            args=args,
            kwargs=kwargs,
            disabled=disabled,
            ctx=ctx,
        )

    def _json_editor(
        self,
        value: dict[str, Any] | list[Any] | str,
        *,
        key: Key | None = None,
        height: int | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        disabled: bool = False,
        ctx: ScriptRunContext | None = None,
    ) -> dict[str, Any] | list[Any] | str:
        key = to_key(key)

        check_widget_policies(
            self.dg,
            key,
            on_change,
            default_value=value,
        )

        # Normalize the input value to a JSON string and determine input type
        json_string, input_type = _normalize_to_json_string(value)

        element_id = compute_and_register_element_id(
            "json_editor",
            user_key=key,
            key_as_main_identity=True,
            dg=self.dg,
            value=json_string,
            height=height,
        )

        json_editor_proto = JsonEditorProto()
        json_editor_proto.id = element_id
        json_editor_proto.default = json_string
        json_editor_proto.disabled = disabled
        json_editor_proto.height = height if height is not None else 0
        json_editor_proto.form_id = current_form_id(self.dg)
        json_editor_proto.input_type = input_type

        serde = JsonEditorSerde(default=json_string, input_type=input_type)

        widget_state = register_widget(
            json_editor_proto.id,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=serde.deserialize,
            serializer=serde.serialize,
            ctx=ctx,
            value_type="string_value",
        )

        if widget_state.value_changed:
            json_editor_proto.value = serde.serialize(widget_state.value)
            json_editor_proto.set_value = True

        self.dg._enqueue("json_editor", json_editor_proto)
        return widget_state.value

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
