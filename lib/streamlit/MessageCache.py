# -*- coding: utf-8 -*-
# Copyright 2018-2019 Streamlit Inc.
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

import hashlib
import threading
from weakref import WeakKeyDictionary

from streamlit.proto.ForwardMsg_pb2 import ForwardMsg


def ensure_hash(msg):
    """Computes and assigns the unique hash for a ForwardMsg.

    If the ForwardMsg already has a hash, this is a no-op.

    Parameters
    ----------
    msg : ForwardMsg

    Returns
    -------
    string
        The message's hash, returned here for convenience. (The hash
        will also be assigned to the ForwardMsg; callers do not need
        to do this.)

    """
    if msg.hash == '':
        # Move the message's metadata aside. It's not part of the
        # hash calculation.
        metadata = msg.metadata
        msg.ClearField('metadata')

        # MD5 is good enough for what we need, which is uniqueness.
        hasher = hashlib.md5()
        hasher.update(msg.SerializeToString())
        msg.hash = hasher.hexdigest()

        # Restore metadata.
        msg.metadata.CopyFrom(metadata)

    return msg.hash


def create_reference_msg(msg):
    """Create a ForwardMsg that refers to the given message via its hash.

    The reference message will also get a copy of the source message's
    metadata.

    Parameters
    ----------
    msg : ForwardMsg
        The ForwardMsg to create the reference to.

    Returns
    -------
    ForwardMsg
        A new ForwardMsg that "points" to the original message via the
        ref_hash field.

    """
    ref_msg = ForwardMsg()
    ref_msg.ref_hash = ensure_hash(msg)
    ref_msg.metadata.CopyFrom(msg.metadata)
    return ref_msg


class MessageCache(object):
    """A thread-safe cache of ForwardMsgs.

    Large ForwardMsgs (e.g. those containing big DataFrame payloads) are
    stored in this cache. The server can choose to send a ForwardMsg's hash,
    rather than the message itself, to a client. Clients can then
    request messages from this cache via another endpoint.

    """
    class Entry(object):
        """Cache entry.

        Stores the cached message, and the set of ReportSessions
        that we've sent the cached message to.

        """
        def __init__(self, msg):
            self.msg = msg
            self.sessions = WeakKeyDictionary()

        def add_ref(self, session):
            self.sessions[session] = True

        def decrement_ref(self, session):
            del self.sessions[session]

    def __init__(self):
        self._lock = threading.RLock()
        self._entries = {}  # Map: hash -> Entry

    def add_message(self, msg, session):
        """Add a ForwardMsg to the cache.

        The cache will also record a reference to the given ReportSession,
        so that it can track which sessions have already received
        each given ForwardMsg.

        Parameters
        ----------
        msg : ForwardMsg
        session : ReportSession

        """
        hash = ensure_hash(msg)
        with self._lock:
            entry = self._entries.get(hash, None)
            if entry is None:
                entry = MessageCache.Entry(msg)
                self._entries[hash] = entry
            entry.add_ref(session)

    def get_message(self, hash):
        """Return the message with the given ID if it exists in the cache.

        Parameters
        ----------
        hash : string
            The id of the message to retrieve.

        Returns
        -------
        ForwardMsg | None

        """
        with self._lock:
            entry = self._entries.get(hash, None)
            return entry.msg if entry else None

    def has_message_reference(self, msg, session):
        """Return True if a session has a reference to a message.

        Parameters
        ----------
        msg : ForwardMsg
        session : ReportSession

        Returns
        -------
        bool

        """
        id = ensure_hash(msg)
        with self._lock:
            entry = self._entries.get(id, None)
            return entry is not None and session in entry.sessions

    def clear(self):
        """Remove all entries from the cache"""
        with self._lock:
            self._entries.clear()
