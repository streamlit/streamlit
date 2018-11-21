# -*- coding: future_fstrings -*-
# Copyright 2018 Streamlit Inc. All rights reserved.

"""Connection management methods."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import inspect
import os
import sys
import urllib
import uuid

from streamlit import config
from streamlit.Connection import Connection
from streamlit.DeltaGenerator import DeltaGenerator
from streamlit.streamlit_msg_proto import new_report_msg
from streamlit.util import get_local_id, build_report_id

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

    @classmethod
    def get_connection(cls):
        """Return the singleton DeltaConnection object.

        Instantiates one if necessary.
        """
        if cls._singleton is None:
            LOGGER.debug('No singleton. Registering one.')
            DeltaConnection()

        DeltaConnection._singleton.set_enabled(
            config.get_option('client.displayEnabled'))

        return DeltaConnection._singleton

    # Don't allow constructor to be called more than once.
    def __new__(cls):
        if DeltaConnection._singleton is not None:
            raise RuntimeError('Use .get_connection() instead')
        return super(DeltaConnection, cls).__new__(cls)

    def __init__(self):
        """Initialize connection to the server.

        NOTE: The connection will be "disabled" by default. To actually
        connect, call set_enabled(True).
        """
        DeltaConnection._singleton = self
        self._is_display_enabled = None
        self._delta_generator = None
        self._connection = None

    def set_enabled(self, do_enable):
        """Enable or disable this connection.

        Parameters
        ----------
        do_enable : bool
            If True, connects the WebSocket and turns on the ability to send
            data through it. If False, turns off the ability to send data
            through the WebSocket, but does not touch the existing WebSocket's
            actual connection, if any.
        """
        if do_enable == self._is_display_enabled:
            return
        else:
            LOGGER.debug(f'set_enabled: {do_enable}')

        self._is_display_enabled = do_enable

        if do_enable and self._connection is None:
            report_id = build_report_id()
            LOGGER.debug(f'Report ID: "{report_id}"')

            self._connection = Connection(
                uri=_build_uri(report_id),
                initial_msg=_build_new_report_msg(report_id),
                on_connect=self._on_connect,
                on_cleanup=self._on_cleanup)

        # else:
        #     Do nothing. Either this DeltaConnection is already disabled, or
        #     the user is trying to go from enabled to disabled -- in which
        #     case we want to leave self._connection untouched since the user
        #     may re-enable display later on. Either way, there's nothing to
        #     do.

    # NOTE: This is a callback that gets executed in a coroutine.
    def _on_connect(self):

        def streamlit_excepthook(exc_type, exc_value, exc_tb):
            dg = self.get_delta_generator()
            dg.exception(exc_value, exc_tb)
            _original_excepthook(exc_type, exc_value, exc_tb)

        sys.excepthook = streamlit_excepthook

    # NOTE: This is a callback that gets executed in a coroutine.
    def _on_cleanup(self):
        LOGGER.debug('Main thread ended. Restoring excepthook.')
        sys.excepthook = _original_excepthook

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

    # NOTE: This is a callback that is executed by DeltaGenerator.
    def _maybe_enqueue_delta(self, delta):
        if self._is_display_enabled:
            self._connection.enqueue_delta(delta)


def _build_uri(report_id):
    """Create the Proxy's WebSocket URI for this report."""
    name = _build_name(report_id)

    LOGGER.debug(f'Report name: "{name}"')

    server = config.get_option('proxy.server')
    port = config.get_option('proxy.port')
    local_id = get_local_id()
    report_name = urllib.parse.quote_plus(name)
    uri = f'ws://{server}:{port}/new/{local_id}/{report_name}'

    LOGGER.debug(f'Report WebSocket URI: "{uri}"')

    return uri

def _convert_filename_to_name(filename):
    """Converts a python filename to a name."""
    name = os.path.split(filename)[1]
    if name.endswith('.py'):
        name = name[:-3]
    return name

def _build_name(report_id):
    """Create a name for this report."""
    name = ''

    if len(sys.argv) >= 2 and sys.argv[0] == '-m':
        name = sys.argv[1]

    elif len(sys.argv) >= 1:
        name = _convert_filename_to_name(sys.argv[0])
        if name in ['__main__', 'streamlit']:
            if len(sys.argv) >= 3 and sys.argv[1] == 'run':
                name = _convert_filename_to_name(sys.argv[2])
            elif len(sys.argv) >= 2:
                name = sys.argv[1]

    if name == '':
        name = str(report_id)

    return name


def _build_new_report_msg(report_id):
    """Create a NewReportMessage proto."""
    # Get path of the file that caused this connection to be created.
    root_frame = inspect.stack()[-1]
    filename = root_frame[1]  # 1 is the filename field in this tuple.
    source_file_path = ''  # Empty string means "no file" to us.

    # Check if we're in the REPL by looking at magic filename strings.
    # <stdin> is what the basic Python REPL calls the root frame's
    # filename, and <string> is what iPython calls it.
    if filename not in ('<stdin>', '<string>'):
        source_file_path = os.path.realpath(filename)

    return new_report_msg(
        report_id=report_id,
        cwd=os.getcwd(),
        command_line=sys.argv,
        source_file_path=source_file_path)
