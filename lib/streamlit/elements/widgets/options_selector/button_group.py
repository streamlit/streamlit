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

from typing import TYPE_CHECKING, Any, Callable, Literal, cast, get_args

from streamlit.elements.form import current_form_id
from streamlit.elements.widgets.options_selector.feedback_utils import (
    FeedbackOptions,
    FeedbackSerde,
    get_mapped_options_and_format_funcs,
)
from streamlit.elements.widgets.options_selector.options_selector_utils import (
    build_proto,
    check_multiselect_policies,
    register_widget_and_enqueue,
    transform_options,
)
from streamlit.errors import StreamlitAPIException
from streamlit.proto.ButtonGroup_pb2 import ButtonGroup as ButtonGroupProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner import get_script_run_ctx
from streamlit.runtime.state.common import (
    WidgetDeserializer,
    WidgetSerializer,
    compute_widget_id,
)
from streamlit.type_util import Key, OptionSequence, T, V, to_key

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.runtime.state import (
        WidgetArgs,
        WidgetCallback,
        WidgetKwargs,
    )

ButtonGroupClickMode = Literal["checkbox", "radio"]


class ButtonGroupMixin:
    # Disable this more generic widget for now
    # @gather_metrics("button_group")
    # def button_group(
    #     self,
    #     options: list[str],
    #     *,
    #     key: Key | None = None,
    #     default: list[bool] | None = None,
    #     click_mode: Literal["checkbox", "radio"] = "radio",
    #     disabled: bool = False,
    #     format_func: Callable[[str], str] = lambda x: str(x),
    #     on_click: WidgetCallback | None = None,
    #     args: WidgetArgs | None = None,
    #     kwargs: WidgetKwargs | None = None,
    # ) -> str | list[str] | None:
    #     default_values = (
    #         [index for index, default_val in enumerate(default) if default_val is True]
    #         if default is not None
    #         else []
    #     )
    #     return self._button_group(
    #         options,
    #         key=key,
    #         default=default_values,
    #         click_mode=click_mode,
    #         disabled=disabled,
    #         format_func=format_func,
    #         on_click=on_click,
    #         args=args,
    #         kwargs=kwargs,
    #     )

    @gather_metrics("feedback")
    def feedback(
        self,
        options: FeedbackOptions = "thumbs",
        *,
        key: str | None = None,
        disabled: bool = False,
        on_click: WidgetCallback | None = None,
        args: Any | None = None,
        kwargs: Any | None = None,
    ) -> float | None:
        if options not in get_args(FeedbackOptions):
            raise StreamlitAPIException(
                "The options argument to st.feedback must be one of "
                "['thumbs', 'smiles', 'stars']. "
                f"The argument passed was '{options}'."
            )
        mapped_options, format_func = get_mapped_options_and_format_funcs(options)
        serde = FeedbackSerde(mapped_options)
        sentiment = self._button_group(
            mapped_options,
            key=key,
            click_mode="radio",
            disabled=disabled,
            format_func=format_func,
            on_click=on_click,
            args=args,
            kwargs=kwargs,
            deserializer=serde.deserialize,
            serializer=serde.serialize,
        )
        return sentiment

    def _button_group(
        self,
        options: OptionSequence[V],
        *,
        key: Key | None = None,
        default: list[int] | None = None,
        click_mode: ButtonGroupClickMode = "radio",
        disabled: bool = False,
        format_func: Callable[[V], Any] = str,
        on_click: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        deserializer: WidgetDeserializer[T] | None = None,
        serializer: WidgetSerializer[T] | None = None,
    ) -> T:
        key = to_key(key)

        check_multiselect_policies(self.dg, key, on_click, default)

        widget_name = "button_group"
        indexable_options, formatted_options, default_values = transform_options(
            options, default, format_func
        )

        ctx = get_script_run_ctx()
        widget_id = compute_widget_id(
            widget_name,
            user_key=key,
            key=key,
            options=formatted_options,
            default=default_values,
            page=ctx.active_script_hash if ctx else None,
        )

        if click_mode == "radio":
            mapped_click_mode = ButtonGroupProto.RADIO
        elif click_mode == "checkbox":
            mapped_click_mode = ButtonGroupProto.CHECKBOX

        button_group_proto = build_proto(
            ButtonGroupProto,
            widget_id,
            formatted_options,
            default_values,
            disabled,
            current_form_id(self.dg),
            click_mode=mapped_click_mode,
        )

        return register_widget_and_enqueue(
            self.dg,
            widget_name,
            button_group_proto,
            widget_id,
            formatted_options,
            indexable_options,
            default_values,
            ctx,
            on_click,
            args,
            kwargs,
            None,
            format_func,
            deserializer=deserializer,
            serializer=serializer,
        )

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
