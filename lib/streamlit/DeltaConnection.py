# -*- coding: future_fstrings -*-
# Copyright 2018 Streamlit Inc. All rights reserved.

"""Connection management methods."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import base58
import inspect
import os
import sys
import urllib
import uuid

from streamlit import config
from streamlit.Connection import Connection
from streamlit.DeltaGenerator import DeltaGenerator
from streamlit.streamlit_msg_proto import new_report_msg
from streamlit.util import get_local_id

from streamlit.logger import get_logger
LOGGER = get_logger()

# Save the default exception handler.
_original_excepthook = sys.excepthook


class DeltaConnection(object):
    """Represents a single connection to the server for a single report.

    The API for this object is simple: the only public method is
    get_delta_generator(). All details about the connection itself are managed
    internally.
    """

    # This is the singleton connection object.
    _singleton = None

    def __new__(cls, *args, **kwargs):
        """Create new connection or return singleton."""
        if cls._singleton:
            return cls._singleton
        # Don't pass *args and **kwargs to super() because Python3 doesn't
        # support that. But this doesn't seem impact what gets passed into
        # __init__(), so it's all good.
        return super(DeltaConnection, cls).__new__(cls)

    # This is the class through which we can add elements to the Report
    def __init__(self, enable_display=True):
        """Initialize connection to the server."""
        # If this is the singleton, don't reinitalize.
        if self is DeltaConnection._singleton:
            DeltaConnection._singleton._set_display_enabled(enable_display)
            return

        DeltaConnection._singleton = self

        self._is_display_enabled = None
        self._delta_generator = None
        self._connection = None

        self._set_display_enabled(enable_display)

    def _set_display_enabled(self, do_enable):
        if do_enable == self._is_display_enabled:
            return

        if do_enable and self._connection is None:
            self._connect()

        # If do_enable is false, do nothing. Either this DeltaConnection is
        # already disabled, or the user is trying to go from enabled to
        # disabled -- which is unsupported. Either way, there's nothing to do.

        self._is_display_enabled = do_enable

    def _connect(self):
        # Create ID for the connection and its respective report.
        report_id = base58.b58encode(uuid.uuid4().bytes).decode("utf-8")

        # Create name for the connection and its respective report.
        name = _build_name(report_id)
        LOGGER.debug(f'Creating a connection with name "{name}"')

        # Create this connection's report.
        uri = _build_uri(name)

        # Get path of the file that caused this connection to be created.
        root_frame = inspect.stack()[-1]
        filename = root_frame[1]  # 1 is the filename field in this tuple.
        source_file_path = ''  # Empty string means "no file" to us.

        # Check if we're in the REPL by looking at magic filename strings.
        # <stdin> is what the basic Python REPL calls the root frame's
        # filename, and <string> is what iPython calls it.
        if filename not in ('<stdin>', '<string>'):
            source_file_path = os.path.realpath(filename)

        LOGGER.debug(f'source_file_path: {source_file_path}.')

        self._connection = Connection(
            uri=uri,
            new_report_msg=new_report_msg(
                report_id, os.getcwd(), ['python'] + sys.argv,
                source_file_path),
            on_connect=self._on_connect,
            on_cleanup=self._on_cleanup,
        )

    def _on_connect(self):
        # NOTE: This is a callback that gets executed in a coroutine.

        def streamlit_excepthook(exc_type, exc_value, exc_tb):
            dg = self.get_delta_generator()
            dg.exception(exc_value, exc_tb)
            _original_excepthook(exc_type, exc_value, exc_tb)

        sys.excepthook = streamlit_excepthook

    def _on_cleanup(self):
        # NOTE: This is a callback that gets executed in a coroutine.
        LOGGER.debug('Main thread ended. Restoring excepthook.')
        sys.excepthook = _original_excepthook
        DeltaConnection._singleton = None

    def get_delta_generator(self):
        """Return the DeltaGenerator for this connection.

        This is the object that allows you to dispatch toplevel deltas to the
        Report, e.g. adding new elements.
        """
        if self._delta_generator is None:
            # Start a new DeltaGenerator and tell it how to enqueue deltas.
            self._delta_generator = DeltaGenerator(
                self._maybe_enqueue_delta)

        return self._delta_generator

    def _maybe_enqueue_delta(self, delta):
        if self._is_display_enabled:
            LOGGER.debug(f'Enqueing delta')
            self._connection.enqueue_delta(delta)


def _build_name(report_id):
    """Create a name for this report."""
    name = ''

    if len(sys.argv) >= 2 and sys.argv[0] == '-m':
        name = sys.argv[1]

    elif len(sys.argv) >= 1:
        name = os.path.split(sys.argv[0])[1]
        if name.endswith('.py'):
            name = name[:-3]
        if name == '__main__' and len(sys.argv) >= 2:
            name = sys.argv[1]

    if name == '':
        name = str(report_id)

    return name


def _build_uri(name):
    """Create the Proxy's WebSocket URI for this report."""
    server = config.get_option('proxy.server')
    port = config.get_option('proxy.port')
    local_id = get_local_id()
    report_name = urllib.parse.quote_plus(name)
    uri = f'ws://{server}:{port}/new/{local_id}/{report_name}'
    return uri
