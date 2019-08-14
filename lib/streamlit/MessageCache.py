# Copyright 2019 Streamlit Inc. All rights reserved.
# -*- coding: utf-8 -*-

import threading
from weakref import WeakKeyDictionary

import hashlib


def ensure_id(msg):
    """Assigns a unique ID to a ForwardMsg, if it doesn't already have one.

    Parameters
    ----------
    msg : ForwardMsg

    Returns
    -------
    string
        The message's ID

    """
    if msg.id == '':
        # SHA1 is good enough for what we need, which is uniqueness.
        hasher = hashlib.sha1()
        hasher.update(msg.SerializeToString())
        msg.id = hasher.hexdigest()

    return msg.id


class MessageCache(object):
    """A thread-safe cache of ForwardMsgs.

    Large ForwardMsgs (e.g. those containing big DataFrame payloads) are
    stored in this cache. The server can choose to send a ForwardMsg's hash,
    rather than the message itself, to a client. Clients can then
    request messages from this cache via another endpoint.

    """
    class Entry(object):
        def __init__(self, msg):
            self.msg = msg
            self.sessions = WeakKeyDictionary()

        def add_ref(self, session):
            self.sessions[session] = True

        def decrement_ref(self, session):
            del self.sessions[session]

    def __init__(self):
        self._lock = threading.RLock()
        # hash -> Entry
        self._entries = {}

    def add_message(self, msg, session):
        """Adds a ForwardMsg to the cache.

        Parameters
        ----------
        msg : ForwardMsg
        session : ReportSession

        """
        id = ensure_id(msg)
        with self._lock:
            entry = self._entries.get(id, None)
            if entry is None:
                entry = MessageCache.Entry(msg)
                self._entries[id] = entry
            entry.add_ref(session)

    def get_message(self, id):
        """Returns the message with the given ID if it exists in the cache.

        Parameters
        ----------
        id : string
            The id of the message to retrieve.

        Returns
        -------
        ForwardMsg | None

        """
        with self._lock:
            entry = self._entries.get(id, None)
            return entry.msg if entry else None

    def has_message_reference(self, msg, session):
        """Returns True if a session has a reference to a message.

        Parameters
        ----------
        msg : ForwardMsg
        session : ReportSession

        Returns
        -------
        bool

        """
        id = ensure_id(msg)
        with self._lock:
            entry = self._entries.get(id, None)
            return entry is not None and session in entry.sessions
