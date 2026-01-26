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

import json
import pickle  # noqa: S403
from collections.abc import Iterator, KeysView, Mapping, MutableMapping, Sequence
from copy import deepcopy
from dataclasses import dataclass, field, replace
from typing import (
    TYPE_CHECKING,
    Any,
    Final,
    TypeAlias,
    cast,
)

from streamlit import config, util
from streamlit.delta_generator_singletons import get_dg_singleton_instance
from streamlit.errors import StreamlitAPIException, UnserializableSessionStateError
from streamlit.logger import get_logger
from streamlit.proto.WidgetStates_pb2 import WidgetState as WidgetStateProto
from streamlit.proto.WidgetStates_pb2 import WidgetStates as WidgetStatesProto
from streamlit.runtime.scriptrunner_utils.script_run_context import get_script_run_ctx
from streamlit.runtime.state.common import (
    RegisterWidgetResult,
    T,
    ValueFieldName,
    WidgetArgs,
    WidgetCallback,
    WidgetMetadata,
    is_array_value_field_name,
    is_element_id,
    is_keyed_element_id,
)
from streamlit.runtime.state.presentation import apply_presenter
from streamlit.runtime.state.query_params import QueryParams, parse_url_param
from streamlit.runtime.stats import (
    CACHE_MEMORY_FAMILY,
    CacheStat,
    StatsProvider,
    group_cache_stats,
)

_LOGGER: Final = get_logger(__name__)

if TYPE_CHECKING:
    from streamlit.runtime.session_manager import SessionManager


STREAMLIT_INTERNAL_KEY_PREFIX: Final = "$$STREAMLIT_INTERNAL_KEY"
SCRIPT_RUN_WITHOUT_ERRORS_KEY: Final = (
    f"{STREAMLIT_INTERNAL_KEY_PREFIX}_SCRIPT_RUN_WITHOUT_ERRORS"
)


@dataclass(frozen=True)
class Serialized:
    """A widget value that's serialized to a protobuf. Immutable."""

    value: WidgetStateProto


@dataclass(frozen=True)
class Value:
    """A widget value that's not serialized. Immutable."""

    value: Any


WState: TypeAlias = Value | Serialized


@dataclass
class WStates(MutableMapping[str, Any]):
    """A mapping of widget IDs to values. Widget values can be stored in
    serialized or deserialized form, but when values are retrieved from the
    mapping, they'll always be deserialized.
    """

    states: dict[str, WState] = field(default_factory=dict)
    widget_metadata: dict[str, WidgetMetadata[Any]] = field(default_factory=dict)

    def __repr__(self) -> str:
        return util.repr_(self)

    def __getitem__(self, k: str) -> Any:
        """Return the value of the widget with the given key.
        If the widget's value is currently stored in serialized form, it
        will be deserialized first.
        """
        wstate = self.states.get(k)
        if wstate is None:
            raise KeyError(k)

        if isinstance(wstate, Value):
            # The widget's value is already deserialized - return it directly.
            return wstate.value

        # The widget's value is serialized. We deserialize it, and return
        # the deserialized value.

        metadata = self.widget_metadata.get(k)
        if metadata is None:
            # No deserializer, which should only happen if state is
            # gotten from a reconnecting browser and the script is
            # trying to access it. Pretend it doesn't exist.
            raise KeyError(k)
        value_field_name = cast(
            "ValueFieldName",
            wstate.value.WhichOneof("value"),
        )
        value = (
            wstate.value.__getattribute__(value_field_name)
            if value_field_name  # Field name is None if the widget value was cleared
            else None
        )

        if is_array_value_field_name(value_field_name):
            # Array types are messages with data in a `data` field
            value = cast("Any", value).data
        elif value_field_name == "json_value":
            value = json.loads(cast("str", value))

        deserialized = metadata.deserializer(value)

        # Update metadata to reflect information from WidgetState proto
        self.set_widget_metadata(
            replace(
                metadata,
                value_type=value_field_name,
            )
        )

        self.states[k] = Value(deserialized)
        return deserialized

    def __setitem__(self, k: str, v: WState) -> None:
        self.states[k] = v

    def __delitem__(self, k: str) -> None:
        del self.states[k]

    def __len__(self) -> int:
        return len(self.states)

    def __iter__(self) -> Iterator[str]:
        # For this and many other methods, we can't simply delegate to the
        # states field, because we need to invoke `__getitem__` for any
        # values, to handle deserialization and unwrapping of values.
        yield from self.states

    def keys(self) -> KeysView[str]:
        return KeysView(self.states)

    def items(self) -> set[tuple[str, Any]]:  # type: ignore[override]
        return {(k, self[k]) for k in self}

    def values(self) -> set[Any]:  # type: ignore[override]
        return {self[wid] for wid in self}

    def update(self, other: WStates) -> None:  # type: ignore[override]
        """Copy all widget values and metadata from 'other' into this mapping,
        overwriting any data in this mapping that's also present in 'other'.
        """
        self.states.update(other.states)
        self.widget_metadata.update(other.widget_metadata)

    def set_widget_from_proto(self, widget_state: WidgetStateProto) -> None:
        """Set a widget's serialized value, overwriting any existing value it has."""
        self[widget_state.id] = Serialized(widget_state)

    def set_from_value(self, k: str, v: Any) -> None:
        """Set a widget's deserialized value, overwriting any existing value it has."""
        self[k] = Value(v)

    def set_widget_metadata(self, widget_meta: WidgetMetadata[Any]) -> None:
        """Set a widget's metadata, overwriting any existing metadata it has."""
        self.widget_metadata[widget_meta.id] = widget_meta

    def remove_stale_widgets(
        self,
        active_widget_ids: set[str],
        fragment_ids_this_run: list[str] | None,
    ) -> None:
        """Remove widget state for stale widgets."""
        self.states = {
            k: v
            for k, v in self.states.items()
            if not _is_stale_widget(
                self.widget_metadata.get(k),
                active_widget_ids,
                fragment_ids_this_run,
            )
        }

    def get_serialized(self, k: str) -> WidgetStateProto | None:
        """Get the serialized value of the widget with the given id.

        If the widget doesn't exist, return None. If the widget exists but
        is not in serialized form, it will be serialized first.
        """

        item = self.states.get(k)
        if item is None:
            # No such widget: return None.
            return None

        if isinstance(item, Serialized):
            # Widget value is serialized: return it directly.
            return item.value

        # Widget value is not serialized: serialize it first!
        metadata = self.widget_metadata.get(k)
        if metadata is None:
            # We're missing the widget's metadata. (Can this happen?)
            return None

        widget = WidgetStateProto()
        widget.id = k

        field = metadata.value_type
        serialized = metadata.serializer(item.value)

        if is_array_value_field_name(field):
            arr = getattr(widget, field)
            arr.data.extend(serialized)
        elif field in {"json_value", "json_trigger_value"}:
            setattr(widget, field, json.dumps(serialized))
        elif field == "file_uploader_state_value":
            widget.file_uploader_state_value.CopyFrom(serialized)
        elif field == "string_trigger_value":
            widget.string_trigger_value.CopyFrom(serialized)
        elif field == "chat_input_value":
            widget.chat_input_value.CopyFrom(serialized)
        elif field is not None and serialized is not None:
            # If the field is None, the widget value was cleared
            # by the user and therefore is None. But we cannot
            # set it to None here, since the proto properties are
            # not nullable. So we just don't set it.
            setattr(widget, field, serialized)

        return widget

    def as_widget_states(self) -> list[WidgetStateProto]:
        """Return a list of serialized widget values for each widget with a value."""
        states = [
            self.get_serialized(widget_id)
            for widget_id in self.states
            if self.get_serialized(widget_id)
        ]
        return cast("list[WidgetStateProto]", states)

    def call_callback(self, widget_id: str) -> None:
        """Call the given widget's callback and return the callback's
        return value. If the widget has no callback, return None.

        If the widget doesn't exist, raise an Exception.
        """
        metadata = self.widget_metadata.get(widget_id)

        if metadata is None:
            raise RuntimeError(f"Widget {widget_id} not found.")

        callback = metadata.callback
        if callback is None:
            return

        args = metadata.callback_args or ()
        kwargs = metadata.callback_kwargs or {}

        ctx = get_script_run_ctx()
        if ctx and metadata.fragment_id is not None:
            ctx.in_fragment_callback = True
            callback(*args, **kwargs)
            ctx.in_fragment_callback = False
        else:
            callback(*args, **kwargs)


def _missing_key_error_message(key: str) -> str:
    return (
        f'st.session_state has no key "{key}". Did you forget to initialize it? '
        f"More info: https://docs.streamlit.io/develop/concepts/architecture/session-state#initialization"
    )


@dataclass
class KeyIdMapper:
    """A mapping of user-provided keys to element IDs.
    It also maps element IDs to user-provided keys so that this reverse mapping
    does not have to be computed ad-hoc.
    All built-in dict-operations such as setting and deleting expect the key as the
    argument, not the element ID.
    """

    _key_id_mapping: dict[str, str] = field(default_factory=dict)
    _id_key_mapping: dict[str, str] = field(default_factory=dict)

    def __contains__(self, key: str) -> bool:
        return key in self._key_id_mapping

    def __setitem__(self, key: str, widget_id: Any) -> None:
        self._key_id_mapping[key] = widget_id
        self._id_key_mapping[widget_id] = key

    def __delitem__(self, key: str) -> None:
        self.delete(key)

    @property
    def id_key_mapping(self) -> dict[str, str]:
        return self._id_key_mapping

    def set_key_id_mapping(self, key_id_mapping: dict[str, str]) -> None:
        self._key_id_mapping = key_id_mapping
        self._id_key_mapping = {v: k for k, v in key_id_mapping.items()}

    def get_id_from_key(self, key: str, default: str | None = None) -> str | None:
        return self._key_id_mapping.get(key, default)

    def get_key_from_id(self, widget_id: str) -> str:
        return self._id_key_mapping[widget_id]

    def update(self, other: KeyIdMapper) -> None:
        self._key_id_mapping.update(other._key_id_mapping)
        self._id_key_mapping.update(other._id_key_mapping)

    def clear(self) -> None:
        self._key_id_mapping.clear()
        self._id_key_mapping.clear()

    def delete(self, key: str) -> None:
        widget_id = self._key_id_mapping[key]
        del self._key_id_mapping[key]
        del self._id_key_mapping[widget_id]


@dataclass
class SessionState:
    """SessionState allows users to store values that persist between app
    reruns.

    Example
    -------
    >>> if "num_script_runs" not in st.session_state:
    ...     st.session_state.num_script_runs = 0
    >>> st.session_state.num_script_runs += 1
    >>> st.write(st.session_state.num_script_runs)  # writes 1

    The next time your script runs, the value of
    st.session_state.num_script_runs will be preserved.
    >>> st.session_state.num_script_runs += 1
    >>> st.write(st.session_state.num_script_runs)  # writes 2
    """

    # All the values from previous script runs, squished together to save memory
    _old_state: dict[str, Any] = field(default_factory=dict)

    # Values set in session state during the current script run, possibly for
    # setting a widget's value. Keyed by a user provided string.
    _new_session_state: dict[str, Any] = field(default_factory=dict)

    # Widget values from the frontend, usually one changing prompted the script rerun
    _new_widget_state: WStates = field(default_factory=WStates)

    # Keys used for widgets will be eagerly converted to the matching element id
    _key_id_mapper: KeyIdMapper = field(default_factory=KeyIdMapper)

    # query params are stored in session state because query params will be tied with
    # widget state at one point.
    query_params: QueryParams = field(default_factory=QueryParams)

    def __repr__(self) -> str:
        return util.repr_(self)

    # is it possible for a value to get through this without being deserialized?
    def _compact_state(self) -> None:
        """Copy all current session_state and widget_state values into our
        _old_state dict, and then clear our current session_state and
        widget_state.
        """
        for key_or_wid in self:
            try:
                self._old_state[key_or_wid] = self[key_or_wid]
            except KeyError:  # noqa: PERF203
                # handle key errors from widget state not having metadata gracefully
                # https://github.com/streamlit/streamlit/issues/7206
                pass
        self._new_session_state.clear()
        self._new_widget_state.clear()

    def clear(self) -> None:
        """Reset self completely, clearing all current and old values."""
        self._old_state.clear()
        self._new_session_state.clear()
        self._new_widget_state.clear()
        self._key_id_mapper.clear()

    @property
    def filtered_state(self) -> dict[str, Any]:
        """The combined session and widget state, excluding keyless widgets and internal widgets."""

        wid_key_map = self._key_id_mapper.id_key_mapping

        state: dict[str, Any] = {}

        # We can't write `for k, v in self.items()` here because doing so will
        # run into a `KeyError` if widget metadata has been cleared (which
        # happens when the streamlit server restarted or the cache was cleared),
        # then we receive a widget's state from a browser.
        for k in self._keys():
            if not is_element_id(k) and not _is_internal_key(k):
                state[k] = self[k]
            elif is_keyed_element_id(k) and not _is_internal_key(k):
                try:
                    key = wid_key_map[k]
                    # Value returned by __getitem__ is already presented.
                    state[key] = self[k]
                except KeyError:
                    # Widget id no longer maps to a key, it is a not yet
                    # cleared value in old state for a reset widget
                    pass

        return state

    def _keys(self) -> set[str]:
        """All keys active in Session State, with widget keys converted
        to widget ids when one is known. (This includes autogenerated keys
        for widgets that don't have user_keys defined, and which aren't
        exposed to user code).
        """
        old_keys = {self._get_widget_id(k) for k in self._old_state}
        new_widget_keys = set(self._new_widget_state.keys())
        new_session_state_keys = {
            self._get_widget_id(k) for k in self._new_session_state
        }
        return old_keys | new_widget_keys | new_session_state_keys

    def is_new_state_value(self, user_key: str) -> bool:
        """True if a value with the given key is in the current session state."""
        return user_key in self._new_session_state

    def reset_state_value(self, user_key: str, value: Any | None) -> None:
        """Reset a new session state value to a given value
        without triggering the "state value cannot be modified" error.
        """
        self._new_session_state[user_key] = value

    def __iter__(self) -> Iterator[Any]:
        """Return an iterator over the keys of the SessionState.
        This is a shortcut for `iter(self.keys())`.
        """
        return iter(self._keys())

    def __len__(self) -> int:
        """Return the number of items in SessionState."""
        return len(self._keys())

    def __getitem__(self, key: str) -> Any:
        wid_key_map = self._key_id_mapper.id_key_mapping
        widget_id = self._get_widget_id(key)

        if widget_id in wid_key_map and widget_id == key:
            # the "key" is a raw widget id, so get its associated user key for lookup
            key = wid_key_map[widget_id]
        try:
            base_value = self._getitem(widget_id, key)
            return (
                apply_presenter(self, widget_id, base_value)
                if widget_id is not None
                else base_value
            )
        except KeyError:
            raise KeyError(_missing_key_error_message(key))

    def _getitem(self, widget_id: str | None, user_key: str | None) -> Any:
        """Get the value of an entry in Session State, using either the
        user-provided key or a widget id as appropriate for the internal dict
        being accessed.

        At least one of the arguments must have a value.
        """
        if user_key is None and widget_id is None:
            raise ValueError(
                "user_key and widget_id cannot both be None. This should never happen."
            )

        if user_key is not None:
            try:
                return self._new_session_state[user_key]
            except KeyError:
                pass

        if widget_id is not None:
            try:
                return self._new_widget_state[widget_id]
            except KeyError:
                pass

        # Typically, there won't be both a widget id and an associated state key in
        # old state at the same time, so the order we check is arbitrary.
        # The exception is if session state is set and then a later run has
        # a widget created, so the widget id entry should be newer.
        # The opposite case shouldn't happen, because setting the value of a widget
        # through session state will result in the next widget state reflecting that
        # value.
        if widget_id is not None:
            try:
                return self._old_state[widget_id]
            except KeyError:
                pass

        if user_key is not None:
            try:
                return self._old_state[user_key]
            except KeyError:
                pass

        # We'll never get here
        raise KeyError

    def __setitem__(self, user_key: str, value: Any) -> None:
        """Set the value of the session_state entry with the given user_key.

        If the key corresponds to a widget or form that's been instantiated
        during the current script run, raise a StreamlitAPIException instead.
        """
        ctx = get_script_run_ctx()

        if ctx is not None:
            widget_id = self._key_id_mapper.get_id_from_key(user_key, None)
            widget_ids = ctx.widget_ids_this_run
            form_ids = ctx.form_ids_this_run

            if widget_id in widget_ids or user_key in form_ids:
                raise StreamlitAPIException(
                    f"`st.session_state.{user_key}` cannot be modified after the widget"
                    f" with key `{user_key}` is instantiated."
                )

        self._new_session_state[user_key] = value

    def __delitem__(self, key: str) -> None:
        widget_id = self._get_widget_id(key)

        if not (key in self or widget_id in self):
            raise KeyError(_missing_key_error_message(key))

        if key in self._new_session_state:
            del self._new_session_state[key]

        if key in self._old_state:
            del self._old_state[key]

        if key in self._key_id_mapper:
            self._key_id_mapper.delete(key)

        if widget_id in self._new_widget_state:
            del self._new_widget_state[widget_id]

        if widget_id in self._old_state:
            del self._old_state[widget_id]

    def set_widgets_from_proto(self, widget_states: WidgetStatesProto) -> None:
        """Set the value of all widgets represented in the given WidgetStatesProto."""
        for state in widget_states.widgets:
            self._new_widget_state.set_widget_from_proto(state)

    def on_script_will_rerun(self, latest_widget_states: WidgetStatesProto) -> None:
        """Called by ScriptRunner before its script re-runs.

        Update widget data and call callbacks on widgets whose value changed
        between the previous and current script runs.
        """
        # Clear any triggers that weren't reset because the script was disconnected
        self._reset_triggers()
        self._compact_state()
        self.set_widgets_from_proto(latest_widget_states)
        self._call_callbacks()

    def _call_callbacks(self) -> None:
        """Call callbacks for widgets whose value changed or whose trigger fired."""
        from streamlit.runtime.scriptrunner import RerunException

        # Path 1: single callback.
        changed_widget_ids_for_single_callback = [
            wid
            for wid in self._new_widget_state
            if self._widget_changed(wid)
            and (metadata := self._new_widget_state.widget_metadata.get(wid))
            is not None
            and metadata.callback is not None
        ]

        for wid in changed_widget_ids_for_single_callback:
            try:
                self._new_widget_state.call_callback(wid)
            except RerunException:  # noqa: PERF203
                get_dg_singleton_instance().main_dg.warning(
                    "Calling st.rerun() within a callback is a no-op."
                )

        # Path 2: multiple callbacks.
        widget_ids_to_process = list(self._new_widget_state.states.keys())

        for wid in widget_ids_to_process:
            metadata = self._new_widget_state.widget_metadata.get(wid)
            if not metadata or metadata.callbacks is None:
                continue

            args = metadata.callback_args or ()
            kwargs = metadata.callback_kwargs or {}

            # 1) Trigger dispatch: bool + JSON trigger aggregator
            self._dispatch_trigger_callbacks(wid, metadata, args, kwargs)

            # 2) JSON value change dispatch
            if metadata.value_type == "json_value":
                self._dispatch_json_change_callbacks(wid, metadata, args, kwargs)

    def _execute_widget_callback(
        self,
        callback_fn: WidgetCallback,
        cb_metadata: WidgetMetadata[Any],
        cb_args: WidgetArgs,
        cb_kwargs: dict[str, Any],
    ) -> None:
        """Execute a widget callback with fragment-aware context.

        If the widget belongs to a fragment, temporarily marks the current
        script context as being inside a fragment callback to adapt rerun
        semantics. Attempts to call ``st.rerun()`` inside a widget callback are
        converted to a user-visible warning and treated as a no-op.

        Parameters
        ----------
        callback_fn : WidgetCallback
            The user-provided callback to execute.
        cb_metadata : WidgetMetadata[Any]
            Metadata of the widget associated with the callback.
        cb_args : WidgetArgs
            Positional arguments passed to the callback.
        cb_kwargs : dict[str, Any]
            Keyword arguments passed to the callback.
        """
        from streamlit.runtime.scriptrunner import RerunException

        ctx = get_script_run_ctx()
        if ctx and cb_metadata.fragment_id is not None:
            ctx.in_fragment_callback = True
            try:
                callback_fn(*cb_args, **cb_kwargs)
            except RerunException:
                get_dg_singleton_instance().main_dg.warning(
                    "Calling st.rerun() within a callback is a no-op."
                )
            finally:
                ctx.in_fragment_callback = False
        else:
            try:
                callback_fn(*cb_args, **cb_kwargs)
            except RerunException:
                get_dg_singleton_instance().main_dg.warning(
                    "Calling st.rerun() within a callback is a no-op."
                )

    def _dispatch_trigger_callbacks(
        self,
        wid: str,
        metadata: WidgetMetadata[Any],
        args: WidgetArgs,
        kwargs: dict[str, Any],
    ) -> None:
        """Dispatch trigger-style callbacks for a widget.

        Handles the JSON trigger aggregator. The JSON payload may be a single
        event dict or a list of event dicts; each event must contain an
        ``"event"`` field that maps to the corresponding callback name in
        ``metadata.callbacks``.

        Examples
        --------
        A component with a "submit" callback:

        >>> metadata.callbacks = {"submit": on_submit}

        The frontend can send a single event payload:

        >>> {"event": "submit", "value": "payload"}

        Or a list of event payloads to be processed in order:

        >>> [{"event": "edit", ...}, {"event": "submit", ...}]

        Parameters
        ----------
        wid : str
            The widget ID.
        metadata : WidgetMetadata[Any]
            Metadata for the widget, including registered callbacks.
        args : WidgetArgs
            Positional arguments forwarded to the callback.
        kwargs : dict[str, Any]
            Keyword arguments forwarded to the callback.
        """
        widget_proto_state = self._new_widget_state.get_serialized(wid)
        if not widget_proto_state:
            return

        # JSON trigger aggregator: value is deserialized by metadata.deserializer
        if widget_proto_state.json_trigger_value:
            try:
                deserialized = self._new_widget_state[wid]
            except KeyError:
                deserialized = None

            payloads: list[object]
            if isinstance(deserialized, list):
                payloads = deserialized
            else:
                payloads = [deserialized]

            for payload in payloads:
                if isinstance(payload, dict):
                    event_name = cast("Mapping[str, object]", payload).get("event")
                    if isinstance(event_name, str) and metadata.callbacks:
                        cb = metadata.callbacks.get(event_name)
                        if cb is not None:
                            self._execute_widget_callback(cb, metadata, args, kwargs)

    def _dispatch_json_change_callbacks(
        self,
        wid: str,
        metadata: WidgetMetadata[Any],
        args: WidgetArgs,
        kwargs: dict[str, Any],
    ) -> None:
        """Dispatch change callbacks for JSON-valued widgets.

        Computes a shallow diff between the new and old JSON maps and invokes
        callbacks for keys that changed or were added/removed.

        Parameters
        ----------
        wid : str
            The widget ID.
        metadata : WidgetMetadata[Any]
            Metadata for the widget, including registered callbacks.
        args : WidgetArgs
            Positional arguments forwarded to the callback.
        kwargs : dict[str, Any]
            Keyword arguments forwarded to the callback.
        """
        if not metadata.callbacks:
            return

        try:
            new_val = self._new_widget_state.get(wid)
        except KeyError:
            new_val = None
        old_val = self._old_state.get(wid)

        def unwrap(obj: object) -> dict[str, object]:
            if not isinstance(obj, dict):
                return {}

            obj = cast("dict[str, Any]", obj)
            if set(obj.keys()) == {"value"}:
                value = obj.get("value")
                if isinstance(value, dict):
                    return dict(value)  # shallow copy

            return dict(obj)

        new_map = unwrap(new_val)
        old_map = unwrap(old_val)

        if new_map or old_map:
            all_keys = new_map.keys() | old_map.keys()
            changed_keys = {k for k in all_keys if old_map.get(k) != new_map.get(k)}

            for key in changed_keys:
                cb = metadata.callbacks.get(key)
                if cb is not None:
                    self._execute_widget_callback(cb, metadata, args, kwargs)

    def _widget_changed(self, widget_id: str) -> bool:
        """True if the given widget's value changed between the previous
        script run and the current script run.
        """
        new_value = self._new_widget_state.get(widget_id)
        old_value = self._old_state.get(widget_id)
        changed: bool = new_value != old_value
        return changed

    def on_script_finished(self, widget_ids_this_run: set[str]) -> None:
        """Called by ScriptRunner after its script finishes running.
         Updates widgets to prepare for the next script run.

        Parameters
        ----------
        widget_ids_this_run: set[str]
            The IDs of the widgets that were accessed during the script
            run. Any widget state whose ID does *not* appear in this set
            is considered "stale" and will be removed.
        """
        self._reset_triggers()
        self._remove_stale_widgets(widget_ids_this_run)

    def _reset_triggers(self) -> None:
        """Set all trigger values in our state dictionary to False."""
        for state_id in self._new_widget_state:
            metadata = self._new_widget_state.widget_metadata.get(state_id)
            if metadata is not None:
                if metadata.value_type == "trigger_value":
                    self._new_widget_state[state_id] = Value(False)
                elif metadata.value_type in {
                    "string_trigger_value",
                    "chat_input_value",
                    "json_trigger_value",
                }:
                    self._new_widget_state[state_id] = Value(None)

        for state_id in self._old_state:
            metadata = self._new_widget_state.widget_metadata.get(state_id)
            if metadata is not None:
                if metadata.value_type == "trigger_value":
                    self._old_state[state_id] = False
                elif metadata.value_type in {
                    "string_trigger_value",
                    "chat_input_value",
                    "json_trigger_value",
                }:
                    self._old_state[state_id] = None

    def _remove_stale_widgets(self, active_widget_ids: set[str]) -> None:
        """Remove widget state for widgets whose ids aren't in `active_widget_ids`."""
        ctx = get_script_run_ctx()
        if ctx is None:
            return

        self._new_widget_state.remove_stale_widgets(
            active_widget_ids,
            ctx.fragment_ids_this_run,
        )

        # Remove entries from _old_state corresponding to
        # widgets not in widget_ids.
        self._old_state = {
            k: v
            for k, v in self._old_state.items()
            if (
                not is_element_id(k)
                or not _is_stale_widget(
                    self._new_widget_state.widget_metadata.get(k),
                    active_widget_ids,
                    ctx.fragment_ids_this_run,
                )
            )
        }

        # Remove query param bindings and URL params for stale widgets.
        # For fragment runs, preserve widgets outside the running fragment(s).
        # Note: For MPA page transitions, query param filtering is performed
        # via populate_from_query_string() in script_runner.py before this cleanup,
        # so bindings for non-active pages are already filtered by script hash.
        self.query_params.remove_stale_bindings(
            active_widget_ids,
            ctx.fragment_ids_this_run,
            self._new_widget_state.widget_metadata,
        )

    def _get_widget_metadata(self, widget_id: str) -> WidgetMetadata[Any] | None:
        """Return the metadata for a widget id from the current widget state."""
        return self._new_widget_state.widget_metadata.get(widget_id)

    def _set_widget_metadata(self, widget_metadata: WidgetMetadata[Any]) -> None:
        """Set a widget's metadata."""
        widget_id = widget_metadata.id
        self._new_widget_state.widget_metadata[widget_id] = widget_metadata

    def get_widget_states(self) -> list[WidgetStateProto]:
        """Return a list of serialized widget values for each widget with a value."""
        return self._new_widget_state.as_widget_states()

    def _get_widget_id(self, k: str) -> str:
        """Turns a value that might be a widget id or a user provided key into
        an appropriate widget id.
        """
        # It's guaranteed that the key is a string since the default is string,
        # so we can cast it to str here:
        return cast("str", self._key_id_mapper.get_id_from_key(k, k))

    def _set_key_widget_mapping(self, widget_id: str, user_key: str) -> None:
        self._key_id_mapper[user_key] = widget_id

    def register_widget(
        self, metadata: WidgetMetadata[T], user_key: str | None
    ) -> RegisterWidgetResult[T]:
        """Register a widget with the SessionState.

        Returns
        -------
        RegisterWidgetResult[T]
            Contains the widget's current value, and a bool that will be True
            if the frontend needs to be updated with the current value.
        """
        widget_id = metadata.id

        self._set_widget_metadata(metadata)
        if user_key is not None:
            # If the widget has a user_key, update its user_key:widget_id mapping
            self._set_key_widget_mapping(widget_id, user_key)

        # Handle query param binding
        url_value_seeded = False
        if metadata.bind == "query-params" and user_key is not None:
            url_value_seeded = self._handle_query_param_binding(
                metadata, user_key, widget_id
            )

        if (
            widget_id not in self
            and (user_key is None or user_key not in self)
            and not url_value_seeded
        ):
            # This is the first time the widget is registered, so we save its
            # value in widget state (unless we already seeded from URL).
            deserializer = metadata.deserializer
            initial_widget_value = deepcopy(deserializer(None))
            self._new_widget_state.set_from_value(widget_id, initial_widget_value)

        # Get the current value of the widget for use as its return value.
        # We return a copy, so that reference types can't be accidentally
        # mutated by user code.
        widget_value = cast("T", self[widget_id])
        widget_value = deepcopy(widget_value)

        # widget_value_changed indicates to the caller that the widget's
        # current value is different from what is in the frontend.
        widget_value_changed = user_key is not None and self.is_new_state_value(
            user_key
        )

        return RegisterWidgetResult(widget_value, widget_value_changed)

    def _handle_query_param_binding(
        self, metadata: WidgetMetadata[T], user_key: str, widget_id: str
    ) -> bool:
        """Handle query param binding for a widget.

        Registers the binding, then attempts to seed the widget's value from URL
        based on priority rules:

        - On initial load, URL wins (enables shareable URLs)
        - On subsequent reruns, session_state values win
        - User interaction (frontend value) always wins

        Returns True if the widget's value was seeded from URL, False otherwise.
        """
        # Register the widget binding
        ctx = get_script_run_ctx()
        script_hash = ctx.active_script_hash if ctx is not None else ""
        self.query_params.bind_widget(
            param_key=user_key,
            widget_id=widget_id,
            value_type=metadata.value_type,
            script_hash=script_hash,
        )

        # Check priority rules - skip seeding if user/code has already set a value
        if widget_id in self._new_widget_state:  # User interacted with widget
            return False
        is_initial_load = widget_id not in self._old_state
        if not is_initial_load and user_key in self._new_session_state:
            return False  # Code set value after first run

        url_value = self.query_params.get_initial_value(user_key)
        if url_value is None:
            return False

        return self._seed_widget_from_url(metadata, user_key, widget_id, url_value)

    def _seed_widget_from_url(
        self,
        metadata: WidgetMetadata[T],
        user_key: str,
        widget_id: str,
        url_value: str | list[str],
    ) -> bool:
        """Parse URL value, seed widget state, and auto-correct URL if needed.

        This method:
        1. Parses the raw URL string using the widget's value_type
        2. Deserializes to the widget's native value format
        3. Handles invalid values (clears URL param, returns False)
        4. Stores valid values in both widget state and session state
        5. Auto-corrects the URL if the value was clamped/filtered

        Returns True if seeding succeeded, False if the URL value was invalid.
        """
        try:
            parsed_value = parse_url_param(url_value, metadata.value_type)
            deserialized_value = metadata.deserializer(parsed_value)

            # Handle case where all URL values were invalid (filtered to empty list)
            if isinstance(deserialized_value, list) and len(deserialized_value) == 0:
                url_had_values = (
                    isinstance(parsed_value, list) and len(parsed_value) > 0
                ) or (isinstance(parsed_value, str) and len(parsed_value) > 0)
                if url_had_values:
                    self._clear_url_param(user_key)
                    return False

            # Store the value in widget and session state
            self._new_widget_state.set_from_value(widget_id, deserialized_value)
            self._new_session_state[user_key] = deserialized_value

            # Auto-correct URL if value was clamped/filtered
            self._auto_correct_url_if_needed(
                metadata, user_key, parsed_value, deserialized_value
            )
            return True

        except (ValueError, TypeError, IndexError) as e:
            _LOGGER.debug(
                "Invalid URL value for bound widget '%s', clearing param: %s",
                user_key,
                e,
            )
            self._clear_url_param(user_key)
            return False

    def _clear_url_param(self, user_key: str) -> None:
        """Clear an invalid URL parameter and notify frontend."""
        self.query_params.remove_param(user_key)

    def _auto_correct_url_if_needed(
        self,
        metadata: WidgetMetadata[T],
        user_key: str,
        parsed_value: Any,
        deserialized_value: Any,
    ) -> None:
        """Auto-correct URL if the value was clamped or filtered.

        For selection widgets using human-readable strings in URLs, we preserve
        the original strings unless values were actually filtered out.
        """
        serialized_value = metadata.serializer(deserialized_value)
        if serialized_value == parsed_value:
            return  # No correction needed

        # TODO(query-params): Remove this formatted_options handling once all selection
        # widgets use string-based wire formats (string_value/string_array_value).
        # For index-based widgets, don't auto-correct valid strings to indices -
        # only correct if values were actually filtered.
        string_option_types = ("int_value", "int_array_value", "double_array_value")
        use_formatted_options = False

        if metadata.value_type in string_option_types:
            # Check if parsed value contained strings
            if isinstance(parsed_value, list):
                parsed_has_strings = any(isinstance(v, str) for v in parsed_value)
                parsed_len = len(parsed_value)
            else:
                parsed_has_strings = isinstance(parsed_value, str)
                parsed_len = 1

            if parsed_has_strings:
                serialized_len = (
                    len(serialized_value) if isinstance(serialized_value, list) else 1
                )
                if serialized_len == parsed_len:
                    return  # No filtering, keep original strings in URL
                use_formatted_options = bool(metadata.formatted_options)

        # Build corrected value, converting indices to formatted strings if needed
        corrected_value = serialized_value
        if use_formatted_options and metadata.formatted_options:
            fmt_opts = metadata.formatted_options
            if isinstance(serialized_value, list):
                corrected_value = [
                    fmt_opts[idx]
                    for idx in serialized_value
                    if isinstance(idx, int) and 0 <= idx < len(fmt_opts)
                ]
            elif isinstance(serialized_value, int) and 0 <= serialized_value < len(
                fmt_opts
            ):
                corrected_value = fmt_opts[serialized_value]

        self.query_params._set_corrected_value(
            user_key, corrected_value, metadata.value_type
        )

    def __contains__(self, key: str) -> bool:
        try:
            self[key]
        except KeyError:
            return False
        else:
            return True

    def get_stats(
        self, _family_names: Sequence[str] | None = None
    ) -> dict[str, list[CacheStat]]:
        # Lazy-load vendored package to prevent import of numpy
        from streamlit.vendor.pympler.asizeof import asizeof

        stat = CacheStat("st_session_state", "", asizeof(self))
        # In general, get_stats methods need to be able to return only requested stat
        # families, but this method only returns a single family, and we're guaranteed
        # that it was one of those requested if we make it here.
        return {CACHE_MEMORY_FAMILY: [stat]}

    def _check_serializable(self) -> None:
        """Verify that everything added to session state can be serialized.
        We use pickleability as the metric for serializability, and test for
        pickleability by just trying it.
        """
        for k in self:
            try:
                pickle.dumps(self[k])
            except Exception as e:  # noqa: PERF203
                err_msg = (
                    f"Cannot serialize the value (of type `{type(self[k])}`) of '{k}' in "
                    "st.session_state. Streamlit has been configured to use "
                    "[pickle](https://docs.python.org/3/library/pickle.html) to "
                    "serialize session_state values. Please convert the value to a "
                    "pickle-serializable type. To learn more about this behavior, "
                    "see [our docs](https://docs.streamlit.io/knowledge-base/using-streamlit/serializable-session-state)."
                )
                raise UnserializableSessionStateError(err_msg) from e

    def maybe_check_serializable(self) -> None:
        """Verify that session state can be serialized, if the relevant config
        option is set.

        See `_check_serializable` for details.
        """
        if config.get_option("runner.enforceSerializableSessionState"):
            self._check_serializable()


def _is_internal_key(key: str) -> bool:
    return key.startswith(STREAMLIT_INTERNAL_KEY_PREFIX)


def _is_stale_widget(
    metadata: WidgetMetadata[Any] | None,
    active_widget_ids: set[str],
    fragment_ids_this_run: list[str] | None,
) -> bool:
    if not metadata:
        return True

    # If we're running 1 or more fragments, but this widget is unrelated to any of the
    # fragments that we're running, then it should not be marked as stale as its value
    # may still be needed for a future fragment run or full script run.
    return not (
        metadata.id in active_widget_ids
        or (fragment_ids_this_run and metadata.fragment_id not in fragment_ids_this_run)
    )


@dataclass
class SessionStateStatProvider(StatsProvider):
    _session_mgr: SessionManager

    @property
    def stats_families(self) -> Sequence[str]:
        return (CACHE_MEMORY_FAMILY,)

    def get_stats(
        self, _family_names: Sequence[str] | None = None
    ) -> dict[str, list[CacheStat]]:
        stats: list[CacheStat] = []
        for session_info in self._session_mgr.list_active_sessions():
            session_state = session_info.session.session_state
            session_stats = session_state.get_stats()
            for family_stats in session_stats.values():
                stats.extend(family_stats)
        if not stats:
            return {}
        # In general, get_stats methods need to be able to return only requested stat
        # families, but this method only returns a single family, and we're guaranteed
        # that it was one of those requested if we make it here.
        return {CACHE_MEMORY_FAMILY: group_cache_stats(stats)}
