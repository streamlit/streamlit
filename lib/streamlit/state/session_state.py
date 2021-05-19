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
    cast,
    Dict,
    Iterator,
    MutableMapping,
    Optional,
    TYPE_CHECKING,
    Union,
)

import attr

from streamlit.errors import StreamlitAPIException
from streamlit.report_thread import get_report_ctx, ReportContext
from streamlit.server.server import Server

if TYPE_CHECKING:
    from streamlit.report_session import ReportSession


@attr.s(auto_attribs=True)
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
    _new_state: Dict[str, Any] = attr.Factory(dict)

    def make_state_old(self) -> None:
        self._old_state.update(self._new_state)
        self._new_state.clear()

    @property
    def _merged_state(self) -> Dict[str, Any]:
        # NOTE: The order that the dicts are unpacked here is important as it
        #       is what ensures that the values in _new_state overwrite those
        #       of _old_state in the returned, merged dictionary.
        return {
            **self._old_state,
            # TODO: Also include widget values in the dict returned here.
            **self._new_state,
        }

    def is_new_value(self, key: str) -> bool:
        return key in self._new_state

    def __iter__(self) -> Iterator[Any]:
        return iter(self._merged_state)

    def __len__(self) -> int:
        return len(self._merged_state)

    def __str__(self):
        return str(self._merged_state)

    def __getitem__(self, key: str) -> Any:
        return self._merged_state[key]

    def __setitem__(self, key: str, value: Any) -> None:
        ctx = cast(ReportContext, get_report_ctx())
        if key in ctx.widget_ids_this_run.items():
            raise StreamlitAPIException(
                "Setting the value of a widget after its creation is disallowed."
            )
        self._new_state[key] = value

    def __delitem__(self, key: str) -> None:
        if not (key in self._new_state or key in self._old_state):
            raise KeyError(key)

        if key in self._new_state:
            del self._new_state[key]

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
        if key in ["_new_state", "_old_state"]:
            super().__setattr__(key, value)
        else:
            self[key] = value

    def __delattr__(self, key: str) -> None:
        try:
            del self[key]
        except KeyError:
            raise AttributeError(key)


def _get_session_state() -> SessionState:
    """Get the SessionState object for the current session.

    Note that in streamlit scripts, this function should not be called
    directly. Instead, SessionState objects should be accessed via
    st.session_state.
    """
    # Getting the session id easily comes from the report context, which is
    # a little weird, but a precedent that has been set.
    ctx = get_report_ctx()
    this_session: Optional["ReportSession"] = None

    if ctx is not None:
        this_session = Server.get_current().get_session_by_id(ctx.session_id)

    if this_session is None:
        raise RuntimeError(
            "We were unable to retrieve your Streamlit session."
            " Is your application utilizing threads? It's possible that could"
            " be conflicting with our system."
        )

    return this_session.session_state


class LazySessionState(MutableMapping[str, Any]):
    """A lazy wrapper around SessionState.

    SessionState can't be instantiated normally in lib/streamlit/__init__.py
    because there may not be a ReportSession yet. Instead we have this wrapper,
    which delegates to the SessionState for the active ReportSession. This will
    only be interacted within an app script, that is, when a ReportSession is
    guaranteed to exist.
    """

    def __iter__(self) -> Iterator[Any]:
        state = _get_session_state()
        return iter(state)

    def __len__(self) -> int:
        state = _get_session_state()
        return len(state)

    def __str__(self):
        state = _get_session_state()
        return str(state)

    def __getitem__(self, key: str) -> Any:
        state = _get_session_state()
        return state[key]

    def __setitem__(self, key: str, value: Any) -> None:
        state = _get_session_state()
        state[key] = value

    def __delitem__(self, key: str) -> None:
        state = _get_session_state()
        del state[key]

    def __getattr__(self, key: str) -> Any:
        state = _get_session_state()
        return state.__getattr__(key)

    def __setattr__(self, key: str, value: Any) -> None:
        state = _get_session_state()
        state.__setattr__(key, value)

    def __delattr__(self, key: str) -> None:
        state = _get_session_state()
        state.__delattr__(key)
