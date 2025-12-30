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

from typing import TYPE_CHECKING

from streamlit.errors import StreamlitAPIException
from streamlit.runtime.state.common import (
    RegisterWidgetResult,
    T,
    ValueFieldName,
    WidgetArgs,
    WidgetCallback,
    WidgetDeserializer,
    WidgetKwargs,
    WidgetMetadata,
    WidgetSerializer,
    WidgetValuePresenter,
    extract_query_param_name,
    is_query_param_key,
    user_key_from_element_id,
)
from streamlit.runtime.state.query_param_serializers import (
    deserialize_bool,
    deserialize_color,
    deserialize_date_input_value,
    deserialize_datetime,
    deserialize_number,
    deserialize_number_range,
    deserialize_option,
    deserialize_slider_value,
    deserialize_string,
    deserialize_time,
    serialize_bool,
    serialize_color,
    serialize_date_input_value,
    serialize_datetime,
    serialize_number,
    serialize_number_range,
    serialize_option,
    serialize_slider_value,
    serialize_string,
    serialize_time,
)

if TYPE_CHECKING:
    from streamlit.runtime.scriptrunner import ScriptRunContext
    from streamlit.runtime.state.query_params import (
        QueryParamDeserializer,
        QueryParamSerializer,
    )


# Default serializers for each value type. Used when auto-detecting
# query param bindings from user keys with the "?" prefix.
_VALUE_TYPE_SERIALIZERS: dict[
    ValueFieldName,
    tuple[QueryParamSerializer, QueryParamDeserializer] | None,
] = {
    "bool_value": (serialize_bool, deserialize_bool),
    "string_value": (serialize_string, deserialize_string),
    "int_value": (serialize_number, lambda v: deserialize_number(v, as_int=True)),
    "double_value": (serialize_number, deserialize_number),
    # Array types use range serializers (comma-separated values)
    # Note: string_array_value is not supported because it's used by multiple
    # widgets (date_input, datetime_input) with different string formats
    "double_array_value": (
        serialize_number_range,
        deserialize_number_range,
    ),
    "int_array_value": (
        serialize_number_range,
        lambda v: deserialize_number_range(v, as_int=True),
    ),
    "string_array_value": None,  # Widget-specific (date format varies)
    # Complex types that should not be bound to URL params
    "arrow_value": None,
    "bytes_value": None,
    "file_uploader_state_value": None,
    "json_value": None,
    "json_trigger_value": None,
    "trigger_value": None,
    "string_trigger_value": None,
    "chat_input_value": None,
}


def register_widget(
    element_id: str,
    *,
    deserializer: WidgetDeserializer[T],
    serializer: WidgetSerializer[T],
    ctx: ScriptRunContext | None,
    callbacks: dict[str, WidgetCallback] | None = None,
    on_change_handler: WidgetCallback | None = None,
    args: WidgetArgs | None = None,
    kwargs: WidgetKwargs | None = None,
    value_type: ValueFieldName,
    presenter: WidgetValuePresenter | None = None,
) -> RegisterWidgetResult[T]:
    """Register a widget with Streamlit, and return its current value.
    NOTE: This function should be called after the proto has been filled.

    Parameters
    ----------
    element_id : str
        The id of the element. Must be unique.
    deserializer : WidgetDeserializer[T]
        Called to convert a widget's protobuf value to the value returned by
        its st.<widget_name> function.
    serializer : WidgetSerializer[T]
        Called to convert a widget's value to its protobuf representation.
    ctx : ScriptRunContext or None
        Used to ensure uniqueness of widget IDs, and to look up widget values.
    callbacks : dict[str, WidgetCallback] or None
        A dictionary of callbacks for multi-callback support.
    on_change_handler : WidgetCallback or None
        An optional callback invoked when the widget's value changes.
    args : WidgetArgs or None
        Positional arguments to pass to the `on_change_handler` or `callbacks`.
    kwargs : WidgetKwargs or None
        Keyword arguments to pass to the `on_change_handler` or `callbacks`.
    value_type: ValueFieldName
        The value_type the widget is going to use.
        We use this information to start with a best-effort guess for the value_type
        of each widget. Once we actually receive a proto for a widget from the
        frontend, the guess is updated to be the correct type. Unfortunately, we're
        not able to always rely on the proto as the type may be needed earlier.
        Thankfully, in these cases (when value_type == "trigger_value"), the static
        table here being slightly inaccurate should never pose a problem.
    presenter : WidgetValuePresenter or None
        An optional hook that allows a widget to customize how its value should be
        presented.

    Returns
    -------
    register_widget_result : RegisterWidgetResult[T]
        Provides information on which value to return to the widget caller,
        and whether the UI needs updating.

        - Unhappy path:
            - Our ScriptRunContext doesn't exist (meaning that we're running
            as a "bare script" outside streamlit).
            - We are disconnected from the SessionState instance.
            In both cases we'll return a fallback RegisterWidgetResult[T].
        - Happy path:
            - The widget has already been registered on a previous run but the
            user hasn't interacted with it on the client. The widget will have
            the default value it was first created with. We then return a
            RegisterWidgetResult[T], containing this value.
            - The widget has already been registered and the user *has*
            interacted with it. The widget will have that most recent
            user-specified value. We then return a RegisterWidgetResult[T],
            containing this value.

        For both paths a widget return value is provided, allowing the widgets
        to be used in a non-streamlit setting.

    Notes
    -----
    If the widget's key starts with "?" (e.g., key="?enabled"), it will be
    automatically bound to a URL query parameter with that name (minus the "?").
    This allows widget values to be synchronized with the URL.
    """
    if on_change_handler is not None and callbacks is not None:
        raise StreamlitAPIException(
            "Cannot provide both `on_change` and `callbacks` to a widget."
        )

    # Create the widget's updated metadata, and register it with session_state.
    metadata = WidgetMetadata(
        element_id,
        deserializer,
        serializer,
        value_type=value_type,
        callback=on_change_handler,
        callbacks=callbacks,
        callback_args=args,
        callback_kwargs=kwargs,
        fragment_id=ctx.current_fragment_id if ctx else None,
        presenter=presenter,
    )
    return register_widget_from_metadata(metadata, ctx, value_type)


def register_widget_from_metadata(
    metadata: WidgetMetadata[T],
    ctx: ScriptRunContext | None,
    value_type: ValueFieldName | None = None,
) -> RegisterWidgetResult[T]:
    """Register a widget and return its value, using an already constructed
    `WidgetMetadata`.

    This is split out from `register_widget` to allow caching code to replay
    widgets by saving and reusing the completed metadata.

    See `register_widget` for details on what this returns.
    """
    if ctx is None:
        # Early-out if we don't have a script run context (which probably means
        # we're running as a "bare" Python script, and not via `streamlit run`).
        return RegisterWidgetResult.failure(deserializer=metadata.deserializer)

    widget_id = metadata.id
    user_key = user_key_from_element_id(widget_id)

    # Auto-detect query param binding from user key prefix ("?")
    if user_key is not None and is_query_param_key(user_key):
        param_key = extract_query_param_name(user_key)
        # Get serializers for this value type
        effective_value_type = value_type or metadata.value_type
        serializers = _VALUE_TYPE_SERIALIZERS.get(effective_value_type)
        serde_instance = getattr(metadata.deserializer, "__self__", None)
        serde_name = serde_instance.__class__.__name__ if serde_instance else ""

        # Widget-specific serializer overrides
        if effective_value_type == "string_value":
            if serde_name == "TimeInputSerde":
                serializers = (serialize_time, deserialize_time)
            elif serde_name == "ColorPickerSerde":
                serializers = (serialize_color, deserialize_color)

        # NumberInput with format-aware rounding to match displayed precision
        if effective_value_type == "double_value" and serde_name == "NumberInputSerde":
            import re

            data_type = getattr(serde_instance, "data_type", 0)
            format_str = getattr(serde_instance, "format_str", None)

            # Extract decimal places from format string like "%.6f" or "%0.2f"
            format_precision: int | None = None
            if format_str and "f" in format_str.lower():
                match = re.search(r"\.(\d+)f", format_str, re.IGNORECASE)
                if match:
                    format_precision = int(match.group(1))

            def _round_to_precision(value: float | None) -> float | None:
                """Round value to match the display format precision."""
                if value is None:
                    return None
                if format_precision is not None:
                    return round(value, format_precision)
                # Fallback: no format precision, return as-is
                return value

            def _serialize_number_formatted(value: object) -> str:
                if value is None:
                    return ""
                # NumberInputProto.INT = 0, NumberInputProto.FLOAT = 1
                if data_type == 0:  # INT
                    return str(int(value))  # type: ignore[call-overload]
                # Round to format precision for floats (matches what user sees)
                rounded = _round_to_precision(float(value))  # type: ignore[arg-type]
                return serialize_number(rounded)

            def _deserialize_number_formatted(
                v: str | list[str],
            ) -> int | float | None:
                # NumberInputProto.INT = 0, NumberInputProto.FLOAT = 1
                parsed = deserialize_number(v, as_int=(data_type == 0))
                if parsed is None:
                    return None
                # Round deserialized values to format precision
                if data_type != 0 and format_precision is not None:
                    return _round_to_precision(float(parsed))
                return parsed

            serializers = (_serialize_number_formatted, _deserialize_number_formatted)

        # Category C: Selection widgets with value-based serialization
        # st.radio uses int_value (index), convert to value-based for human-friendly URLs
        if effective_value_type == "int_value" and serde_name == "RadioSerde":
            options = getattr(serde_instance, "options", [])
            default_index = getattr(serde_instance, "index", 0)

            def _serialize_radio(value: object) -> str:
                return serialize_option(value, options)

            def _deserialize_radio(v: str | list[str]) -> object | None:
                default_val = (
                    options[default_index] if default_index is not None else None
                )
                return deserialize_option(v, options, default=default_val)

            serializers = (_serialize_radio, _deserialize_radio)

        # st.multiselect uses string_array_value (formatted strings)
        # Serialize as repeated query params: ?tags=a&tags=b
        # Use formatted_options (from format_func) for human-readable URLs
        if (
            effective_value_type == "string_array_value"
            and serde_name == "MultiSelectSerde"
        ):
            options = getattr(serde_instance, "options", [])
            formatted_options = getattr(serde_instance, "formatted_options", [])
            formatted_to_index = getattr(
                serde_instance, "formatted_option_to_option_index", {}
            )

            def _get_formatted_for_value(v: object) -> str:
                """Get formatted string for a value, handling unhashable types."""
                for i, opt in enumerate(options):
                    if opt == v:
                        return formatted_options[i]
                # Fallback to str() for values not in options
                return str(v)

            def _serialize_multiselect(values: object) -> list[str]:
                if values is None:
                    return []
                if not isinstance(values, (list, tuple)):
                    values = [values]
                return [_get_formatted_for_value(v) for v in values]

            def _deserialize_multiselect(v: str | list[str]) -> list[object]:
                if isinstance(v, str):
                    v = [v] if v else []
                result = []
                for val in v:
                    # Look up via formatted_option_to_option_index (uses format_func)
                    idx = formatted_to_index.get(val)
                    if idx is not None:
                        result.append(options[idx])
                    else:
                        # Fallback: try matching str(option)
                        for opt in options:
                            if str(opt) == val:
                                result.append(opt)
                                break
                return result

            serializers = (_serialize_multiselect, _deserialize_multiselect)

        # st.select_slider uses double_array_value (indices as floats)
        # Convert to value-based for human-friendly URLs
        if (
            effective_value_type == "double_array_value"
            and serde_name == "SelectSliderSerde"
        ):
            options = getattr(serde_instance, "options", [])
            is_range = bool(getattr(serde_instance, "is_range_value", False))

            def _serialize_select_slider(value: object) -> str:
                return serialize_option(value, options)

            def _deserialize_select_slider(v: str | list[str]) -> object | None:
                result = deserialize_option(v, options)
                if result is None:
                    return None
                # Select slider returns single value or tuple based on is_range
                if is_range:
                    # For range sliders, expect comma-separated values like "A,C"
                    if isinstance(v, list):
                        v = v[-1] if v else ""
                    if isinstance(v, str) and "," in v:
                        parts = v.split(",", 1)
                        start = deserialize_option(parts[0], options)
                        end = deserialize_option(parts[1], options)
                        if start is not None and end is not None:
                            return (start, end)
                    return None
                return result

            def _serialize_select_slider_full(value: object) -> str:
                # Handle range values (tuple/list)
                if isinstance(value, (tuple, list)) and len(value) == 2:
                    s1 = serialize_option(value[0], options)
                    s2 = serialize_option(value[1], options)
                    return f"{s1},{s2}"
                return serialize_option(value, options)

            serializers = (_serialize_select_slider_full, _deserialize_select_slider)

        if effective_value_type == "double_array_value" and serde_name == "SliderSerde":
            # Sliders always use double_array_value in widget state, even for single-value
            # sliders. Query param strings should be human-friendly, so deserialize to the
            # slider's Python return type (int/float/date/time/datetime).
            import math as _math

            from streamlit.proto.Slider_pb2 import Slider as SliderProto

            data_type = getattr(serde_instance, "data_type", SliderProto.FLOAT)
            slider_step = getattr(serde_instance, "step", None)
            if data_type == SliderProto.INT:
                slider_data_type = "int"
            elif data_type == SliderProto.DATE:
                slider_data_type = "date"
            elif data_type == SliderProto.TIME:
                slider_data_type = "time"
            elif data_type == SliderProto.DATETIME:
                slider_data_type = "datetime"
            else:
                slider_data_type = "float"

            single_value = bool(getattr(serde_instance, "single_value", True))

            def _snap_to_step(val: float | int) -> float | int:
                """Snap a numeric value to the nearest step."""
                if slider_step is None or slider_step == 0:
                    return val
                if slider_data_type == "int":
                    return int(round(val / slider_step) * slider_step)
                # Round to nearest step
                snapped = round(val / slider_step) * slider_step
                # Determine decimal places from step to avoid floating point artifacts
                if slider_step >= 1:
                    decimal_places = 0
                else:
                    decimal_places = max(0, -_math.floor(_math.log10(abs(slider_step))))
                return round(snapped, decimal_places)

            def _deserialize_slider(v: str | list[str]) -> object | None:
                parsed = deserialize_slider_value(v, data_type=slider_data_type)
                if parsed is None:
                    return None
                # Snap float values to nearest step
                if slider_data_type == "float" and slider_step:
                    if isinstance(parsed, tuple):
                        parsed = (_snap_to_step(parsed[0]), _snap_to_step(parsed[1]))
                    else:
                        parsed = _snap_to_step(parsed)
                if single_value:
                    return None if isinstance(parsed, tuple) else parsed
                return parsed if isinstance(parsed, tuple) else None

            serializers = (serialize_slider_value, _deserialize_slider)

        if serializers is None and effective_value_type == "string_array_value":
            # string_array_value is used by multiple widgets with different formats.
            # Select serializers based on the widget's serde type.
            deserializer_name = getattr(metadata.deserializer, "__qualname__", "")
            if "DateInputSerde" in deserializer_name:
                serializers = (serialize_date_input_value, deserialize_date_input_value)
            elif "DateTimeInputSerde" in deserializer_name:
                serializers = (serialize_datetime, deserialize_datetime)

        if serializers is not None:
            query_param_serializer, query_param_deserializer = serializers

            # Use context manager to access query_params from SafeSessionState
            with ctx.session_state.query_params() as query_params:
                # Register the binding for two-way sync
                query_params.bind_widget(
                    param_key=param_key,
                    widget_id=widget_id,
                    serializer=query_param_serializer,
                    deserializer=query_param_deserializer,
                )

                # Check if there's an initial value from the URL to use
                # This must be done BEFORE register_widget to override the default
                initial_url_value = query_params.get_initial_value(param_key)
                if initial_url_value is not None:
                    # Deserialize the URL string value to the widget's value type
                    deserialized_value = query_param_deserializer(initial_url_value)
                    if (
                        deserialized_value is not None
                        and user_key not in ctx.session_state
                    ):
                        # Seed the widget's initial value from the session's initial URL.
                        #
                        # Important: use reset_state_value() (instead of __setitem__)
                        # because by this point the element ID has already been
                        # registered in ctx.widget_ids_this_run, and on reruns the
                        # user_key->widget_id mapping may already exist. That combination
                        # would otherwise trigger the "cannot be modified after the
                        # widget is instantiated" guard.
                        #
                        # Only seed once: if the user_key already exists in session
                        # state, preserve the existing value (e.g. user interaction).
                        ctx.session_state.reset_state_value(
                            user_key, deserialized_value
                        )
        else:
            # No serializers for this value type - skip query param binding.
            pass

    return ctx.session_state.register_widget(metadata, user_key)
