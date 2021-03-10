# Copyright 2018-2020 Streamlit Inc.
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

import streamlit.report_thread as ReportThread
from streamlit.server.server import Server
from streamlit.errors import StreamlitAPIException
from streamlit.widgets import beta_widget_value
from typing import Optional, Dict, Union, Any, TYPE_CHECKING

if TYPE_CHECKING:
    from streamlit.report_session import ReportSession

Namespace = Dict[str, Any]


class SessionState:
    def __init__(self, **kwargs):
        """SessionState is just a mechanism for users to get and set properties
        based on their application.

        Parameters
        ----------
        **kwargs : any
            Default values for the session state.

        Example
        -------
        >>> session_state = SessionState(user_name='', favorite_color='black')
        >>> session_state.user_name = 'Mary'
        ''
        >>> session_state.favorite_color
        'black'
        """
        self.global_state: Namespace = {}
        self.namespaces: Dict[str, Namespace] = {}
        for key, val in kwargs.items():
            self.global_state[key] = val

    def __getattr__(self, name: str) -> Any:
        state_value = self.get_value(None, name)
        if state_value is not None:
            return state_value
        else:
            return beta_widget_value(name)

    def __setattr__(self, name, value):
        if name in ["global_state", "namespaces"]:
            return super().__setattr__(name, value)

        return self.set_value(None, name, value)

    def get_namespace(self, key: Optional[str]) -> Namespace:
        if key is None:
            return self.global_state

        if key not in self.namespaces:
            self.namespaces[key] = {}

        return self.namespaces[key]

    def has_namespace(self, key: Optional[str]) -> bool:
        return key is None or key in self.namespaces

    def verify_namespace(self, key: Optional[str]) -> None:
        if not self.has_namespace(key):
            raise StreamlitAPIException(f'Invalid key for session state: "{key}"')

    def verify_var(self, key: Optional[str], var_name: str) -> None:
        if not self.has_var_set(key, var_name):
            raise StreamlitAPIException(
                f'Session state variable has not been initialized: "{var_name}"'
            )

    def has_var_set(self, key: Optional[str], var_name: str) -> bool:
        namespace = self.get_namespace(key)
        return var_name in namespace

    def init_value(self, key: Optional[str], var_name: str, default_value: Any) -> None:
        if not self.has_var_set(key, var_name):
            namespace = self.get_namespace(key)
            namespace[var_name] = default_value

    def init_values(self, key: Optional[str], **kwargs) -> None:
        for (var_name, value) in kwargs:
            init_value(key, var_name, default_value)

    def get_value(self, key: Optional[str], var_name: str) -> Optional[Any]:
        namespace = self.get_namespace(key)
        return namespace.get(var_name, None)

    def set_value(self, key: Optional[str], var_name: str, value: Any) -> None:
        namespace = self.get_namespace(key)
        namespace[var_name] = value

    def __str__(self):
        return str(self.global_state)


def get_current_session() -> "ReportSession":
    # Getting the session id easily comes fromt he report context, which is
    # a little weird, but a precedent that has been set.
    ctx = ReportThread.get_report_ctx()
    this_session: Optional["ReportSession"] = None

    if ctx is not None:
        this_session = Server.get_current().get_session_by_id(ctx.session_id)

    if this_session is None:
        raise RuntimeError(
            "We were unable to retrieve your Streamlit session. "
            + "Is your application utilizing threads? It's possible that could "
            + "be conflicting with our system."
        )

    return this_session


def get_session_state(**kwargs) -> SessionState:
    """Gets a SessionState object for the current session.
    Creates a new object if necessary.

    Parameters
    ----------
    **kwargs : any
        Default values you want to add to the session state, if we're creating a
        new one.
    Example
    -------
    >>> session_state = st.beta_session_state(user_name='', favorite_color='black')
    >>> session_state.user_name
    ''
    >>> session_state.user_name = 'Mary'
    >>> session_state.favorite_color
    'black'
    Since you set user_name above, next time your script runs this will be the
    result:
    >>> session_state = st.beta_session_state(user_name='', favorite_color='black')
    >>> session_state.user_name
    'Mary'
    """
    this_session = get_current_session()
    this_session_state = this_session.get_session_state()
    if this_session_state is None:
        this_session_state = SessionState(**kwargs)
        this_session.initialize_session_state(this_session_state)
    else:
        this_session_state.init_values(None, **kwargs)

    return this_session_state


class State:
    @staticmethod
    def init(var_name: str, default_value: str, key: Optional[str] = None) -> None:
        state = get_session_state()
        state.init_value(key, var_name, default_value)

    @staticmethod
    def set(var_name: str, value: str, key: Optional[str] = None) -> None:
        state = get_session_state()
        state.set_value(key, var_name, value)

    @staticmethod
    def get(
        var_name: Optional[str] = None, key: Optional[str] = None
    ) -> Union[Any, Namespace]:
        state = get_session_state()
        if var_name is None:
            state.verify_namespace(key)
            return state.get_namespace(key)

        return state.get_value(key, var_name)
