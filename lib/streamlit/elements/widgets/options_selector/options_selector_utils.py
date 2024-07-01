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
from typing import (
    TYPE_CHECKING,
    Any,
    Callable,
    Generic,
    Sequence,
    cast,
    overload,
)

from streamlit.elements.lib.policies import (
    check_cache_replay_rules,
    check_callback_rules,
    check_fragment_path_policy,
    check_session_state_rules,
)
from streamlit.elements.lib.utils import (
    maybe_coerce_enum,
    maybe_coerce_enum_sequence,
)
from streamlit.errors import StreamlitAPIException
from streamlit.type_util import (
    OptionSequence,
    T,
    check_python_comparable,
    ensure_indexable,
    is_iterable,
    is_type,
)

if TYPE_CHECKING:
    from enum import Enum

    from streamlit.delta_generator import DeltaGenerator
    from streamlit.runtime.state import (
        WidgetCallback,
    )
    from streamlit.runtime.state.common import (
        RegisterWidgetResult,
    )


@dataclass
class MultiSelectSerde(Generic[T]):
    options: Sequence[T]
    default_value: list[int] = field(default_factory=list)

    def serialize(self, value: list[T]) -> list[int]:
        indices = _check_and_convert_to_indices(self.options, value)
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


def _check_and_convert_to_indices(
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


def _get_over_max_options_message(current_selections: int, max_selections: int):
    curr_selections_noun = "option" if current_selections == 1 else "options"
    max_selections_noun = "option" if max_selections == 1 else "options"
    return f"""
Multiselect has {current_selections} {curr_selections_noun} selected but `max_selections`
is set to {max_selections}. This happened because you either gave too many options to `default`
or you manipulated the widget's state through `st.session_state`. Note that
the latter can happen before the line indicated in the traceback.
Please select at most {max_selections} {max_selections_noun}.
"""


def _get_default_count(default: Sequence[Any] | Any | None) -> int:
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
    check_session_state_rules(default_value=default, key=key, writes_allowed=True)


def check_max_selections(
    selections: Sequence[Any] | Any | None, max_selections: int | None
):
    if max_selections is None:
        return

    default_count = _get_default_count(selections)
    if default_count > max_selections:
        raise StreamlitAPIException(
            _get_over_max_options_message(default_count, max_selections)
        )


@overload
def maybe_coerce(
    register_widget_result: RegisterWidgetResult[Enum],
    options: type[Enum],
    opt_sequence: Sequence[Any],
) -> RegisterWidgetResult[Enum]: ...


@overload
def maybe_coerce(
    register_widget_result: RegisterWidgetResult[T],
    options: OptionSequence[T],
    opt_sequence: Sequence[T],
) -> RegisterWidgetResult[T]: ...


# @overload
# def maybe_coerce(
#     register_widget_result: RegisterWidgetResult[list[T]],
#     options: OptionSequence[T],
#     opt_sequence: Sequence[T],
# ) -> RegisterWidgetResult[list[T]]: ...


def maybe_coerce(
    register_widget_result,
    options,
    indexable_options,
):
    if isinstance(register_widget_result.value, list):
        return maybe_coerce_enum_sequence(
            register_widget_result, options, indexable_options
        )

    return maybe_coerce_enum(register_widget_result, options, indexable_options)


def _default_format_func(option: T) -> str:
    return str(option)


def transform_options(
    options: OptionSequence[T],
    default: Sequence[Any] | Any | None = None,
    format_func: Callable[[T], Any] | None = None,
) -> tuple[Sequence[T], list[Any], list[int]]:
    indexable_options = ensure_indexable(options)
    check_python_comparable(indexable_options)
    default_indices = _check_and_convert_to_indices(indexable_options, default)
    default_indices = default_indices if default_indices is not None else []
    if format_func is None:
        format_func = _default_format_func
    formatted_options = [format_func(option) for option in indexable_options]

    return indexable_options, formatted_options, default_indices
