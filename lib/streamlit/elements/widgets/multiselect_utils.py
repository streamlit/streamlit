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

from dataclasses import dataclass, field
from textwrap import dedent
from typing import TYPE_CHECKING, Any, Callable, Generic, Sequence, cast

from streamlit.elements.lib.policies import (
    check_cache_replay_rules,
    check_callback_rules,
    check_fragment_path_policy,
    check_session_state_rules,
)
from streamlit.elements.lib.utils import (
    get_label_visibility_proto_value,
    maybe_coerce_enum_sequence,
)
from streamlit.errors import StreamlitAPIException
from streamlit.proto.ButtonGroup_pb2 import ButtonGroup as ButtonGroupProto
from streamlit.proto.MultiSelect_pb2 import MultiSelect as MultiSelectProto
from streamlit.runtime.state import (
    WidgetArgs,
    WidgetCallback,
    WidgetKwargs,
    register_widget,
)
from streamlit.runtime.state.common import (
    save_for_app_testing,
)
from streamlit.type_util import (
    LabelVisibility,
    OptionSequence,
    T,
    check_python_comparable,
    ensure_indexable,
    is_iterable,
    is_type,
)

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.runtime.scriptrunner.script_run_context import ScriptRunContext


@dataclass
class MultiSelectSerde(Generic[T]):
    options: Sequence[T]
    default_value: list[int] = field(default_factory=list)

    def serialize(self, value: list[T]) -> list[int]:
        indices = check_and_convert_to_indices(self.options, value)
        return indices if indices is not None else []

    def deserialize(
        self,
        ui_value: list[int] | None,
        widget_id: str = "",
    ) -> list[T]:
        current_value: list[int] = (
            ui_value if ui_value is not None else self.default_value
        )
        return [self.options[i] for i in current_value]


def _get_over_max_options_message(current_selections: int, max_selections: int):
    curr_selections_noun = "option" if current_selections == 1 else "options"
    max_selections_noun = "option" if max_selections == 1 else "options"
    return f"""
Multiselect has {current_selections} {curr_selections_noun} selected but \
`max_selections` is set to {max_selections}.
This happened because you either gave too many options to `default` or you manipulated \
the widget's state through `st.session_state`. Note that the latter can happen before \
the line indicated in the traceback.
Please select at most {max_selections} {max_selections_noun}.
"""


def check_and_convert_to_indices(
    opt: Sequence[Any], default_values: Sequence[Any] | Any | None
) -> list[int] | None:
    """Perform validation checks and return indices based on the default values."""
    if default_values is None and None not in opt:
        return None

    if not isinstance(default_values, list):
        # This if is done before others because calling if not x (done
        # right below) when x is of type pd.Series() or np.array() throws a
        # ValueError exception.
        if is_type(default_values, "numpy.ndarray") or is_type(
            default_values, "pandas.core.series.Series"
        ):
            default_values = list(cast(Sequence[Any], default_values))
        elif (
            isinstance(default_values, (tuple, set))
            or default_values
            and default_values not in opt
        ):
            default_values = list(default_values)
        else:
            default_values = [default_values]
    for value in default_values:
        if value not in opt:
            raise StreamlitAPIException(
                f"The default value '{value}' is not part of the options. "
                "Please make sure that every default values also exists in the options."
            )

    return [opt.index(value) for value in default_values]


def get_default_count(default: Sequence[Any] | Any | None) -> int:
    if default is None:
        return 0
    if not is_iterable(default):
        return 1
    return len(cast(Sequence[Any], default))


def check_multiselect_policies(
    dg: DeltaGenerator,
    key: str | None,
    on_change: WidgetCallback | None = None,
    default: Sequence[Any] | Any | None = None,
):
    check_fragment_path_policy(dg)
    check_cache_replay_rules()
    check_callback_rules(dg, on_change)
    check_session_state_rules(default_value=default, key=key)
    # maybe_raise_label_warnings(label, label_visibility)


def transform_options(
    options: OptionSequence[T],
    default: Sequence[Any] | Any | None = None,
    format_func: Callable[[T], Any] = str,
) -> tuple[Sequence[T], list[Any], list[int]]:
    indexable_options = ensure_indexable(options)
    check_python_comparable(indexable_options)
    indices = check_and_convert_to_indices(indexable_options, default)
    indices = indices if indices is not None else []
    formatted_options = [format_func(option) for option in indexable_options]

    return indexable_options, formatted_options, indices


def build_proto(
    proto_class: type[MultiSelectProto | ButtonGroupProto],
    widget_id: str,
    formatted_options: list[str | bytes],
    default_values: list[int],
    disabled: bool,
    current_form_id: str,
    label: str = "",
    label_visibility: LabelVisibility = "visible",
    max_selections: int | None = None,
    placeholder: str = "",
    help: str | None = None,
    click_mode: Any = None,  # ButtonGroup.ClickMode
) -> MultiSelectProto | ButtonGroupProto:
    proto = proto_class()

    proto.id = widget_id
    proto.default[:] = default_values
    proto.form_id = current_form_id
    proto.disabled = disabled

    if proto_class == MultiSelectProto:
        proto = cast(MultiSelectProto, proto)
        proto.label = label
        proto.max_selections = max_selections or 0
        proto.placeholder = placeholder
        proto.label_visibility.value = get_label_visibility_proto_value(
            label_visibility
        )

        if help is not None:
            proto.help = dedent(help)

        proto.options[:] = cast(list[str], formatted_options)
    else:
        proto = cast(ButtonGroupProto, proto)
        proto.click_mode = click_mode
        proto.options[:] = cast(list[bytes], formatted_options)

    return proto


def register_widget_and_enqueue(
    dg: DeltaGenerator,
    widget_name: str,
    proto: MultiSelectProto | ButtonGroupProto,
    widget_id: str,
    options: OptionSequence[T],
    indexable_options: Sequence[T],
    default_options: list[int],
    ctx: ScriptRunContext | None = None,
    on_change_handler: WidgetCallback | None = None,
    args: WidgetArgs | None = None,
    kwargs: WidgetKwargs | None = None,
    max_selections: int | None = None,
    app_testing_value: Any | None = None,
) -> list[T]:
    serde = MultiSelectSerde(indexable_options, default_options)
    widget_state = register_widget(
        widget_name,
        proto,
        # user_key=key,
        on_change_handler=on_change_handler,
        args=args,
        kwargs=kwargs,
        deserializer=serde.deserialize,
        serializer=serde.serialize,
        ctx=ctx,
    )
    default_count = get_default_count(widget_state.value)
    if max_selections and default_count > max_selections:
        raise StreamlitAPIException(
            _get_over_max_options_message(default_count, max_selections)
        )
    widget_state = maybe_coerce_enum_sequence(widget_state, options, indexable_options)

    if widget_state.value_changed:
        proto.value[:] = serde.serialize(widget_state.value)
        proto.set_value = True

    if ctx:
        save_for_app_testing(ctx, widget_id, app_testing_value)
    dg._enqueue(widget_name, proto)

    return widget_state.value
