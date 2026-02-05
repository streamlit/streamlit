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

import math
from collections.abc import Iterable, Iterator, Mapping, MutableMapping
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Final, cast
from urllib import parse

from streamlit.errors import StreamlitAPIException, StreamlitQueryParamDictValueError
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime.scriptrunner_utils.script_run_context import get_script_run_ctx

if TYPE_CHECKING:
    from _typeshed import SupportsKeysAndGetItem

QueryParamValue = str | Iterable[str]
QueryParamsInput = Mapping[str, QueryParamValue] | Iterable[tuple[str, QueryParamValue]]


EMBED_QUERY_PARAM: Final[str] = "embed"
EMBED_OPTIONS_QUERY_PARAM: Final[str] = "embed_options"
EMBED_QUERY_PARAMS_KEYS: Final[list[str]] = [
    EMBED_QUERY_PARAM,
    EMBED_OPTIONS_QUERY_PARAM,
]

# Protected parameters that cannot be bound to widgets
PROTECTED_QUERY_PARAMS: Final[frozenset[str]] = frozenset(
    [EMBED_QUERY_PARAM, EMBED_OPTIONS_QUERY_PARAM]
)


@dataclass
class WidgetBinding:
    """Represents a binding between a widget and a query parameter."""

    widget_id: str
    param_key: str
    value_type: str  # e.g., "bool_value", "string_value", etc.
    script_hash: str  # For MPA: identifies main vs page script


def parse_url_param(value: str | list[str], value_type: str) -> Any:
    """Convert URL param to Python value based on WidgetState value type.

    Parameters
    ----------
    value : str | list[str]
        The URL parameter value(s).
    value_type : str
        The WidgetState value type (e.g., "bool_value", "string_value").

    Returns
    -------
    Any
        The parsed Python value appropriate for the widget type.

    Raises
    ------
    ValueError
        If the value cannot be parsed for the given type.
    """
    # For single-value types, get the last value if it's a list
    val = value[-1] if isinstance(value, list) else value

    match value_type:
        case "bool_value":
            lower_val = val.lower()
            if lower_val == "true":
                return True
            if lower_val == "false":
                return False
            raise ValueError(f"Invalid boolean value: {val}")
        case "int_value":
            # Try to parse as int, but return string if it fails.
            # This intentionally differs from double_value (which raises on failure)
            # because int_value is used for selection widgets where URLs may contain
            # human-readable option strings (e.g., ?fruit=apple instead of ?fruit=0).
            # The deserializer will match the string against widget options.
            try:
                return int(val)
            except ValueError:
                return val
        case "double_value":
            return float(val)
        case "string_value":
            return val
        case "string_array_value":
            # Repeated params: ?foo=a&foo=b -> ["a", "b"]
            return list(value) if isinstance(value, list) else [value]
        case "double_array_value":
            # Repeated params: ?foo=1.5&foo=2.5 -> [1.5, 2.5]
            # Also handles string values for select_slider option matching
            parts = list(value) if isinstance(value, list) else [value]
            result_double: list[float | str] = []
            for part in parts:
                try:
                    result_double.append(float(part))
                except ValueError:  # noqa: PERF203
                    result_double.append(part)  # Keep as string for select_slider
            return result_double
        case "int_array_value":
            # Repeated params: ?foo=1&foo=2 -> [1, 2]
            # Also handles string values for option matching (pills, etc.)
            parts = list(value) if isinstance(value, list) else [value]
            result_int: list[int | str] = []
            for part in parts:
                try:
                    result_int.append(int(part))
                except ValueError:  # noqa: PERF203
                    result_int.append(part)  # Keep as string
            return result_int
        case _:
            # Unknown type, return as-is
            return val


@dataclass
class QueryParams(MutableMapping[str, str]):
    """A lightweight wrapper of a dict that sends forwardMsgs when state changes.
    It stores str keys with str and List[str] values.

    Also manages widget bindings to query parameters for the bind="query-params" feature.
    """

    _query_params: dict[str, list[str] | str] = field(default_factory=dict)

    # Widget binding registries
    _bindings_by_param: dict[str, WidgetBinding] = field(default_factory=dict)
    _bindings_by_widget: dict[str, WidgetBinding] = field(default_factory=dict)

    # Store initial query params from URL at page load for seeding session state
    _initial_query_params: dict[str, list[str]] = field(default_factory=dict)

    def __iter__(self) -> Iterator[str]:
        return iter(
            key
            for key in self._query_params
            if key.lower() not in EMBED_QUERY_PARAMS_KEYS
        )

    def __getitem__(self, key: str) -> str:
        """Retrieves a value for a given key in query parameters.
        Returns the last item in a list or an empty string if empty.
        If the key is not present, raise KeyError.
        """
        if key.lower() in EMBED_QUERY_PARAMS_KEYS:
            raise KeyError(missing_key_error_message(key))

        try:
            value = self._query_params[key]
            if isinstance(value, list):
                if len(value) == 0:
                    return ""
                # Return the last value to mimic Tornado's behavior
                # https://www.tornadoweb.org/en/stable/web.html#tornado.web.RequestHandler.get_query_argument
                return value[-1]
            return value
        except KeyError:
            raise KeyError(missing_key_error_message(key))

    def __setitem__(self, key: str, value: str | Iterable[str]) -> None:
        # Prevent direct manipulation of bound query params
        if self.is_bound(key):
            raise StreamlitAPIException(
                f"Cannot directly set query parameter '{key}' - "
                f"it is bound to a widget. Modify the widget value instead."
            )
        self._set_item_internal(key, value)
        self._send_query_param_msg()

    def _set_item_internal(self, key: str, value: str | Iterable[str]) -> None:
        _set_item_in_dict(self._query_params, key, value)

    def __delitem__(self, key: str) -> None:
        if key.lower() in EMBED_QUERY_PARAMS_KEYS:
            raise KeyError(missing_key_error_message(key))
        # Prevent direct deletion of bound query params
        if self.is_bound(key):
            raise StreamlitAPIException(
                f"Cannot directly delete query parameter '{key}' - "
                f"it is bound to a widget. Modify the widget value instead."
            )
        try:
            del self._query_params[key]
            self._send_query_param_msg()
        except KeyError:
            raise KeyError(missing_key_error_message(key))

    def update(  # ty: ignore[invalid-method-override]
        self,
        other: Iterable[tuple[str, str | Iterable[str]]]
        | SupportsKeysAndGetItem[str, str | Iterable[str]] = (),
        /,
        **kwds: str,
    ) -> None:
        # This overrides the `update` provided by MutableMapping
        # to ensure only one one ForwardMsg is sent.

        # Consume dict-like objects into a list upfront to avoid iterating twice
        # (once for keys, once for values). This prevents potential issues if
        # `other` is modified during iteration.
        other_as_list: list[tuple[str, str | Iterable[str]]]
        if hasattr(other, "keys") and hasattr(other, "__getitem__"):
            other_dict = cast("SupportsKeysAndGetItem[str, str | Iterable[str]]", other)
            keys = list(other_dict.keys())
            other_as_list = [(k, other_dict[k]) for k in keys]
        else:
            # other is an iterable of tuples - consume into list
            other_as_list = list(other)

        # Collect all keys to check for bound params before making any changes
        keys_to_update = [key for key, _ in other_as_list]
        keys_to_update.extend(kwds.keys())

        # Check for bound params
        for key in keys_to_update:
            if self.is_bound(key):
                raise StreamlitAPIException(
                    f"Cannot directly set query parameter '{key}' - "
                    f"it is bound to a widget. Modify the widget value instead."
                )

        # Now apply the updates
        for key, value in other_as_list:
            self._set_item_internal(key, value)
        for key, value in kwds.items():
            self._set_item_internal(key, value)
        self._send_query_param_msg()

    def get_all(self, key: str) -> list[str]:
        if key not in self._query_params or key.lower() in EMBED_QUERY_PARAMS_KEYS:
            return []
        value = self._query_params[key]
        return value if isinstance(value, list) else [value]

    def __len__(self) -> int:
        return len(
            {
                key
                for key in self._query_params
                if key.lower() not in EMBED_QUERY_PARAMS_KEYS
            }
        )

    def __str__(self) -> str:
        return str(self._query_params)

    def _send_query_param_msg(self) -> None:
        ctx = get_script_run_ctx()
        if ctx is None:
            return

        msg = ForwardMsg()
        msg.page_info_changed.query_string = parse.urlencode(
            self._query_params, doseq=True
        )
        ctx.query_string = msg.page_info_changed.query_string
        ctx.enqueue(msg)

    def clear(self) -> None:
        # Check if any bound params exist
        bound_params = [key for key in self._query_params if self.is_bound(key)]
        if bound_params:
            raise StreamlitAPIException(
                f"Cannot clear query parameters - the following are bound to widgets: "
                f"{', '.join(repr(k) for k in bound_params)}. "
                f"Modify the widget values instead, or remove the bind parameter."
            )
        self.clear_with_no_forward_msg(preserve_embed=True)
        self._send_query_param_msg()

    def to_dict(self) -> dict[str, str]:
        # return the last query param if multiple values are set
        return {
            key: self[key]
            for key in self._query_params
            if key.lower() not in EMBED_QUERY_PARAMS_KEYS
        }

    def from_dict(
        self,
        _dict: Iterable[tuple[str, str | Iterable[str]]]
        | SupportsKeysAndGetItem[str, str | Iterable[str]],
    ) -> None:
        old_value = self._query_params.copy()
        self.clear_with_no_forward_msg(preserve_embed=True)
        try:
            self.update(_dict)
        except StreamlitAPIException:
            # restore the original from before we made any changes.
            self._query_params = old_value
            raise

    def set_with_no_forward_msg(self, key: str, val: list[str] | str) -> None:
        self._query_params[key] = val

    def clear_with_no_forward_msg(self, preserve_embed: bool = False) -> None:
        self._query_params = {
            key: value
            for key, value in self._query_params.items()
            if key.lower() in EMBED_QUERY_PARAMS_KEYS and preserve_embed
        }

    def bind_widget(
        self,
        param_key: str,
        widget_id: str,
        value_type: str,
        script_hash: str,
    ) -> None:
        """Register a widget binding to a query parameter.

        If another widget was previously bound to this param_key, its binding
        is replaced. The old widget's entry in _bindings_by_widget is cleaned up
        to prevent orphaned references.

        Parameters
        ----------
        param_key : str
            The query parameter key (same as the widget's user key).
        widget_id : str
            The unique widget ID.
        value_type : str
            The WidgetState value type (e.g., "bool_value", "string_value").
        script_hash : str
            The script hash for MPA support.

        Raises
        ------
        StreamlitAPIException
            If the parameter is protected (embed, embed_options).
        """
        if param_key.lower() in PROTECTED_QUERY_PARAMS:
            raise StreamlitAPIException(
                f"Cannot bind to reserved query parameter '{param_key}'. "
                f"'{EMBED_QUERY_PARAM}' and '{EMBED_OPTIONS_QUERY_PARAM}' are "
                f"used internally for Streamlit's embed functionality."
            )

        # Clean up old binding if a different widget was bound to this param
        old_binding = self._bindings_by_param.get(param_key)
        if old_binding and old_binding.widget_id != widget_id:
            self._bindings_by_widget.pop(old_binding.widget_id, None)

        binding = WidgetBinding(
            widget_id=widget_id,
            param_key=param_key,
            value_type=value_type,
            script_hash=script_hash,
        )
        self._bindings_by_param[param_key] = binding
        self._bindings_by_widget[widget_id] = binding

    def unbind_widget(self, widget_id: str) -> None:
        """Remove a widget binding.

        Parameters
        ----------
        widget_id : str
            The unique widget ID.
        """
        binding = self._bindings_by_widget.pop(widget_id, None)
        if binding:
            self._bindings_by_param.pop(binding.param_key, None)

    def is_bound(self, param_key: str) -> bool:
        """Check if a query parameter is bound to a widget.

        Note: This check is case-sensitive, meaning "Foo" and "foo" are treated
        as different parameters. This is intentional because Python keys are
        case-sensitive and users explicitly choose their parameter names via
        the widget's `key` argument. This differs from embed parameter checks
        which are case-insensitive for URL compatibility.

        Parameters
        ----------
        param_key : str
            The query parameter key (case-sensitive).

        Returns
        -------
        bool
            True if the parameter is bound to a widget.
        """
        return param_key in self._bindings_by_param

    def get_binding_for_param(self, param_key: str) -> WidgetBinding | None:
        """Get the binding for a query parameter.

        Parameters
        ----------
        param_key : str
            The query parameter key.

        Returns
        -------
        WidgetBinding | None
            The binding if found, None otherwise.
        """
        return self._bindings_by_param.get(param_key)

    def get_binding_for_widget(self, widget_id: str) -> WidgetBinding | None:
        """Get the binding for a widget.

        Parameters
        ----------
        widget_id : str
            The unique widget ID.

        Returns
        -------
        WidgetBinding | None
            The binding if found, None otherwise.
        """
        return self._bindings_by_widget.get(widget_id)

    def remove_param(self, param_key: str) -> bool:
        """Remove a query parameter without protection checks.

        This is an internal method for use by SessionState when clearing
        invalid URL-seeded values. It bypasses the bound param protection
        since the binding system itself needs to clear these values.

        Parameters
        ----------
        param_key : str
            The query parameter key to remove.

        Returns
        -------
        bool
            True if the param was removed, False if it didn't exist.
        """
        if param_key in self._query_params:
            del self._query_params[param_key]
            self._send_query_param_msg()
            return True
        return False

    def set_initial_query_params(self, query_string: str) -> None:
        """Store the initial query params from the URL for session state seeding.

        Parameters
        ----------
        query_string : str
            The URL query string (without the leading '?').
        """
        parsed = parse.parse_qs(query_string, keep_blank_values=True)
        self._initial_query_params = parsed

    def set_initial_query_params_from_current(self) -> None:
        """Set _initial_query_params from the current filtered _query_params.

        This is called after MPA page transitions where populate_from_query_string()
        has filtered out params bound to widgets on other pages. Using this ensures
        widget seeding only uses params that are valid for the current page, preventing
        stale values from previous pages from leaking through.
        """
        # Convert _query_params to the list format used by _initial_query_params
        # (parse_qs returns dict[str, list[str]])
        self._initial_query_params = {
            k: v if isinstance(v, list) else [v] for k, v in self._query_params.items()
        }

    def get_initial_value(self, param_key: str) -> str | list[str] | None:
        """Get the initial URL value for a query parameter.

        This is used for seeding session state on initial page load.

        Parameters
        ----------
        param_key : str
            The query parameter key.

        Returns
        -------
        str | list[str] | None
            The initial value(s) if present, None otherwise.
        """
        values = self._initial_query_params.get(param_key)
        if values is None:
            return None
        if len(values) == 1:
            return values[0]
        return values

    def _set_corrected_value(self, param_key: str, value: Any, value_type: str) -> None:
        """Set a corrected value for a query parameter.

        This is called when URL auto-correction is needed (e.g., after clamping
        a value to min/max bounds). It updates both the internal query params
        and sends a forward message to update the frontend URL.

        Parameters
        ----------
        param_key : str
            The query parameter key.
        value : Any
            The corrected value to set.
        value_type : str
            The WidgetState value type (e.g., "double_value", "int_value").
        """

        def format_number(v: Any) -> str:
            """Format a number, using integer format if value is a whole number.

            Examples: 5.0 -> "5", 5.5 -> "5.5", 5 -> "5"
            Handles special float values (NaN, Inf) by returning them as-is.
            """
            # math.isfinite returns False for NaN, inf, -inf
            # which would raise ValueError/OverflowError when converting to int
            if isinstance(v, float) and math.isfinite(v) and v == int(v):
                return str(int(v))
            return str(v)

        # Convert the value to a string representation for the URL
        # All array types use repeated params: ?foo=a&foo=b
        if value_type in {
            "string_array_value",
            "int_array_value",
            "double_array_value",
        }:
            if isinstance(value, (list, tuple)):
                # Store as list for repeated params
                self._query_params[param_key] = [
                    format_number(v) if value_type == "double_array_value" else str(v)
                    for v in value
                ]
                self._send_query_param_msg()
                return
            str_value = (
                format_number(value)
                if value_type == "double_array_value"
                else str(value)
            )
        else:
            str_value = str(value)

        self._query_params[param_key] = str_value
        self._send_query_param_msg()

    def populate_from_query_string(
        self,
        query_string: str,
        valid_script_hashes: set[str] | None = None,
    ) -> None:
        """Populate query params from a URL query string.

        Clears current params and repopulates from the URL. When valid_script_hashes
        is provided (for MPA page transitions), filters out params bound to other pages.

        Parameters
        ----------
        query_string : str
            The raw query string from the URL (e.g., "foo=bar&baz=qux").
        valid_script_hashes : set[str] | None
            If provided, only keep params that are:
            - Unbound (no widget binding)
            - Bound to a widget with script_hash in this set
            Params bound to other pages are filtered out.
            If None, all params are kept (no filtering).
        """
        parsed_query_params = parse.parse_qs(query_string, keep_blank_values=True)

        self.clear_with_no_forward_msg()
        stale_widget_ids: list[str] = []

        for key, val in parsed_query_params.items():
            binding = self._bindings_by_param.get(key)
            should_keep = True

            # If filtering is enabled, check if this param should be filtered out
            if (
                valid_script_hashes is not None
                and binding is not None
                and binding.script_hash not in valid_script_hashes
            ):
                # Binding from a different page - filter it out
                stale_widget_ids.append(binding.widget_id)
                should_keep = False

            if should_keep:
                if len(val) == 0:
                    self.set_with_no_forward_msg(key, val="")
                elif len(val) == 1:
                    self.set_with_no_forward_msg(key, val=val[-1])
                else:
                    self.set_with_no_forward_msg(key, val)

        # Clean up bindings for widgets from other pages
        for widget_id in stale_widget_ids:
            self.unbind_widget(widget_id)

        # Update frontend URL if we filtered out any params
        if stale_widget_ids:
            self._send_query_param_msg()

    def remove_stale_bindings(
        self,
        active_widget_ids: set[str],
        fragment_ids_this_run: list[str] | None = None,
        widget_metadata: dict[str, Any] | None = None,
    ) -> None:
        """Remove bindings and URL params for widgets that are no longer active.

        This cleans up query params for conditional widgets that have been unmounted.
        For fragment runs, widgets outside the running fragment(s) are preserved.

        Note: Page-based cleanup for MPA navigation is handled separately via
        populate_from_query_string() which is called before the script runs.

        Parameters
        ----------
        active_widget_ids : set[str]
            Set of widget IDs that are currently active/rendered.
        fragment_ids_this_run : list[str] | None
            List of fragment IDs being run, or None for full script runs.
        widget_metadata : dict[str, Any] | None
            Widget metadata dict to check fragment IDs.
        """
        stale_widget_ids = []
        for widget_id in self._bindings_by_widget:
            if widget_id in active_widget_ids:
                # Widget is active in this run - keep it
                continue

            # For fragment runs, preserve widgets that aren't part of the running fragments
            if fragment_ids_this_run and widget_metadata:
                metadata = widget_metadata.get(widget_id)
                if metadata and metadata.fragment_id not in fragment_ids_this_run:
                    # Widget belongs to a different fragment or main script - keep it
                    continue

            stale_widget_ids.append(widget_id)

        params_removed = False
        for widget_id in stale_widget_ids:
            binding = self._bindings_by_widget.get(widget_id)
            if binding:
                param_key = binding.param_key
                # Remove the query param from the URL
                if param_key in self._query_params:
                    del self._query_params[param_key]
                    params_removed = True
            self.unbind_widget(widget_id)

        # Send forward message to update frontend URL if we removed any params
        if params_removed:
            self._send_query_param_msg()


def missing_key_error_message(key: str) -> str:
    return f'st.query_params has no key "{key}".'


def _set_item_in_dict(
    target_dict: dict[str, list[str] | str], key: str, value: str | Iterable[str]
) -> None:
    """Set an item in a dictionary."""
    if isinstance(value, dict):
        raise StreamlitQueryParamDictValueError(key)

    if key.lower() in EMBED_QUERY_PARAMS_KEYS:
        raise StreamlitAPIException(
            "Query param embed and embed_options (case-insensitive) cannot be set programmatically."
        )
    # Type checking users should handle the string serialization themselves
    # We will accept any type for the list and serialize to str just in case
    if isinstance(value, Iterable) and not isinstance(value, str):
        target_dict[key] = [str(item) for item in value]
    else:
        target_dict[key] = str(value)


def process_query_params(
    query_params: Iterable[tuple[str, str | Iterable[str]]]
    | SupportsKeysAndGetItem[str, str | Iterable[str]],
) -> str:
    """Convert query params into a URL-encoded query string."""
    processed_params: dict[str, list[str] | str] = {}

    if hasattr(query_params, "keys") and hasattr(query_params, "__getitem__"):
        query_params = cast(
            "SupportsKeysAndGetItem[str, str | Iterable[str]]", query_params
        )
        for key in query_params.keys():  # noqa: SIM118
            value = query_params[key]
            _set_item_in_dict(processed_params, key, value)
    else:
        for key, value in query_params:
            if key in processed_params:
                # If the key already exists, we need to accumulate the values.
                if isinstance(value, dict):
                    raise StreamlitQueryParamDictValueError(key)

                current_val = processed_params[key]
                if not isinstance(current_val, list):
                    current_val = [current_val]

                if isinstance(value, Iterable) and not isinstance(value, str):
                    current_val.extend([str(item) for item in value])
                else:
                    current_val.append(str(value))

                processed_params[key] = current_val
            else:
                _set_item_in_dict(processed_params, key, value)

    return parse.urlencode(processed_params, doseq=True)
