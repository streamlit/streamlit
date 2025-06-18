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
from typing import TYPE_CHECKING, Any

from streamlit.components.types.base_custom_component import BaseCustomComponent
from streamlit.dataframe_util import is_dataframe_like
from streamlit.delta_generator_singletons import get_dg_singleton_instance
from streamlit.elements.lib.form_utils import current_form_id
from streamlit.elements.lib.policies import check_cache_replay_rules
from streamlit.elements.lib.utils import compute_and_register_element_id
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Components_pb2 import ArrowTable as ArrowTableProto
from streamlit.proto.Components_pb2 import SpecialArg
from streamlit.proto.Element_pb2 import Element
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner_utils.script_run_context import get_script_run_ctx
from streamlit.runtime.state import register_widget
from streamlit.type_util import is_bytes_like, to_bytes

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.runtime.state.common import WidgetCallback


class MarshallComponentException(StreamlitAPIException):
    """Class for exceptions generated during custom component marshalling."""

    pass


class CustomComponent(BaseCustomComponent):
    """A Custom Component declaration."""

    def __call__(
        self,
        *args: Any,
        default: Any = None,
        key: str | None = None,
        on_change: WidgetCallback | None = None,
        tab_index: int | None = None,
        **kwargs: Any,
    ) -> Any:
        """An alias for create_instance."""
        return self.create_instance(
            *args,
            default=default,
            key=key,
            on_change=on_change,
            tab_index=tab_index,
            **kwargs,
        )

    @gather_metrics("create_instance")
    def create_instance(
        self,
        *args: Any,
        default: Any = None,
        key: str | None = None,
        on_change: WidgetCallback | None = None,
        tab_index: int | None = None,
        **kwargs: Any,
    ) -> Any:
        """Create a new instance of the component.

        Parameters
        ----------
        *args
            Must be empty; all args must be named. (This parameter exists to
            enforce correct use of the function.)
        default: any or None
            The default return value for the component. This is returned when
            the component's frontend hasn't yet specified a value with
            `setComponentValue`.
        key: str or None
            If not None, this is the user key we use to generate the
            component's "widget ID".
        on_change: WidgetCallback or None
            An optional callback invoked when the widget's value changes. No arguments are passed to it.
        tab_index : int, optional
            Specifies the tab order of the iframe containing the component.
            Possible values are:
            - ``None`` (default): Browser default behavior.
            - ``-1``: Removes the iframe from the natural tab order, but it can still be focused programmatically.
            - ``0`` or positive integer: Includes the iframe in the natural tab order.
        **kwargs
            Keyword args to pass to the component.

        Returns
        -------
        any or None
            The component's widget value.

        """
        if len(args) > 0:
            raise MarshallComponentException(f"Argument '{args[0]}' needs a label")

        # Validate tab_index according to web specifications
        if tab_index is not None and not (
            isinstance(tab_index, int)
            and not isinstance(tab_index, bool)
            and tab_index >= -1
        ):
            raise StreamlitAPIException(
                "tab_index must be None, -1, or a non-negative integer."
            )

        try:
            import pyarrow  # noqa: F401, ICN001

            from streamlit.components.v1 import component_arrow
        except ImportError:
            raise StreamlitAPIException(
                """To use Custom Components in Streamlit, you need to install
PyArrow. To do so locally:

`pip install pyarrow`

And if you're using Streamlit Cloud, add "pyarrow" to your requirements.txt."""
            )

        check_cache_replay_rules()
        # In addition to the custom kwargs passed to the component, we also
        # send the special 'default' and 'key' params to the component
        # frontend.
        all_args = dict(kwargs, default=default, key=key)

        json_args = {}
        special_args = []
        for arg_name, arg_val in all_args.items():
            if is_bytes_like(arg_val):
                bytes_arg = SpecialArg()
                bytes_arg.key = arg_name
                bytes_arg.bytes = to_bytes(arg_val)
                special_args.append(bytes_arg)
            elif is_dataframe_like(arg_val):
                dataframe_arg = SpecialArg()
                dataframe_arg.key = arg_name
                component_arrow.marshall(dataframe_arg.arrow_dataframe.data, arg_val)
                special_args.append(dataframe_arg)
            else:
                json_args[arg_name] = arg_val

        try:
            serialized_json_args = json.dumps(json_args)
        except Exception as ex:
            raise MarshallComponentException(
                "Could not convert component args to JSON", ex
            )

        def marshall_component(dg: DeltaGenerator, element: Element) -> Any:
            element.component_instance.component_name = self.name
            element.component_instance.form_id = current_form_id(dg)
            if self.url is not None:
                element.component_instance.url = self.url
            if tab_index is not None:
                element.component_instance.tab_index = tab_index

            # Normally, a widget's element_hash (which determines
            # its identity across multiple runs of an app) is computed
            # by hashing its arguments. This means that, if any of the arguments
            # to the widget are changed, Streamlit considers it a new widget
            # instance and it loses its previous state.
            #
            # However! If a *component* has a `key` argument, then the
            # component's hash identity is determined by entirely by
            # `component_name + url + key`. This means that, when `key`
            # exists, the component will maintain its identity even when its
            # other arguments change, and the component's iframe won't be
            # remounted on the frontend.

            def marshall_element_args() -> None:
                element.component_instance.json_args = serialized_json_args
                element.component_instance.special_args.extend(special_args)

            ctx = get_script_run_ctx()

            if key is None:
                marshall_element_args()
                computed_id = compute_and_register_element_id(
                    "component_instance",
                    user_key=key,
                    form_id=current_form_id(dg),
                    name=self.name,
                    url=self.url,
                    json_args=serialized_json_args,
                    special_args=special_args,
                )
            else:
                computed_id = compute_and_register_element_id(
                    "component_instance",
                    user_key=key,
                    form_id=current_form_id(dg),
                    name=self.name,
                    url=self.url,
                )
            element.component_instance.id = computed_id

            def deserialize_component(ui_value: Any) -> Any:
                # ui_value is an object from json, an ArrowTable proto, or a bytearray
                return ui_value

            component_state = register_widget(
                element.component_instance.id,
                deserializer=deserialize_component,
                serializer=lambda x: x,
                ctx=ctx,
                on_change_handler=on_change,
                value_type="json_value",
            )
            widget_value = component_state.value

            if key is not None:
                marshall_element_args()

            if widget_value is None:
                widget_value = default
            elif isinstance(widget_value, ArrowTableProto):
                widget_value = component_arrow.arrow_proto_to_dataframe(widget_value)
            return widget_value

        # We currently only support writing to st._main, but this will change
        # when we settle on an improved API in a post-layout world.
        dg = get_dg_singleton_instance().main_dg

        element = Element()
        return_value = marshall_component(dg, element)

        dg._enqueue("component_instance", element.component_instance)
        return return_value

    def __eq__(self, other: object) -> bool:
        """Equality operator."""
        return (
            isinstance(other, CustomComponent)
            and self.name == other.name
            and self.path == other.path
            and self.url == other.url
            and self.module_name == other.module_name
        )

    __hash__ = BaseCustomComponent.__hash__

    def __ne__(self, other: object) -> bool:
        """Inequality operator."""

        # we have to use "not X == Y"" here because if we use "X != Y"
        # we call __ne__ again and end up in recursion
        return not self == other

    def __str__(self) -> str:
        return f"'{self.name}': {self.path if self.path is not None else self.url}"
