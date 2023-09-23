# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

from enum import Enum, EnumMeta
from typing import (
    TYPE_CHECKING,
    Any,
    Hashable,
    List,
    Optional,
    Tuple,
    Type,
    Union,
    cast,
    overload,
)

import streamlit
from streamlit import config, runtime, type_util
from streamlit.elements.form import is_in_form
from streamlit.errors import StreamlitAPIException
from streamlit.proto.LabelVisibilityMessage_pb2 import LabelVisibilityMessage
from streamlit.runtime.state import WidgetCallback, get_session_state
from streamlit.runtime.state.common import RegisterWidgetResult

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.type_util import DataFrameCompatible


def last_index_for_melted_dataframes(
    data: Union["DataFrameCompatible", Any]
) -> Optional[Hashable]:
    if type_util.is_dataframe_compatible(data):
        data = type_util.convert_anything_to_df(data)

        if data.index.size > 0:
            return cast(Hashable, data.index[-1])

    return None


def check_callback_rules(
    dg: "DeltaGenerator", on_change: Optional[WidgetCallback]
) -> None:
    if runtime.exists() and is_in_form(dg) and on_change is not None:
        raise StreamlitAPIException(
            "With forms, callbacks can only be defined on the `st.form_submit_button`."
            " Defining callbacks on other widgets inside a form is not allowed."
        )


_shown_default_value_warning: bool = False

SESSION_STATE_WRITES_NOT_ALLOWED_ERROR_TEXT = """
Values for st.button, st.download_button, st.file_uploader, st.data_editor,
st.chat_input, and st.form cannot be set using st.session_state.
"""


def check_session_state_rules(
    default_value: Any, key: Optional[str], writes_allowed: bool = True
) -> None:
    global _shown_default_value_warning

    if key is None or not runtime.exists():
        return

    session_state = get_session_state()
    if not session_state.is_new_state_value(key):
        return

    if not writes_allowed:
        raise StreamlitAPIException(SESSION_STATE_WRITES_NOT_ALLOWED_ERROR_TEXT)

    if (
        default_value is not None
        and not _shown_default_value_warning
        and not config.get_option("global.disableWidgetStateDuplicationWarning")
    ):
        streamlit.warning(
            f'The widget with key "{key}" was created with a default value but'
            " also had its value set via the Session State API."
        )
        _shown_default_value_warning = True


def get_label_visibility_proto_value(
    label_visibility_string: type_util.LabelVisibility,
) -> "LabelVisibilityMessage.LabelVisibilityOptions.ValueType":
    """Returns one of LabelVisibilityMessage enum constants.py based on string value."""

    if label_visibility_string == "visible":
        return LabelVisibilityMessage.LabelVisibilityOptions.VISIBLE
    elif label_visibility_string == "hidden":
        return LabelVisibilityMessage.LabelVisibilityOptions.HIDDEN
    elif label_visibility_string == "collapsed":
        return LabelVisibilityMessage.LabelVisibilityOptions.COLLAPSED

    raise ValueError(f"Unknown label visibility value: {label_visibility_string}")


@overload
def maybe_coerce_enum(
    register_widget_result: RegisterWidgetResult[Enum],
    options: Type[Enum],
) -> RegisterWidgetResult[Enum]:
    ...


@overload
def maybe_coerce_enum(
    register_widget_result: RegisterWidgetResult[type_util.T],
    options: type_util.OptionSequence[type_util.T],
) -> RegisterWidgetResult[type_util.T]:
    ...


def maybe_coerce_enum(register_widget_result, options):
    """Maybe Coerce a RegisterWidgetResult with an Enum member value to RegisterWidgetResult[option] if option
    is an EnumType, otherwise just return the original RegisterWidgetResult."""

    if isinstance(register_widget_result.value, Enum) and isinstance(options, EnumMeta):
        return RegisterWidgetResult(
            type_util.coerce_enum(register_widget_result.value, options),
            register_widget_result.value_changed,
        )
    return register_widget_result


# slightly ugly typing because TypeVars with Generic Bounds are not supported
# (https://github.com/python/typing/issues/548)
@overload
def maybe_coerce_enum_sequence(
    register_widget_result: RegisterWidgetResult[List[type_util.T]],
    options: type_util.OptionSequence[type_util.T],
) -> RegisterWidgetResult[List[type_util.T]]:
    ...


@overload
def maybe_coerce_enum_sequence(
    register_widget_result: RegisterWidgetResult[Tuple[type_util.T, type_util.T]],
    options: type_util.OptionSequence[type_util.T],
) -> RegisterWidgetResult[Tuple[type_util.T, type_util.T]]:
    ...


def maybe_coerce_enum_sequence(register_widget_result, options):
    """Maybe Coerce a RegisterWidgetResult with a sequence of Enum members as value
    to RegisterWidgetResult[Sequence[option]] if option is an EnumType, otherwise just return
    the original RegisterWidgetResult."""

    if all(
        isinstance(val, Enum) for val in register_widget_result.value
    ) and isinstance(options, EnumMeta):
        return RegisterWidgetResult(
            type(register_widget_result.value)(
                type_util.coerce_enum(val, options)
                for val in register_widget_result.value
            ),
            register_widget_result.value_changed,
        )
    return register_widget_result
