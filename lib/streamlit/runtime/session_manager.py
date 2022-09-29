# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

from abc import abstractmethod
from dataclasses import dataclass
from typing import Dict, List, Optional, TYPE_CHECKING

from typing_extensions import Protocol

from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from .app_session import AppSession

if TYPE_CHECKING:
    from .runtime import Runtime


class SessionClientDisconnectedError(Exception):
    """Raised by operations on a disconnected SessionClient."""


class SessionClient(Protocol):
    """Interface for sending data to a session's client."""

    @abstractmethod
    def write_forward_msg(self, msg: ForwardMsg) -> None:
        """Deliver a ForwardMsg to the client.

        If the SessionClient has been disconnected, it should raise a
        SessionClientDisconnectedError.
        """
        raise NotImplementedError


# TODO(vdonato): We may want to consider either coming up with a better name for this or
# consolidating it with the SessionData class since the two names are similar enough
# to be confusing right now.
@dataclass
class SessionInfo:
    """Type containing data related to an AppSession.

    For each AppSession, the Runtime tracks that session's
    script_run_count. This is used to track the age of messages in
    the ForwardMsgCache.
    """

    client: Optional[SessionClient]
    session: AppSession
    script_run_count: int = 0


class SessionStorageError(Exception):
    """Exception class for errors raised by SessionStorage.

    The original error that causes a SessionStorageError to be (re)raised will generally
    be an I/O error specific to the concrete SessionStorage implementation.
    """


class SessionStorage(Protocol):
    @abstractmethod
    def get(self, session_id: str) -> Optional[SessionInfo]:
        """Return the SessionInfo corresponding to session_id, or None if one does not
        exist.

        Parameters
        ----------
        session_id
            The unique ID of the session being fetched.

        Returns
        -------
        SessionInfo or None

        Raises
        ------
        SessionStorageError
            Raised if an error occurs while attempting to fetch the session. This will
            generally happen if there is an error with the underlying storage backend
            (e.g. if we lose our connection to it).
        """
        raise NotImplementedError

    @abstractmethod
    def save(self, session_info: SessionInfo) -> None:
        """Save the given session.

        Parameters
        ----------
        session_info
            The SessionInfo being saved.

        Raises
        ------
        SessionStorageError
            Raised if an error occurs while saving the given session.
        """
        raise NotImplementedError

    @abstractmethod
    def delete(self, session_id: str) -> None:
        """Mark the session corresponding to session_id for deletion and stop tracking
        it.

        Note that:
          * Calling delete on an ID corresponding to a nonexistent session is a no-op.
          * Calling delete on an ID should cause the given session to no longer be
            tracked by this SessionStorage, but exactly when and how the session's data
            is eventually cleaned up is a detail left up to the implementation.

        Parameters
        ----------
        session_id
            The unique ID of the session to delete.

        Raises
        ------
        SessionStorageError
            Raised if an error occurs while attempting to delete the session.
        """
        raise NotImplementedError

    @abstractmethod
    def list(self) -> List[SessionInfo]:
        """List all sessions tracked by this SessionStorage.

        Returns
        -------
        List[SessionInfo]

        Raises
        ------
        SessionStorageError
            Raised if an error occurs while attempting to list sessions.
        """
        raise NotImplementedError


class SessionManager(Protocol):
    """SessionManagers are responsible for encapsulating all session lifecycle behavior
    that the Streamlit Runtime may care about.

    A SessionManager must define the following required methods:
      * __init__
      * connect_session
      * close_session
      * get_session_info
      * list_sessions

    SessionManager implementations may also choose to define the notions of active and
    inactive sessions. The precise definitions of active/inactive are left to the
    concrete implementation. SessionManagers that wish to differentiate between active
    and inactive sessions should have the required methods listed above operate on *all*
    sessions. Additionally, they should define the following methods for working with
    active sessions:
      * disconnect_session
      * get_active_session_info
      * is_active_session
      * list_active_sessions

    When active session-related methods are left undefined, their default
    implementations are the naturally corresponding required methods.

    The Runtime, unless there's a good reason to do otherwise, should generally work
    with the active-session versions of a SessionManager's methods. There isn't currently
    a need for us to be able to operate on inactive sessions stored in SessionStorage
    outside of the SessionManager itself. However, it's highly likely that we'll
    eventually have to do so, which is why the abstractions allow for this now.

    Notes
    -----
    Threading: All SessionManager methods are *not* threadsafe -- they must be called
    from the runtime's eventloop thread.
    """

    @abstractmethod
    def __init__(self, session_storage: SessionStorage, runtime: "Runtime") -> None:
        """Initialize a SessionManager with the given SessionStorage.

        Parameters
        ----------
        session_storage
            The SessionStorage instance backing this SessionManager.
        runtime
            A backpointer to the Runtime that owns this SessionManager.
        """
        raise NotImplementedError

    @abstractmethod
    def connect_session(
        self,
        client: SessionClient,
        user_info: Dict[str, Optional[str]],
        existing_session_id: Optional[str] = None,
    ) -> str:
        """Create a new session or connect to an existing one.

        Parameters
        ----------
        client
            A concrete SessionClient implementation for communicating with
            the session's client.
        user_info
            A dict that contains information about the session's user. For now,
            it only (optionally) contains the user's email address.

            {
                "email": "example@example.com"
            }
        existing_session_id
            The ID of an existing session to reconnect to. If one is not provided, a new
            session is created. Note that whether a SessionManager supports reconnection
            to an existing session is left up to the concrete SessionManager
            implementation. Those that do not support reconnection should simply ignore
            this argument.

        Returns
        -------
        str
            The session's unique string ID.
        """
        raise NotImplementedError

    @abstractmethod
    def close_session(self, session_id: str) -> None:
        """Close and completely delete the session with the given id.

        This function may be called multiple times for the same session,
        which is not an error. (Subsequent calls just no-op.)

        Parameters
        ----------
        session_id
            The session's unique ID.
        """
        raise NotImplementedError

    @abstractmethod
    def get_session_info(self, session_id: str) -> Optional[SessionInfo]:
        """Return the SessionInfo for the given id, or None if no such session
        exists.

        Parameters
        ----------
        session_id
            The session's unique ID.

        Returns
        -------
        SessionInfo or None
        """
        raise NotImplementedError

    @abstractmethod
    def list_sessions(self) -> List[SessionInfo]:
        """Return the SessionInfo for all sessions managed by this SessionManager.

        Returns
        -------
        List[SessionInfo]
        """
        raise NotImplementedError

    def num_sessions(self) -> int:
        """Return the number of sessions tracked by this SessionManager.

        Subclasses of SessionManager shouldn't provide their own implementation of this
        method without a *very* good reason.

        Returns
        -------
        int
        """
        return len(self.list_sessions())

    # NOTE: The following methods only need to be overwritten when a concrete
    # SessionManager implementation has a notion of active vs inactive sessions.
    # If left unimplemented in a subclass, the default implementations of these methods
    # call corresponding SessionManager methods in a natural way.

    def disconnect_session(self, session_id: str) -> None:
        """Disconnect the given session.

        This method should be idempotent.

        Parameters
        ----------
        session_id
            The session's unique ID.
        """
        self.close_session(session_id)

    def get_active_session_info(self, session_id: str) -> Optional[SessionInfo]:
        """Return the SessionInfo for the given id, or None if either no such session
        exists or the session is not active.

        Parameters
        ----------
        session_id
            The active session's unique ID.

        Returns
        -------
        SessionInfo or None
        """
        return self.get_session_info(session_id)

    def is_active_session(self, session_id: str) -> bool:
        """Return True if the given session exists and is active, False otherwise.

        Returns
        -------
        bool
        """
        return self.get_active_session_info(session_id) is not None

    def list_active_sessions(self) -> List[SessionInfo]:
        """Return the SessionInfo for all active sessions tracked by this SessionManager.

        Returns
        -------
        List[SessionInfo]
        """
        return self.list_sessions()

    def num_active_sessions(self) -> int:
        """Return the number of active sessions tracked by this SessionManager.

        Subclasses of SessionManager shouldn't provide their own implementation of this
        method without a *very* good reason.

        Returns
        -------
        int
        """
        return len(self.list_active_sessions())
