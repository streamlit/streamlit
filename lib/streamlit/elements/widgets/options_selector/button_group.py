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
    CustomIconList,
    FeedbackOptions,
    FeedbackSerde,
    get_mapped_options_and_format_funcs,
    selected_star_icon,
)
from streamlit.elements.widgets.options_selector.options_selector_utils import (
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


def build_proto(
    widget_id: str,
    formatted_options: list[str],
    default_values: list[int],
    disabled: bool,
    current_form_id: str,
    click_mode: ButtonGroupProto.ClickMode.ValueType,
    selection_highlight: ButtonGroupProto.SelectionHighlight.ValueType = (
        ButtonGroupProto.SelectionHighlight.ONLY_SELECTED
    ),
    selected_options: list[str] | None = None,
) -> ButtonGroupProto:
    proto = ButtonGroupProto()

    proto.id = widget_id
    proto.default[:] = default_values
    proto.form_id = current_form_id
    proto.disabled = disabled

    proto = cast(ButtonGroupProto, proto)
    proto.click_mode = click_mode
    proto.options[:] = formatted_options
    proto.selection_highlight = selection_highlight
    proto.selected_options[:] = selected_options or []
    return proto


class ButtonGroupMixin:
    # Disable this more generic widget for now
    # @gather_metrics("button_group")
    # def button_group(
    #     self,
    #     options: list[str],
    #     *,
    #     key: Key | None = None,
    #     default: list[bool] | None = None,
    #     click_mode: ButtonGroupClickMode = "radio",
    #     disabled: bool = False,
    #     format_func: Callable[[str], bytes] = lambda x: str(x).encode("utf-8"),
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
        options: FeedbackOptions | CustomIconList = "thumbs",
        *,
        key: str | None = None,
        disabled: bool = False,
        on_click: WidgetCallback | None = None,
        args: Any | None = None,
        kwargs: Any | None = None,
    ) -> int | None:
        """Returns the index of the selected feedback option.

        Options:
        --------
        - thumbs: Renders a thumbs up and thumbs down button. Returned indices are
            `[0, 1]` for thumbs up and thumbs down, respectively.
        - smiles: Renders a set of smiley faces. Returned indices are `[0, 1, 2, 3, 4]`
            for the five smiley faces.
        - stars: Renders a set of stars. Returned indices are `[0, 1, 2, 3, 4]` for the
            five stars.
        - a list of material icon strings in the form of [":material/icon_name:", ...].

        Examples
        --------

        Example 1: Display a feedback widget with stars and show the selected sentiment
        ```python
        sentiment_mapping: = [0.0, 0.25, 0.5, 0.75, 1.0]
        selected = st.feedback("stars")
        st.write(f"You selected: {sentiment_mapping[selected]}")
        ```

        Example 2: Display a feedback widget with thumbs and show the selected sentiment
        ```python
        sentiment_mapping: = [0.0, 1.0]
        selected = st.feedback("thumbs")
        st.write(f"You selected: {sentiment_mapping[selected]}")
        ```
        """

        if not isinstance(options, list) and options not in get_args(FeedbackOptions):
            raise StreamlitAPIException(
                "The options argument to st.feedback must be one of "
                "['thumbs', 'smiles', 'stars']. "
                f"The argument passed was '{options}'."
            )
        selected_options = [selected_star_icon] * 5 if options == "stars" else None
        mapped_options, format_func = get_mapped_options_and_format_funcs(options)
        serde = FeedbackSerde(mapped_options)

        selection_highlight = ButtonGroupProto.SelectionHighlight.ONLY_SELECTED
        if options == "stars":
            selection_highlight = ButtonGroupProto.SelectionHighlight.ALL_UP_TO_SELECTED

        sentiment = self._button_group(
            mapped_options,
            key=key,
            click_mode=ButtonGroupProto.RADIO,
            disabled=disabled,
            format_func=format_func,
            on_click=on_click,
            args=args,
            kwargs=kwargs,
            deserializer=serde.deserialize,
            serializer=serde.serialize,
            selection_highlight=selection_highlight,
            selected_options=selected_options,
        )
        return sentiment

    def _button_group(
        self,
        options: OptionSequence[V],
        *,
        key: Key | None = None,
        default: list[int] | None = None,
        click_mode: ButtonGroupProto.ClickMode.ValueType = ButtonGroupProto.RADIO,
        disabled: bool = False,
        format_func: Callable[[V], str] = lambda opt: str(opt),
        on_click: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        deserializer: WidgetDeserializer[T] | None = None,
        serializer: WidgetSerializer[T] | None = None,
        selection_highlight: ButtonGroupProto.SelectionHighlight.ValueType = (
            ButtonGroupProto.SelectionHighlight.ONLY_SELECTED
        ),
        selected_options: list[str] | None = None,
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
            disabled=disabled,
            page=ctx.active_script_hash if ctx else None,
        )

        button_group_proto = build_proto(
            widget_id,
            formatted_options,
            default_values,
            disabled,
            current_form_id(self.dg),
            click_mode=click_mode,
            selection_highlight=selection_highlight,
            selected_options=selected_options,
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
