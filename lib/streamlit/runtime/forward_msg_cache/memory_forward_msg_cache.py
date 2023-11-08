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

from binascii import crc32
from typing import TYPE_CHECKING, Dict, List, MutableMapping, Optional
from weakref import WeakKeyDictionary

from streamlit import config, util
from streamlit.logger import get_logger
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime.forward_msg_cache.protocol import ForwardMsgCacheProtocol
from streamlit.runtime.runtime_util import populate_hash_if_needed
from streamlit.runtime.stats import CacheStat

if TYPE_CHECKING:
    from streamlit.runtime.app_session import AppSession

LOGGER = get_logger(__name__)


class MemoryForwardMsgCache(ForwardMsgCacheProtocol):
    """A cache of ForwardMsgs.

    Large ForwardMsgs (e.g. those containing big DataFrame payloads) are
    stored in this cache. The server can choose to send a ForwardMsg's hash,
    rather than the message itself, to a client. Clients can then
    request messages from this cache via another endpoint.

    This cache is *not* thread safe. It's intended to only be accessed by
    the server thread.

    """

    class Entry:
        """Cache entry.

        Stores the cached message, and the set of AppSessions
        that we've sent the cached message to.

        """

        def __init__(self, msg: ForwardMsg):
            self.msg = msg
            self._session_script_run_counts: MutableMapping[
                "AppSession", int
            ] = WeakKeyDictionary()

        def __repr__(self) -> str:
            return util.repr_(self)

        def add_session_ref(self, session: "AppSession", script_run_count: int) -> None:
            """Adds a reference to a AppSession that has referenced
            this Entry's message.

            Parameters
            ----------
            session : AppSession
            script_run_count : int
                The session's run count at the time of the call

            """
            prev_run_count = self._session_script_run_counts.get(session, 0)
            if script_run_count < prev_run_count:
                LOGGER.error(
                    "New script_run_count (%s) is < prev_run_count (%s). "
                    "This should never happen!" % (script_run_count, prev_run_count)
                )
                script_run_count = prev_run_count
            self._session_script_run_counts[session] = script_run_count

        def has_session_ref(self, session: "AppSession") -> bool:
            return session in self._session_script_run_counts

        def get_session_ref_age(
            self, session: "AppSession", script_run_count: int
        ) -> int:
            """The age of the given session's reference to the Entry,
            given a new script_run_count.

            """
            return script_run_count - self._session_script_run_counts[session]

        def remove_session_ref(self, session: "AppSession") -> None:
            del self._session_script_run_counts[session]

        def has_refs(self) -> bool:
            """True if this Entry has references from any AppSession.

            If not, it can be removed from the cache.
            """
            return len(self._session_script_run_counts) > 0

    def __init__(self, base_url: str):
        self.base_url = base_url
        self._entries: Dict[str, "MemoryForwardMsgCache.Entry"] = {}

    def __repr__(self) -> str:
        return util.repr_(self)

    def add_message(
        self, msg: ForwardMsg, session: "AppSession", script_run_count: int
    ) -> ForwardMsg:
        """Add a ForwardMsg to the cache.

        The cache will also record a reference to the given AppSession,
        so that it can track which sessions have already received
        each given ForwardMsg.

        Parameters
        ----------
        msg : ForwardMsg
        session : AppSession
        script_run_count : int
            The number of times the session's script has run

        Returns
        -------
        ForwardMsg

        """
        msg.metadata.cacheable = self._is_cacheable_msg(msg)
        populate_hash_if_needed(msg)
        msg_to_send = msg
        if msg.metadata.cacheable:
            if self._has_message_reference(msg, session, script_run_count):
                # This session has probably cached this message. Send
                # a reference instead.
                LOGGER.debug("Sending cached message ref (hash=%s)", msg.hash)
                msg_to_send = self._create_reference_msg(msg)

            # Cache the message so it can be referenced in the future.
            # If the message is already cached, this will reset its
            # age.
            LOGGER.debug("Caching message (hash=%s)", msg.hash)

            entry = self._entries.get(msg.hash, None)
            if entry is None:
                entry = MemoryForwardMsgCache.Entry(msg)
                self._entries[msg.hash] = entry
            entry.add_session_ref(session, script_run_count)

        return msg_to_send

    def get_message(self, hash: str) -> Optional[ForwardMsg]:
        """Return the message with the given ID if it exists in the cache.

        Parameters
        ----------
        hash : str
            The id of the message to retrieve.

        Returns
        -------
        ForwardMsg | None

        """
        entry = self._entries.get(hash, None)
        return entry.msg if entry else None

    def _has_message_reference(
        self, msg: ForwardMsg, session: "AppSession", script_run_count: int
    ) -> bool:
        """Return True if a session has a reference to a message."""
        populate_hash_if_needed(msg)

        entry = self._entries.get(msg.hash, None)
        if entry is None or not entry.has_session_ref(session):
            return False

        # Ensure we're not expired
        age = entry.get_session_ref_age(session, script_run_count)
        return age <= int(config.get_option("global.maxCachedMessageAge"))

    def remove_refs_for_session(self, session: "AppSession") -> None:
        """Remove refs for all entries for the given session.

        This should be called when an AppSession is disconnected or closed.

        Parameters
        ----------
        session : AppSession
        """

        # Operate on a copy of our entries dict.
        # We may be deleting from it.
        for msg_hash, entry in self._entries.copy().items():
            if entry.has_session_ref(session):
                entry.remove_session_ref(session)

            if not entry.has_refs():
                # The entry has no more references. Remove it from
                # the cache completely.
                del self._entries[msg_hash]

    def remove_expired_entries_for_session(
        self, session: "AppSession", script_run_count: int
    ) -> None:
        """Remove any cached messages that have expired from the given session.

        This should be called each time a AppSession finishes executing.

        Parameters
        ----------
        session : AppSession
        script_run_count : int
            The number of times the session's script has run

        """
        max_age = config.get_option("global.maxCachedMessageAge")

        LOGGER.debug(
            "Removing expired entries from MessageCache " "(max_age=%s)",
            max_age,
        )

        # Operate on a copy of our entries dict.
        # We may be deleting from it.
        for msg_hash, entry in self._entries.copy().items():
            if not entry.has_session_ref(session):
                continue

            age = entry.get_session_ref_age(session, script_run_count)
            if age > max_age:
                LOGGER.debug(
                    "Removing expired entry [session=%s, hash=%s, age=%s]",
                    id(session),
                    msg_hash,
                    age,
                )
                entry.remove_session_ref(session)
                if not entry.has_refs():
                    # The entry has no more references. Remove it from
                    # the cache completely.
                    del self._entries[msg_hash]

    def clear(self) -> None:
        """Remove all entries from the cache"""
        self._entries.clear()

    def _create_reference_msg(self, msg: ForwardMsg) -> ForwardMsg:
        if not msg.metadata.cacheable or not msg.hash:
            raise RuntimeError("Cannot create reference for non-cacheable message!")
        ref_msg = ForwardMsg()
        ref_msg.forward_msg_ref.ref_url = f"{self.base_url}?hash={msg.hash}"
        ref_msg.forward_msg_ref.ref_hash = msg.hash
        ref_msg.forward_msg_ref.checksum_crc32 = crc32(msg.SerializeToString())
        ref_msg.metadata.CopyFrom(msg.metadata)
        return ref_msg

    @staticmethod
    def _is_cacheable_msg(msg: ForwardMsg) -> bool:
        """True if the given message qualifies for caching."""
        if msg.WhichOneof("type") in {
            "forward_msg_ref",
            "initialize",
            "script_finished",
        }:
            # Some message types never get cached
            return False
        return msg.ByteSize() >= int(config.get_option("global.minCachedMessageSize"))

    def get_stats(self) -> List[CacheStat]:
        stats: List[CacheStat] = []
        for entry_hash, entry in self._entries.items():
            stats.append(
                CacheStat(
                    category_name="ForwardMessageCache",
                    cache_name="",
                    byte_length=entry.msg.ByteSize(),
                )
            )
        return stats
