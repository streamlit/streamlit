# Copyright 2018-2021 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from copy import deepcopy
import json
from streamlit.stats import CacheStat, CacheStatsProvider
from streamlit.type_util import Key
from typing import (
    TYPE_CHECKING,
    Any,
    KeysView,
    cast,
    Dict,
    Iterator,
    MutableMapping,
    Optional,
    Union,
    Tuple,
    Callable,
    Set,
    List,
)

import attr

from pympler.asizeof import asizeof

import streamlit as st
from streamlit import logger as _logger
from streamlit.errors import StreamlitAPIException
from streamlit.proto.WidgetStates_pb2 import WidgetState as WidgetStateProto
from streamlit.proto.WidgetStates_pb2 import WidgetStates as WidgetStatesProto

if TYPE_CHECKING:
    from streamlit.server.server import SessionInfo

logger = _logger.get_logger(__name__)

GENERATED_WIDGET_KEY_PREFIX = "$$GENERATED_WIDGET_KEY"

STREAMLIT_INTERNAL_KEY_PREFIX = "$$STREAMLIT_INTERNAL_KEY"
SCRIPT_RUN_WITHOUT_ERRORS_KEY = (
    f"{STREAMLIT_INTERNAL_KEY_PREFIX}_SCRIPT_RUN_WITHOUT_ERRORS"
)


@attr.s(auto_attribs=True, slots=True, frozen=True)
class Serialized:
    value: WidgetStateProto


@attr.s(auto_attribs=True, slots=True, frozen=True)
class Value:
    value: Any


WState = Union[Serialized, Value]

WidgetArgs = Tuple[Any, ...]
WidgetCallback = Callable[..., None]
# A deserializer receives the value from whatever field is set on the
# WidgetState proto, and returns a regular python value. A serializer
# receives a regular python value, and returns something suitable for
# a value field on WidgetState proto. They should be inverses.
WidgetDeserializer = Callable[[Any, str], Any]
WidgetSerializer = Callable[[Any], Any]
WidgetKwargs = Dict[str, Any]


@attr.s(auto_attribs=True, slots=True, frozen=True)
class WidgetMetadata:
    id: str
    deserializer: WidgetDeserializer = attr.ib(repr=False)
    serializer: WidgetSerializer = attr.ib(repr=False)
    value_type: Any

    callback: Optional[WidgetCallback] = None
    callback_args: Optional[WidgetArgs] = None
    callback_kwargs: Optional[WidgetKwargs] = None


@attr.s(auto_attribs=True, slots=True)
class WStates(MutableMapping[str, Any]):
    states: Dict[str, WState] = attr.Factory(dict)
    widget_metadata: Dict[str, WidgetMetadata] = attr.Factory(dict)

    def __getitem__(self, k: str) -> Any:
        item = self.states.get(k)
        if item is not None:
            if isinstance(item, Value):
                return item.value
            else:
                metadata = self.widget_metadata.get(k)
                if metadata is None:
                    # No deserializer, which should only happen if state is
                    # gotten from a reconnecting browser and the script is
                    # trying to access it. Pretend it doesn't exist.
                    raise KeyError(k)
                value_type = cast(str, item.value.WhichOneof("value"))
                value = item.value.__getattribute__(value_type)

                # Array types are messages with data in a `data` field
                if value_type in [
                    "double_array_value",
                    "int_array_value",
                    "string_array_value",
                ]:
                    value = value.data
                elif value_type == "json_value":
                    value = json.loads(value)

                deserialized = metadata.deserializer(value, metadata.id)

                # Update metadata to reflect information from WidgetState proto
                self.set_widget_metadata(attr.evolve(metadata, value_type=value_type))

                self.states[k] = Value(deserialized)
                return deserialized
        else:
            raise KeyError(k)

    def __setitem__(self, k: str, v: WState):
        self.states[k] = v

    def __delitem__(self, k: str) -> None:
        del self.states[k]

    def __len__(self) -> int:
        return len(self.states)

    def __iter__(self):
        # For this and many other methods, we can't simply delegate to the
        # states field, because we need to invoke `__getitem__` for any
        # values, to handle deserialization and unwrapping of values.
        for key in self.states:
            yield key

    def keys(self) -> KeysView[str]:
        return KeysView(self.states)

    def items(self) -> Set[Tuple[str, Any]]:  # type: ignore
        return {(k, self[k]) for k in self}

    def values(self) -> Set[Any]:  # type: ignore
        return {self[wid] for wid in self}

    def update(self, other: "WStates"):  # type: ignore
        self.states.update(other.states)
        self.widget_metadata.update(other.widget_metadata)

    def set_widget_from_proto(self, widget_state: WidgetStateProto):
        self[widget_state.id] = Serialized(widget_state)

    def set_from_value(self, k: str, v: Any):
        self[k] = Value(v)

    def set_widget_metadata(self, widget_meta: WidgetMetadata):
        self.widget_metadata[widget_meta.id] = widget_meta

    def cull_nonexistent(self, widget_ids: Set[str]) -> None:
        """Removes items in state that aren't present in a set of provided
        widget_ids.
        """
        self.states = {k: v for k, v in self.states.items() if k in widget_ids}

    def get_serialized(
        self, k: str, default: Optional[WidgetStateProto] = None
    ) -> Optional[WidgetStateProto]:
        widget = WidgetStateProto()
        widget.id = k
        item = self.states.get(k)
        if item is not None:
            if isinstance(item, Value):
                metadata = self.widget_metadata.get(k)
                if metadata is None:
                    return default
                else:
                    field = metadata.value_type
                    serialized = metadata.serializer(item.value)
                    if field in (
                        "double_array_value",
                        "int_array_value",
                        "string_array_value",
                    ):
                        arr = getattr(widget, field)
                        arr.data.extend(serialized)
                    elif field == "json_value":
                        setattr(widget, field, json.dumps(serialized))
                    elif field == "file_uploader_state_value":
                        widget.file_uploader_state_value.CopyFrom(serialized)
                    else:
                        setattr(widget, field, serialized)
                    return widget
            else:
                return item.value
        else:
            return default

    def as_widget_states(self) -> List[WidgetStateProto]:
        states = [
            self.get_serialized(widget_id)
            for widget_id in self.states.keys()
            if self.get_serialized(widget_id)
        ]
        states = cast(List[WidgetStateProto], states)
        return states

    def call_callback(self, widget_id: str) -> None:
        metadata = self.widget_metadata.get(widget_id)
        assert metadata is not None
        callback = metadata.callback
        if callback is None:
            return

        args = metadata.callback_args or ()
        kwargs = metadata.callback_kwargs or {}
        callback(*args, **kwargs)


def _missing_key_error_message(key: str) -> str:
    return (
        f'st.session_state has no key "{key}". Did you forget to initialize it? '
        f"More info: https://docs.streamlit.io/library/advanced-features/session-state#initialization"
    )


def _missing_attr_error_message(attr_name: str) -> str:
    return (
        f'st.session_state has no attribute "{attr_name}". Did you forget to initialize it? '
        f"More info: https://docs.streamlit.io/library/advanced-features/session-state#initialization"
    )


@attr.s(auto_attribs=True, slots=True)
class SessionState(MutableMapping[str, Any]):
    """SessionState allows users to store values that persist between app
    reruns.

    SessionState objects are created lazily when a script accesses
    st.session_state.

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
    _old_state: Dict[str, Any] = attr.Factory(dict)

    # Values set in session state during the current script run, possibly for
    # setting a widget's value. Keyed by a user provided string.
    _new_session_state: Dict[str, Any] = attr.Factory(dict)

    # Widget values from the frontend, usually one changing prompted the script rerun
    _new_widget_state: WStates = attr.Factory(WStates)

    # Keys used for widgets will be eagerly converted to the matching widget id
    _key_id_mapping: Dict[str, str] = attr.Factory(dict)

    # is it possible for a value to get through this without being deserialized?
    def compact_state(self) -> None:
        for key_or_wid in self:
            self._old_state[key_or_wid] = self[key_or_wid]
        self._new_session_state.clear()
        self._new_widget_state.clear()

    def _compact(self) -> "SessionState":
        state: SessionState = self.copy()
        state.compact_state()
        return state

    def clear_state(self) -> None:
        self._old_state.clear()
        self._new_session_state.clear()
        self._new_widget_state.clear()
        self._key_id_mapping.clear()

    def _safe_widget_state(self) -> Dict[str, Any]:
        """Returns widget states for all widgets with deserializers registered.

        On a browser tab reconnect, it's possible for widgets in
        self._new_widget_state to not have deserializers registered, which will
        result in trying to access them raising a KeyError. This results in
        things exploding if we try to naively use the splat operator on
        self._new_widget_state in _merged_state below.
        """
        wstate = {}
        for k in self._new_widget_state.keys():
            try:
                wstate[k] = self._new_widget_state[k]
            except KeyError:
                pass
        return wstate

    @property
    def _merged_state(self) -> Dict[str, Any]:
        return {k: self[k] for k in self}

    @property
    def filtered_state(self) -> Dict[str, Any]:
        """The combined session and widget state, excluding keyless widgets."""

        wid_key_map = self.reverse_key_wid_map

        state: Dict[str, Any] = {}

        # We can't write `for k, v in self.items()` here because doing so will
        # run into a `KeyError` if widget metadata has been cleared (which
        # happens when the streamlit server restarted or the cache was cleared),
        # then we receive a widget's state from a browser.
        for k in self.keys():
            if not is_widget_id(k) and not is_internal_key(k):
                state[k] = self[k]
            elif is_keyed_widget_id(k):
                try:
                    key = wid_key_map[k]
                    state[key] = self[k]
                except KeyError:
                    # Widget id no longer maps to a key, it is a not yet
                    # cleared value in old state for a reset widget
                    pass

        return state

    @property
    def reverse_key_wid_map(self) -> Dict[str, str]:
        wid_key_map = {v: k for k, v in self._key_id_mapping.items()}
        return wid_key_map

    def keys(self) -> Set[str]:  # type: ignore
        """All keys active in Session State, with widget keys converted
        to widget ids when one is known."""
        old_keys = {self._get_widget_id(k) for k in self._old_state.keys()}
        new_widget_keys = set(self._new_widget_state.keys())
        new_session_state_keys = {
            self._get_widget_id(k) for k in self._new_session_state.keys()
        }
        return old_keys | new_widget_keys | new_session_state_keys

    def is_new_state_value(self, user_key: str) -> bool:
        return user_key in self._new_session_state

    def is_new_widget_value(self, widget_id: str) -> bool:
        return widget_id in self._new_widget_state

    def __iter__(self) -> Iterator[Any]:
        return iter(self.keys())

    def __len__(self) -> int:
        return len(self.keys())

    def __str__(self):
        return str(self._merged_state)

    def __getitem__(self, key: str) -> Any:
        wid_key_map = self.reverse_key_wid_map
        widget_id = self._get_widget_id(key)

        if widget_id in wid_key_map and widget_id == key:
            # the "key" is a raw widget id, so get its associated user key for lookup
            key = wid_key_map[widget_id]
        try:
            return self._getitem(widget_id, key)
        except KeyError:
            raise KeyError(_missing_key_error_message(key))

    def _getitem(self, widget_id: Optional[str], user_key: Optional[str]) -> Any:
        """Get the value of an entry in Session State, using either the
        user-provided key or a widget id as appropriate for the internal dict
        being accessed.

        At least one of the arguments must have a value."""
        assert user_key is not None or widget_id is not None

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

        raise KeyError

    def __setitem__(self, user_key: str, value: Any) -> None:
        from streamlit.script_run_context import get_script_run_ctx

        ctx = get_script_run_ctx()

        if ctx is not None:
            widget_id = self._key_id_mapping.get(user_key, None)
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

        if key in self._key_id_mapping:
            del self._key_id_mapping[key]

        if widget_id in self._new_widget_state:
            del self._new_widget_state[widget_id]

        if widget_id in self._old_state:
            del self._old_state[widget_id]

    def update(self, other: "SessionState"):  # type: ignore
        self._new_session_state.update(other._new_session_state)
        self._new_widget_state.update(other._new_widget_state)
        self._old_state.update(other._old_state)
        self._key_id_mapping.update(other._key_id_mapping)

    def set_widgets_from_proto(self, widget_states: WidgetStatesProto):
        for state in widget_states.widgets:
            self._new_widget_state.set_widget_from_proto(state)

    def call_callbacks(self):
        from streamlit.script_runner import RerunException

        changed_widget_ids = [
            wid for wid in self._new_widget_state if self._widget_changed(wid)
        ]
        for wid in changed_widget_ids:
            try:
                self._new_widget_state.call_callback(wid)
            except RerunException:
                st.warning(
                    "Calling st.experimental_rerun() within a callback is a no-op."
                )

    def _widget_changed(self, widget_id: str) -> bool:
        new_value = self._new_widget_state.get(widget_id)
        old_value = self._old_state.get(widget_id)
        changed: bool = new_value != old_value
        return changed

    def reset_triggers(self) -> None:
        """Sets all trigger values in our state dictionary to False."""
        for state_id in self._new_widget_state:
            metadata = self._new_widget_state.widget_metadata.get(state_id)
            if metadata is not None:
                if metadata.value_type == "trigger_value":
                    self._new_widget_state[state_id] = Value(False)

        for state_id in self._old_state:
            metadata = self._new_widget_state.widget_metadata.get(state_id)
            if metadata is not None:
                if metadata.value_type == "trigger_value":
                    self._old_state[state_id] = False

    def cull_nonexistent(self, widget_ids: Set[str]):
        self._new_widget_state.cull_nonexistent(widget_ids)

        # Remove entries from _old_state corresponding to
        # widgets not in widget_ids.
        self._old_state = {
            k: v
            for k, v in self._old_state.items()
            if (k in widget_ids or not is_widget_id(k))
        }

    def set_metadata(self, widget_metadata: WidgetMetadata) -> None:
        widget_id = widget_metadata.id
        self._new_widget_state.widget_metadata[widget_id] = widget_metadata

    def maybe_set_new_widget_value(
        self, widget_id: str, user_key: Optional[str] = None
    ) -> None:
        """Add the value of a new widget to session state."""
        widget_metadata = self._new_widget_state.widget_metadata[widget_id]
        deserializer = widget_metadata.deserializer
        initial_widget_value = deepcopy(deserializer(None, widget_metadata.id))

        if widget_id not in self and (user_key is None or user_key not in self):
            # This is the first time this widget is being registered, so we save
            # its value in widget state.
            self._new_widget_state.set_from_value(widget_id, initial_widget_value)

    def should_set_frontend_state_value(
        self, widget_id: str, user_key: Optional[str]
    ) -> bool:
        """Keep widget_state and session_state in sync when a widget is registered.

        This method returns whether the frontend needs to be updated with the
        new value of this widget.
        """
        if user_key is None:
            return False

        return self.is_new_state_value(user_key)

    def get_value_for_registration(self, widget_id: str) -> Any:
        """Get the value of a widget, for use as its return value.

        Returns a copy, so reference types can't be accidentally mutated by user code.
        """
        value = self[widget_id]
        return deepcopy(value)

    def as_widget_states(self) -> List[WidgetStateProto]:
        return self._new_widget_state.as_widget_states()

    def _get_widget_id(self, k: str) -> str:
        """Turns a value that might be a widget id or a user provided key into
        an appropriate widget id.
        """
        return self._key_id_mapping.get(k, k)

    def set_key_widget_mapping(self, widget_id: str, user_key: str) -> None:
        self._key_id_mapping[user_key] = widget_id

    def copy(self):
        return deepcopy(self)

    def set_keyed_widget(
        self, metadata: WidgetMetadata, widget_id: str, user_key: str
    ) -> None:
        self.set_metadata(metadata)
        self.set_key_widget_mapping(widget_id, user_key)
        self.maybe_set_new_widget_value(widget_id, user_key)

    def set_unkeyed_widget(self, metadata: WidgetMetadata, widget_id: str) -> None:
        self.set_metadata(metadata)
        self.maybe_set_new_widget_value(widget_id)

    def get_metadata_by_key(self, user_key: str) -> WidgetMetadata:
        widget_id = self._key_id_mapping[user_key]
        return self._new_widget_state.widget_metadata[widget_id]

    def get_stats(self) -> List[CacheStat]:
        stat = CacheStat("st_session_state", "", asizeof(self))
        return [stat]


def is_widget_id(key: str) -> bool:
    return key.startswith(GENERATED_WIDGET_KEY_PREFIX)


# TODO: It would be better to make key vs not visible through more principled means
def is_keyed_widget_id(key: str) -> bool:
    return is_widget_id(key) and not key.endswith("-None")


def is_internal_key(key: str) -> bool:
    return key.startswith(STREAMLIT_INTERNAL_KEY_PREFIX)


_state_use_warning_already_displayed = False


def get_session_state() -> SessionState:
    """Get the SessionState object for the current session.

    Note that in streamlit scripts, this function should not be called
    directly. Instead, SessionState objects should be accessed via
    st.session_state.
    """
    global _state_use_warning_already_displayed
    from streamlit.script_run_context import get_script_run_ctx

    ctx = get_script_run_ctx()

    # If there is no report context because the script is run bare, have
    # session state act as an always empty dictionary, and print a warning.
    if ctx is None:
        if not _state_use_warning_already_displayed:
            _state_use_warning_already_displayed = True
            if not st._is_running_with_streamlit:
                logger.warning(
                    "Session state does not function when running a script without `streamlit run`"
                )
        return SessionState()
    return ctx.session_state


class LazySessionState(MutableMapping[str, Any]):
    """A lazy wrapper around SessionState.

    SessionState can't be instantiated normally in lib/streamlit/__init__.py
    because there may not be a AppSession yet. Instead we have this wrapper,
    which delegates to the SessionState for the active AppSession. This will
    only be interacted within an app script, that is, when a AppSession is
    guaranteed to exist.
    """

    def _validate_key(self, key) -> None:
        if key.startswith(GENERATED_WIDGET_KEY_PREFIX):
            raise StreamlitAPIException(
                f"Keys beginning with {GENERATED_WIDGET_KEY_PREFIX} are reserved."
            )

    def __iter__(self) -> Iterator[Any]:
        state = get_session_state()
        return iter(state.filtered_state)

    def __len__(self) -> int:
        state = get_session_state()
        return len(state.filtered_state)

    def __str__(self):
        state = get_session_state()
        return str(state.filtered_state)

    def __getitem__(self, key: Key) -> Any:
        key = str(key)
        self._validate_key(key)
        state = get_session_state()
        return state[key]

    def __setitem__(self, key: Key, value: Any) -> None:
        key = str(key)
        self._validate_key(key)
        state = get_session_state()
        state[key] = value

    def __delitem__(self, key: Key) -> None:
        key = str(key)
        self._validate_key(key)
        state = get_session_state()
        del state[key]

    def __getattr__(self, key: str) -> Any:
        self._validate_key(key)
        try:
            return self[key]
        except KeyError:
            raise AttributeError(_missing_attr_error_message(key))

    def __setattr__(self, key: str, value: Any) -> None:
        self._validate_key(key)
        self[key] = value

    def __delattr__(self, key: str) -> None:
        self._validate_key(key)
        try:
            del self[key]
        except KeyError:
            raise AttributeError(_missing_attr_error_message(key))

    def to_dict(self) -> Dict[str, Any]:
        state = get_session_state()
        return state.filtered_state


@attr.s(auto_attribs=True, slots=True)
class SessionStateStatProvider(CacheStatsProvider):
    _session_info_by_id: Dict[str, "SessionInfo"]

    def get_stats(self) -> List[CacheStat]:
        stats: List[CacheStat] = []
        for session_info in self._session_info_by_id.values():
            session_state = session_info.session.session_state
            stats.extend(session_state.get_stats())
        return stats
