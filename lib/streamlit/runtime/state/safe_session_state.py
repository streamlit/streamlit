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

import threading
from contextlib import contextmanager
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from collections.abc import Callable, Iterator

    from streamlit.proto.WidgetStates_pb2 import WidgetState as WidgetStateProto
    from streamlit.proto.WidgetStates_pb2 import WidgetStates as WidgetStatesProto
    from streamlit.runtime.state.common import RegisterWidgetResult, T, WidgetMetadata
    from streamlit.runtime.state.query_params import QueryParams
    from streamlit.runtime.state.session_state import SessionState


class SafeSessionState:
    """Thread-safe wrapper around SessionState.

    When AppSession gets a re-run request, it can interrupt its existing
    ScriptRunner and spin up a new ScriptRunner to handle the request.
    When this happens, the existing ScriptRunner will continue executing
    its script until it reaches a yield point - but during this time, it
    must not mutate its SessionState.
    """

    _state: SessionState
    _lock: threading.RLock
    _yield_callback: Callable[[], None]

    def __init__(self, state: SessionState, yield_callback: Callable[[], None]) -> None:
        # Fields must be set using the object's setattr method to avoid
        # infinite recursion from trying to look up the fields we're setting.
        object.__setattr__(self, "_state", state)
        # TODO: we'd prefer this be a threading.Lock instead of RLock -
        #  but `call_callbacks` first needs to be rewritten.
        object.__setattr__(self, "_lock", threading.RLock())
        object.__setattr__(self, "_yield_callback", yield_callback)

    def register_widget(
        self, metadata: WidgetMetadata[T], user_key: str | None
    ) -> RegisterWidgetResult[T]:
        self._yield_callback()
        with self._lock:
            return self._state.register_widget(metadata, user_key)

    def on_script_will_rerun(self, latest_widget_states: WidgetStatesProto) -> None:
        self._yield_callback()
        with self._lock:
            # TODO: rewrite this to copy the callbacks list into a local
            #  variable so that we don't need to hold our lock for the
            #  duration. (This will also allow us to downgrade our RLock
            #  to a Lock.)
            self._state.on_script_will_rerun(latest_widget_states)

    def on_script_finished(self, widget_ids_this_run: set[str]) -> None:
        with self._lock:
            self._state.on_script_finished(widget_ids_this_run)

    def maybe_check_serializable(self) -> None:
        with self._lock:
            self._state.maybe_check_serializable()

    def get_widget_states(self) -> list[WidgetStateProto]:
        """Return a list of serialized widget values for each widget with a value."""
        with self._lock:
            return self._state.get_widget_states()

    def is_new_state_value(self, user_key: str) -> bool:
        with self._lock:
            return self._state.is_new_state_value(user_key)

    def reset_state_value(self, user_key: str, value: Any | None) -> None:
        """Reset a new session state value to a given value
        without triggering the "state value cannot be modified" error.
        """
        self._yield_callback()
        with self._lock:
            self._state.reset_state_value(user_key, value)

    @property
    def filtered_state(self) -> dict[str, Any]:
        """The combined session and widget state, excluding keyless widgets."""
        with self._lock:
            return self._state.filtered_state

    def __getitem__(self, key: str) -> Any:
        self._yield_callback()
        with self._lock:
            return self._state[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self._yield_callback()
        with self._lock:
            self._state[key] = value

    def __delitem__(self, key: str) -> None:
        self._yield_callback()
        with self._lock:
            del self._state[key]

    def __contains__(self, key: str) -> bool:
        self._yield_callback()
        with self._lock:
            return key in self._state

    def __getattr__(self, key: str) -> Any:
        try:
            return self[key]
        except KeyError:
            raise AttributeError(f"{key} not found in session_state.")

    def __setattr__(self, key: str, value: Any) -> None:
        self[key] = value

    def __delattr__(self, key: str) -> None:
        try:
            del self[key]
        except KeyError:
            raise AttributeError(f"{key} not found in session_state.")

    def __repr__(self) -> str:
        """Presents itself as a simple dict of the underlying SessionState instance."""
        kv = ((k, self._state[k]) for k in self._state._keys())
        s = ", ".join(f"{k}: {v!r}" for k, v in kv)
        return f"{{{s}}}"

    @contextmanager
    def query_params(self) -> Iterator[QueryParams]:
        self._yield_callback()
        with self._lock:
            yield self._state.query_params
