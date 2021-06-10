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

from typing import (
    Any,
    ItemsView,
    KeysView,
    ValuesView,
    cast,
    Dict,
    Iterator,
    MutableMapping,
    Optional,
    TYPE_CHECKING,
    Union,
    Tuple,
    Callable,
    Set,
    List,
)

import attr

from streamlit.errors import StreamlitAPIException
from streamlit.proto.WidgetStates_pb2 import WidgetState as WidgetStateProto
from streamlit.proto.WidgetStates_pb2 import WidgetStates as WidgetStatesProto

if TYPE_CHECKING:
    from streamlit.report_session import ReportSession


@attr.s(auto_attribs=True, slots=True, frozen=True)
class Serialized:
    value: WidgetStateProto


@attr.s(auto_attribs=True, slots=True, frozen=True)
class Value:
    value: Any


WState = Union[Serialized, Value]

WidgetArgs = Tuple[Any, ...]
WidgetCallback = Callable[..., None]
WidgetDeserializer = Callable[[Any], Any]
WidgetSerializer = Callable[[Any], WidgetStateProto]
WidgetKwargs = Dict[str, Any]


@attr.s(auto_attribs=True, slots=True, frozen=True)
class WidgetMetadata:
    id: str
    deserializer: WidgetDeserializer
    serializer: WidgetSerializer
    value_type: Any
    has_key: bool = False

    callback: Optional[WidgetCallback] = None
    callback_args: Optional[WidgetArgs] = None
    callback_kwargs: Optional[WidgetKwargs] = None


@attr.s(auto_attribs=True, slots=True)
class WStates(MutableMapping[str, Any]):
    states: Dict[str, WState] = attr.Factory(dict)
    widget_metadata: Dict[str, WidgetMetadata] = attr.Factory(dict)

    def __getitem__(self, k: str) -> Any:
        item = self.states.get(k, None)
        if item is not None:
            if isinstance(item, Value):
                return item.value
            else:
                metadata = self.widget_metadata.get(k, None)
                if metadata is None:
                    # No deserializer, which should only happen if state is gotten from a reconnecting browser
                    # and the script is trying to access it. Pretend it doesn't exist.
                    raise KeyError(k)
                deserialized = metadata.deserializer(
                    item.value.__getattribute__(item.value.WhichOneof("value"))
                )
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

    def keys(self) -> Set[str]:
        return set(self.states.keys())

    def items(self) -> Set[Tuple[str, Any]]:
        i = [(k, self[k]) for k in self]
        return set(i)

    def values(self) -> Set[Any]:  # type: ignore
        v = [self[wid] for wid in self]
        return set(v)

    def set_from_proto(self, widget_state: WidgetStateProto):
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
        item = self.states.get(k, None)
        if item is not None:
            if isinstance(item, Value):
                metadata = self.widget_metadata.get(k, None)
                if metadata is None:
                    return default
                else:
                    field = metadata.value_type
                    widget.__setattr__(field, metadata.serializer(item.value))
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
        metadata = self.widget_metadata.get(widget_id, None)
        assert metadata is not None
        callback = metadata.callback
        if callback is None:
            return

        args = metadata.callback_args or ()
        kwargs = metadata.callback_kwargs or {}
        callback(*args, **kwargs)


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

    _old_state: Dict[str, Any] = attr.Factory(dict)
    _new_session_state: Dict[str, Any] = attr.Factory(dict)
    _new_widget_state: WStates = attr.Factory(WStates)

    # is it possible for a value to get through this without being deserialized?
    def compact_state(self) -> None:
        self._old_state.update(self._new_session_state)
        for wid in self._new_widget_state:
            self._old_state[wid] = self._new_widget_state[wid]
        self._new_session_state.clear()
        self._new_widget_state.clear()

    @property
    def _merged_state(self) -> Dict[str, Any]:
        # NOTE: The order that the dicts are unpacked here is important as it
        #       is what ensures that the new values take priority
        return {
            **self._old_state,
            **self._new_widget_state,
            **self._new_session_state,
        }

    def is_new_state_value(self, key: str) -> bool:
        return key in self._new_session_state

    def __iter__(self) -> Iterator[Any]:
        return iter(self._merged_state)

    def __len__(self) -> int:
        return len(self._merged_state)

    def __str__(self):
        return str(self._merged_state)

    def __getitem__(self, key: str) -> Any:
        return self._merged_state[key]

    def __setitem__(self, key: str, value: Any) -> None:
        from streamlit.report_thread import get_report_ctx, ReportContext

        ctx = cast(ReportContext, get_report_ctx())
        if key in ctx.widget_ids_this_run.items():
            raise StreamlitAPIException(
                "Setting the value of a widget after its creation is disallowed."
            )
        self._new_session_state[key] = value

    def __delitem__(self, key: str) -> None:
        if key in ["_new_session_state", "_new_widget_state", "_old_state"]:
            raise KeyError(key)

        if not (
            key in self._new_session_state
            or key in self._new_widget_state
            or key in self._old_state
        ):
            raise KeyError(key)

        if key in self._new_session_state:
            del self._new_session_state[key]

        if key in self._new_widget_state:
            del self._new_widget_state[key]

        if key in self._old_state:
            del self._old_state[key]

    def __getattr__(self, key: str) -> Any:
        try:
            return self[key]
        except KeyError:
            raise AttributeError(key)

    def __setattr__(self, key: str, value: Any) -> None:
        # Setting the _old_state and _new_state attributes must be done using
        # the base method to avoid recursion.
        if key in ["_new_session_state", "_new_widget_state", "_old_state"]:
            super().__setattr__(key, value)
        else:
            self[key] = value

    def __delattr__(self, key: str) -> None:
        try:
            del self[key]
        except KeyError:
            raise AttributeError(key)

    def set_from_proto(self, widget_states: WidgetStatesProto):
        for state in widget_states.widgets:
            self._new_widget_state.set_from_proto(state)

    def call_callbacks(self):
        changed_widget_ids = [
            wid for wid in self._new_widget_state if self._widget_changed(wid)
        ]
        self.compact_state()
        for wid in changed_widget_ids:
            self._new_widget_state.call_callback(wid)

    def _widget_changed(self, widget_id: str) -> bool:
        new_value = self._new_widget_state.get(widget_id, None)
        old_value = self._old_state.get(widget_id, None)
        changed: bool = new_value != old_value
        return changed

    def reset_triggers(self) -> None:
        """Sets all trigger values in our state dictionary to False."""
        for state_id in self._old_state:
            metadata = self._new_widget_state.widget_metadata.get(state_id, None)
            if metadata is not None:
                if metadata.value_type == "trigger_value":
                    self._old_state[state_id] = False

    def cull_nonexistent(self, widget_ids: Set[str]):
        self._new_widget_state.cull_nonexistent(widget_ids)

    def set_metadata(self, widget_metadata: WidgetMetadata) -> None:
        widget_id = widget_metadata.id
        self._new_widget_state.widget_metadata[widget_id] = widget_metadata

        # TODO: Move this to somewhere more appropriate.
        if widget_id not in self:
            deserializer = widget_metadata.deserializer
            self._old_state[widget_id] = deserializer(None)

    def get_value_for_registration(self, widget_id: str) -> Any:
        try:
            value = self[widget_id]
            return value
        except KeyError:
            metadata = self._new_widget_state.widget_metadata[widget_id]
            return metadata.deserializer(None)

    def as_widget_states(self) -> List[WidgetStateProto]:
        return self._new_widget_state.as_widget_states()


def _get_current_session() -> "ReportSession":
    # Getting the session id easily comes from the report context, which is
    # a little weird, but a precedent that has been set.
    from streamlit.report_thread import get_report_ctx

    ctx = get_report_ctx()
    this_session: Optional["ReportSession"] = None

    if ctx is not None:
        # This needs to be imported lazily to avoid a dependency cycle.
        from streamlit.server.server import Server

        this_session = Server.get_current().get_session_by_id(ctx.session_id)

    if this_session is None:
        raise RuntimeError(
            "We were unable to retrieve your Streamlit session."
            " Is your application utilizing threads? It's possible that could"
            " be conflicting with our system."
        )

    return this_session


def get_session_state() -> SessionState:
    """Get the SessionState object for the current session.

    Note that in streamlit scripts, this function should not be called
    directly. Instead, SessionState objects should be accessed via
    st.session_state.
    """
    return _get_current_session().session_state


class LazySessionState(MutableMapping[str, Any]):
    """A lazy wrapper around SessionState.

    SessionState can't be instantiated normally in lib/streamlit/__init__.py
    because there may not be a ReportSession yet. Instead we have this wrapper,
    which delegates to the SessionState for the active ReportSession. This will
    only be interacted within an app script, that is, when a ReportSession is
    guaranteed to exist.
    """

    def __iter__(self) -> Iterator[Any]:
        state = get_session_state()
        return iter(state)

    def __len__(self) -> int:
        state = get_session_state()
        return len(state)

    def __str__(self):
        state = get_session_state()
        return str(state)

    def __getitem__(self, key: str) -> Any:
        state = get_session_state()
        return state[key]

    def __setitem__(self, key: str, value: Any) -> None:
        state = get_session_state()
        state[key] = value

    def __delitem__(self, key: str) -> None:
        state = get_session_state()
        del state[key]

    def __getattr__(self, key: str) -> Any:
        state = get_session_state()
        return state.__getattr__(key)

    def __setattr__(self, key: str, value: Any) -> None:
        state = get_session_state()
        state.__setattr__(key, value)

    def __delattr__(self, key: str) -> None:
        state = get_session_state()
        state.__delattr__(key)
