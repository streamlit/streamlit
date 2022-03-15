# Copyright 2018-2022 Streamlit Inc.
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
    Dict,
    Iterator,
    MutableMapping,
)

import streamlit as st
from streamlit import logger as _logger
from streamlit.type_util import Key
from .session_state import SessionState, validate_key

logger = _logger.get_logger(__name__)


_state_use_warning_already_displayed = False


def get_session_state() -> SessionState:
    """Get the SessionState object for the current session.

    Note that in streamlit scripts, this function should not be called
    directly. Instead, SessionState objects should be accessed via
    st.session_state.
    """
    global _state_use_warning_already_displayed
    from streamlit.scriptrunner import get_script_run_ctx

    ctx = get_script_run_ctx()

    # If there is no script run context because the script is run bare, have
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


class AutoSessionState(MutableMapping[str, Any]):
    """A SessionState interface that acts as a wrapper around the
    current script thread's SessionState instance.

    When a user script uses `st.session_state`, it's interacting with
    the singleton AutoSessionState instance, which delegates to the
    SessionState for the active AppSession.

    (This will only be used within an app script, when an AppSession is
    guaranteed to exist.)
    """

    def __iter__(self) -> Iterator[Any]:
        state = get_session_state()
        return iter(state.filtered_state)

    def __len__(self) -> int:
        state = get_session_state()
        return len(state.filtered_state)

    def __str__(self) -> str:
        state = get_session_state()
        return str(state.filtered_state)

    def __getitem__(self, key: Key) -> Any:
        key = str(key)
        validate_key(key)
        state = get_session_state()
        return state[key]

    def __setitem__(self, key: Key, value: Any) -> None:
        key = str(key)
        validate_key(key)
        state = get_session_state()
        state[key] = value

    def __delitem__(self, key: Key) -> None:
        key = str(key)
        validate_key(key)
        state = get_session_state()
        del state[key]

    def __getattr__(self, key: str) -> Any:
        validate_key(key)
        try:
            return self[key]
        except KeyError:
            raise AttributeError(_missing_attr_error_message(key))

    def __setattr__(self, key: str, value: Any) -> None:
        validate_key(key)
        self[key] = value

    def __delattr__(self, key: str) -> None:
        validate_key(key)
        try:
            del self[key]
        except KeyError:
            raise AttributeError(_missing_attr_error_message(key))

    def to_dict(self) -> Dict[str, Any]:
        state = get_session_state()
        return state.filtered_state


def _missing_attr_error_message(attr_name: str) -> str:
    return (
        f'st.session_state has no attribute "{attr_name}". Did you forget to initialize it? '
        f"More info: https://docs.streamlit.io/library/advanced-features/session-state#initialization"
    )
