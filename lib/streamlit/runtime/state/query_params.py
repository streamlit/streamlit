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

from collections.abc import Callable, Iterable, Iterator, Mapping, MutableMapping
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Final, TypeAlias, cast
from urllib import parse

from streamlit.errors import StreamlitAPIException, StreamlitQueryParamDictValueError
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime.scriptrunner_utils.script_run_context import get_script_run_ctx

if TYPE_CHECKING:
    from _typeshed import SupportsKeysAndGetItem

QueryParamValue = str | Iterable[str]
QueryParamsInput = Mapping[str, QueryParamValue] | Iterable[tuple[str, QueryParamValue]]

# Type aliases for query param serialization functions.
# Serializer: widget value -> query param string(s)
# Deserializer: query param string(s) -> widget value
QueryParamSerializer: TypeAlias = Callable[[Any], str | list[str]]
QueryParamDeserializer: TypeAlias = Callable[[str | list[str]], Any]


EMBED_QUERY_PARAM: Final[str] = "embed"
EMBED_OPTIONS_QUERY_PARAM: Final[str] = "embed_options"
EMBED_QUERY_PARAMS_KEYS: Final[list[str]] = [
    EMBED_QUERY_PARAM,
    EMBED_OPTIONS_QUERY_PARAM,
]


@dataclass
class WidgetBinding:
    """Stores binding information for a widget bound to a query parameter.

    This includes the serializer and deserializer functions needed to convert
    between the widget's value type and URL-safe query parameter strings.
    """

    widget_id: str
    param_key: str
    serializer: QueryParamSerializer
    deserializer: QueryParamDeserializer


@dataclass
class QueryParams(MutableMapping[str, str]):
    """A lightweight wrapper of a dict that sends forwardMsgs when state changes.
    It stores str keys with str and List[str] values.

    Also manages widget-to-query-param bindings, allowing widget values to be
    automatically synchronized with URL query parameters.
    """

    _query_params: dict[str, list[str] | str] = field(default_factory=dict)

    # Maps param_key -> WidgetBinding for bound widgets
    _bindings_by_param: dict[str, WidgetBinding] = field(default_factory=dict)

    # Maps widget_id -> WidgetBinding (reverse lookup)
    _bindings_by_widget: dict[str, WidgetBinding] = field(default_factory=dict)

    # Initial query params from the URL when the session was created.
    # Used for initializing widget values from URL query parameters.
    _initial_query_params: dict[str, list[str]] = field(default_factory=dict)

    @classmethod
    def from_query_string(cls, query_string: str) -> QueryParams:
        """Create a QueryParams instance from a URL query string.

        Parameters
        ----------
        query_string : str
            The query string without leading "?" (e.g., "foo=bar&baz=123").

        Returns
        -------
        QueryParams
            A new QueryParams instance with the parsed query params.
        """
        instance = cls()
        if query_string:
            parsed = parse.parse_qs(query_string, keep_blank_values=True)
            instance._initial_query_params = parsed
            # Also set the current query params (without triggering a forward msg)
            for key, values in parsed.items():
                if len(values) == 1:
                    instance._query_params[key] = values[0]
                else:
                    instance._query_params[key] = values
        return instance

    def get_initial_value(self, param_key: str) -> str | list[str] | None:
        """Get the initial value of a query parameter from the URL.

        This returns the value that was present in the URL when the session
        started, before any modifications. Used for initializing widget values.

        Parameters
        ----------
        param_key : str
            The query parameter key to look up.

        Returns
        -------
        str | list[str] | None
            The initial value(s), or None if not present.
        """
        values = self._initial_query_params.get(param_key)
        if values is None:
            return None
        if len(values) == 1:
            return values[0]
        return values

    def update_initial_query_params(self, query_string: str) -> None:
        """Update the initial query params from a new query string.

        This is used when the host communication path sends updated query params
        (e.g., in embedded scenarios where the host controls the URL). This allows
        widgets with `?key` bindings to be initialized with host-provided values
        on subsequent script reruns.

        Parameters
        ----------
        query_string : str
            The new query string without leading "?" (e.g., "foo=bar&baz=123").
        """
        if query_string:
            self._initial_query_params = parse.parse_qs(
                query_string, keep_blank_values=True
            )
        else:
            self._initial_query_params = {}

    def __iter__(self) -> Iterator[str]:
        self._ensure_single_query_api_used()

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
        self._ensure_single_query_api_used()
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
        self._ensure_single_query_api_used()
        self._set_item_internal(key, value)
        self._send_query_param_msg()

    def _set_item_internal(self, key: str, value: str | Iterable[str]) -> None:
        _set_item_in_dict(self._query_params, key, value)

    def __delitem__(self, key: str) -> None:
        self._ensure_single_query_api_used()
        if key.lower() in EMBED_QUERY_PARAMS_KEYS:
            raise KeyError(missing_key_error_message(key))
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
        self._ensure_single_query_api_used()
        if hasattr(other, "keys") and hasattr(other, "__getitem__"):
            other = cast("SupportsKeysAndGetItem[str, str | Iterable[str]]", other)
            for key in other.keys():  # noqa: SIM118
                self._set_item_internal(key, other[key])
        else:
            for key, value in other:
                self._set_item_internal(key, value)
        for key, value in kwds.items():
            self._set_item_internal(key, value)
        self._send_query_param_msg()

    def get_all(self, key: str) -> list[str]:
        self._ensure_single_query_api_used()
        if key not in self._query_params or key.lower() in EMBED_QUERY_PARAMS_KEYS:
            return []
        value = self._query_params[key]
        return value if isinstance(value, list) else [value]

    def __len__(self) -> int:
        self._ensure_single_query_api_used()
        return len(
            {
                key
                for key in self._query_params
                if key.lower() not in EMBED_QUERY_PARAMS_KEYS
            }
        )

    def __str__(self) -> str:
        self._ensure_single_query_api_used()
        return str(self._query_params)

    def _send_query_param_msg(self) -> None:
        ctx = get_script_run_ctx()
        if ctx is None:
            return
        self._ensure_single_query_api_used()

        msg = ForwardMsg()
        msg.page_info_changed.query_string = parse.urlencode(
            self._query_params, doseq=True
        )
        ctx.query_string = msg.page_info_changed.query_string
        ctx.enqueue(msg)

    def clear(self) -> None:
        self._ensure_single_query_api_used()
        self.clear_with_no_forward_msg(preserve_embed=True)
        self._send_query_param_msg()

    def to_dict(self) -> dict[str, str]:
        self._ensure_single_query_api_used()
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
        self._ensure_single_query_api_used()
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

    def _ensure_single_query_api_used(self) -> None:
        ctx = get_script_run_ctx()
        if ctx is None:
            return
        ctx.mark_production_query_params_used()

    # Widget binding methods

    def bind_widget(
        self,
        param_key: str,
        widget_id: str,
        serializer: QueryParamSerializer,
        deserializer: QueryParamDeserializer,
    ) -> None:
        """Bind a widget to a query parameter with serialization functions.

        When a widget is bound, its value will be synchronized with the
        query parameter of the given key. The serializer converts widget
        values to URL strings, and the deserializer converts URL strings
        back to widget values.

        Parameters
        ----------
        param_key : str
            The query parameter key to bind to.
        widget_id : str
            The widget ID to bind.
        serializer : QueryParamSerializer
            Function to convert widget value to query param string(s).
        deserializer : QueryParamDeserializer
            Function to convert query param string(s) to widget value.
        """
        if param_key.lower() in EMBED_QUERY_PARAMS_KEYS:
            # Silently ignore attempts to bind to embed params
            return

        # Remove any existing binding for this widget
        self.unbind_widget(widget_id)

        binding = WidgetBinding(
            widget_id=widget_id,
            param_key=param_key,
            serializer=serializer,
            deserializer=deserializer,
        )
        self._bindings_by_param[param_key] = binding
        self._bindings_by_widget[widget_id] = binding

    def unbind_widget(self, widget_id: str) -> None:
        """Remove the binding for a widget.

        Parameters
        ----------
        widget_id : str
            The widget ID to unbind.
        """
        if widget_id in self._bindings_by_widget:
            binding = self._bindings_by_widget[widget_id]
            del self._bindings_by_widget[widget_id]
            if binding.param_key in self._bindings_by_param:
                del self._bindings_by_param[binding.param_key]

    def get_binding(self, widget_id: str) -> WidgetBinding | None:
        """Get the binding for a widget.

        Parameters
        ----------
        widget_id : str
            The widget ID.

        Returns
        -------
        WidgetBinding or None
            The binding, or None if no binding exists.
        """
        return self._bindings_by_widget.get(widget_id)

    def get_binding_by_param(self, param_key: str) -> WidgetBinding | None:
        """Get the binding for a query parameter.

        Parameters
        ----------
        param_key : str
            The query parameter key.

        Returns
        -------
        WidgetBinding or None
            The binding, or None if no binding exists.
        """
        return self._bindings_by_param.get(param_key)

    def is_widget_bound(self, widget_id: str) -> bool:
        """Check if a widget is bound to a query parameter.

        Parameters
        ----------
        widget_id : str
            The widget ID.

        Returns
        -------
        bool
            True if the widget is bound, False otherwise.
        """
        return widget_id in self._bindings_by_widget

    def get_bound_value_raw(self, widget_id: str) -> str | list[str] | None:
        """Get the raw query parameter value for a bound widget.

        This returns the raw string value(s) from the URL, without
        deserialization.

        Parameters
        ----------
        widget_id : str
            The widget ID.

        Returns
        -------
        str, list[str], or None
            The raw query parameter value, or None if not bound or no value.
        """
        binding = self._bindings_by_widget.get(widget_id)
        if binding is None:
            return None

        return self._query_params.get(binding.param_key)

    def get_bound_value(self, widget_id: str) -> Any:
        """Get the deserialized query parameter value for a bound widget.

        Uses the widget's deserializer to convert the URL string to
        the appropriate widget value type.

        Parameters
        ----------
        widget_id : str
            The widget ID.

        Returns
        -------
        Any
            The deserialized widget value, or None if not bound or no value.
        """
        binding = self._bindings_by_widget.get(widget_id)
        if binding is None:
            return None

        raw_value = self._query_params.get(binding.param_key)
        if raw_value is None:
            return None

        return binding.deserializer(raw_value)

    def set_from_widget_value(
        self,
        widget_id: str,
        value: Any,
        send_msg: bool = True,
    ) -> None:
        """Set a query parameter from a widget's value.

        Uses the widget's serializer to convert the value to a URL string,
        then updates the query parameter.

        Parameters
        ----------
        widget_id : str
            The widget ID.
        value : Any
            The widget value to serialize and set.
        send_msg : bool
            Whether to send a ForwardMsg to update the browser URL.
        """
        binding = self._bindings_by_widget.get(widget_id)
        if binding is None:
            return

        if binding.param_key.lower() in EMBED_QUERY_PARAMS_KEYS:
            return

        # Serialize the widget value to a query param string
        serialized = binding.serializer(value)
        self._query_params[binding.param_key] = serialized

        if send_msg:
            self._send_query_param_msg()

    def has_value_for_widget(self, widget_id: str) -> bool:
        """Check if a query parameter value exists for a bound widget.

        Parameters
        ----------
        widget_id : str
            The widget ID.

        Returns
        -------
        bool
            True if a value exists, False otherwise.
        """
        binding = self._bindings_by_widget.get(widget_id)
        if binding is None:
            return False

        return binding.param_key in self._query_params

    def clear_bindings(self) -> None:
        """Clear all widget bindings."""
        self._bindings_by_param.clear()
        self._bindings_by_widget.clear()

    def remove_stale_bindings(self, active_widget_ids: set[str]) -> None:
        """Remove bindings for widgets that are no longer active.

        Parameters
        ----------
        active_widget_ids : set[str]
            The set of currently active widget IDs.
        """
        stale_widget_ids = [
            wid for wid in self._bindings_by_widget if wid not in active_widget_ids
        ]
        for widget_id in stale_widget_ids:
            self.unbind_widget(widget_id)


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
