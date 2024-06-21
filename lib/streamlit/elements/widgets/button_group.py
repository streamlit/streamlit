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

from typing import TYPE_CHECKING, Any, Callable, Literal, cast

from streamlit.elements.form import current_form_id
from streamlit.elements.widgets.multiselect_utils import (
    build_proto,
    check_multiselect_policies,
    register_widget_and_enqueue,
    transform_options,
)
from streamlit.errors import StreamlitAPIException
from streamlit.proto.ButtonGroup_pb2 import ButtonGroup as ButtonGroupProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner import get_script_run_ctx
from streamlit.runtime.state.common import compute_widget_id
from streamlit.type_util import (
    Key,
    OptionSequence,
    T,
    to_key,
)

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.runtime.state import (
        WidgetArgs,
        WidgetCallback,
        WidgetKwargs,
    )


class ButtonGroupMixin:
    @gather_metrics("button_group")
    def button_group(
        self,
        options: list[str],
        *,
        key: Key | None = None,
        default: list[bool] | None = None,
        click_mode: Literal["button", "checkbox", "radio"] = "button",
        disabled: bool = False,
        format_func: Callable[[str], str] = lambda x: str(x),
        on_click: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
    ) -> str | list[str] | None:
        default_values = (
            [index for index, default_val in enumerate(default) if default_val is True]
            if default is not None
            else []
        )
        return self._button_group(
            options,
            key=key,
            default=default_values,
            click_mode=click_mode,
            disabled=disabled,
            format_func=format_func,
            on_click=on_click,
            args=args,
            kwargs=kwargs,
        )

        # current_values: list[str] = (
        #     selected_indices if selected_indices is not None else default_values
        # )

        # if len(current_values) == 0:
        #     return None
        # if len(current_values) == 1:
        #     return options[current_values[0]]

        # return [options[val] for val in current_values]

    @gather_metrics("feedback")
    def feedback(
        self,
        options: Literal["thumbs", "smiles", "stars"] = "thumbs",
        *,
        key: str | None = None,
        disabled: bool = False,
        on_click: WidgetCallback | None = None,
        args: Any | None = None,
        kwargs: Any | None = None,
    ) -> float | None:
        def format_func_thumbs(option: float) -> bytes:
            mapped_option = ""
            if abs(option - 1.0) < 1e-6:
                mapped_option = ":material/thumb_up:"
            if abs(option - 0.0) < 1e-6:
                mapped_option = ":material/thumb_down:"

            return mapped_option.encode("utf-8")

        def format_func_smiles(option: float) -> bytes:
            mapped_option = ""
            if abs(option - 0.0) < 1e-6:
                mapped_option = ":material/sentiment_sad:"
            if abs(option - 0.25) < 1e-6:
                mapped_option = ":material/sentiment_dissatisfied:"
            if abs(option - 0.5) < 1e-6:
                mapped_option = ":material/sentiment_neutral:"
            if abs(option - 0.75) < 1e-6:
                mapped_option = ":material/sentiment_satisfied:"
            if abs(option - 1.0) < 1e-6:
                mapped_option = ":material/sentiment_very_satisfied:"

            return mapped_option.encode("utf-8")

        def format_func_stars(option: float) -> bytes:
            return b":material/star_rate:"

        actual_options = [1.0, 0.0]
        if options in ["smiles", "stars"]:
            actual_options = [0, 0.25, 0.5, 0.75, 1]

        if options == "thumbs":
            format_func = format_func_thumbs
            # thumbs_up is 1, thumbs_down is 0; but we want to show thumbs_up first,
            # so its index is 0
        elif options == "smiles":
            format_func = format_func_smiles
            # generates steps from 0 to 1 like [0, 0.25, 0.5, 0.75, 1]
        elif options == "stars":
            format_func = format_func_stars
        else:
            raise StreamlitAPIException(
                "The options argument to st.feedback must be one of "
                "['thumbs', 'smiles', 'stars']. "
                f"The argument passed was '{options}'."
            )

        def _on_click(*args, **kwargs):
            if key is None:
                on_click(*args, **kwargs)
                return

            # Problem: we don't have the widget id here, so the key has to be provided
            ctx = get_script_run_ctx()
            current_value = (
                ctx.session_state[key]
                if key is not None and key in ctx.session_state
                else None
            )
            new_kwargs = dict(kwargs, _st_value=current_value)
            on_click(*args, **new_kwargs)

        sentiment = self._button_group(
            actual_options,
            key=key,
            click_mode="radio",
            disabled=disabled,
            format_func=format_func,
            on_click=_on_click if on_click else None,
            args=args,
            kwargs=kwargs,
        )
        return sentiment[0] if len(sentiment) > 0 else None

    def _button_group(
        self,
        options: OptionSequence[T],
        *,
        key: Key | None = None,
        default: list[int] | None = None,
        click_mode: Literal["button", "checkbox", "radio"] = "button",
        disabled: bool = False,
        format_func: Callable[[T], Any] = str,
        on_click: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
    ) -> list[T]:
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

        mapped_click_mode = ButtonGroupProto.BUTTON
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
            mapped_click_mode,
        )

        # missing proto fields from MultiSelect:
        # label, label_visibility, max_selections, help
        # additional proto fields: click_mode

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
        )

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
