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
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from streamlit.report_session import ReportSession


class SessionState(object):
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
        for key, val in kwargs.items():
            setattr(self, key, val)


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

    return this_session_state
